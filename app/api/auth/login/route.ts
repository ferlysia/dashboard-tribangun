/**
 * POST /api/auth/login  — Step 1 of 2 in the auth flow.
 *
 * Verifies email + password against app_user_profiles.password_hash.
 * Returns a short-lived (10 min) temp JWT and the next step:
 *   "setup_totp"  → user has no 2FA configured yet
 *   "verify_totp" → user already has 2FA active
 *
 * NOTE: this route must NOT use edge runtime — bcryptjs requires Node.js crypto.
 */

import { NextResponse }        from "next/server"
import bcrypt                  from "bcryptjs"
import { signTempToken, normaliseRole } from "@/lib/auth/session"
import { supabaseConfig }      from "@/lib/supabase/config"

function svcHeaders() {
  return {
    apikey:          supabaseConfig.serviceRoleKey,
    Authorization:   `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type":  "application/json",
  }
}

// ─── Constant-time sentinel to prevent timing-based email enumeration ─────────
const DUMMY_HASH = "$2b$12$invalidhashfortimingguard000000000000000000000000000000"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const email    = (typeof body.email    === "string" ? body.email.trim().toLowerCase()    : "")
  const password = (typeof body.password === "string" ? body.password : "")

  if (!email || !password) {
    return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 })
  }

  // ── Fetch user ─────────────────────────────────────────────────────────────
  const r = await fetch(
    `${supabaseConfig.url}/rest/v1/app_user_profiles?email=eq.${encodeURIComponent(email)}&select=*`,
    { headers: svcHeaders(), cache: "no-store" }
  )
  const rows: Record<string, unknown>[] = r.ok ? await r.json() : []
  const user = rows[0]

  // ── Constant-time: always run bcrypt even if user not found ───────────────
  if (!user || !user.is_active) {
    await bcrypt.compare(password, DUMMY_HASH)
    return NextResponse.json({ error: "Email atau password tidak valid." }, { status: 401 })
  }

  // ── First login: no password set yet → accept and permanently save hash ───
  //    This is the one-time bootstrap: the first password the user enters becomes
  //    their permanent password. Subsequent logins require the same password.
  if (!user.password_hash) {
    const hash = await bcrypt.hash(password, 12)
    await fetch(
      `${supabaseConfig.url}/rest/v1/app_user_profiles?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: { ...svcHeaders(), Prefer: "return=minimal" },
        body: JSON.stringify({ password_hash: hash }),
      }
    )
  } else {
    const valid = await bcrypt.compare(password, user.password_hash as string)
    if (!valid) {
      return NextResponse.json({ error: "Email atau password tidak valid." }, { status: 401 })
    }
  }

  // ── Determine next step ────────────────────────────────────────────────────
  const totpEnabled = Boolean(user.totp_enabled)
  const step = totpEnabled ? "verify_totp" : "setup_totp"

  const tempToken = await signTempToken({
    email,
    name:  (user.full_name as string) || email,
    role:  normaliseRole(user.role),
    step,
  })

  return NextResponse.json({
    status:    step,
    tempToken,
    name:      user.full_name ?? email,
  })
}
