/**
 * POST /api/auth/totp/verify  — Returning-user TOTP verification.
 *
 * Called when an existing user (who already has totp_enabled=true) enters their OTP.
 * Fetches the TOTP secret from the database, verifies, and issues the session cookie.
 */

import { NextResponse }   from "next/server"
import { authenticator } from "otplib"
import {
  verifyToken, signSession, sessionCookieOpts,
  normaliseRole, COOKIE_NAME,
} from "@/lib/auth/session"
import { supabaseConfig } from "@/lib/supabase/config"

// window: 1 → accepts the previous, current, and next 30-second time step.
// Compensates for user typing latency + minor server clock drift without
// weakening security. All major TOTP providers (GitHub, AWS, Google) use this.
const TOTP = authenticator.clone({ window: 1 })

function svcHeaders() {
  return {
    apikey:          supabaseConfig.serviceRoleKey,
    Authorization:   `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type":  "application/json",
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { tempToken?: string; otp?: string }

  if (!body.tempToken || !body.otp) {
    return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 })
  }

  // ── Validate temp token ────────────────────────────────────────────────────
  let payload: Awaited<ReturnType<typeof verifyToken>>
  try {
    payload = await verifyToken(body.tempToken)
  } catch {
    return NextResponse.json({ error: "Token tidak valid atau kedaluwarsa." }, { status: 401 })
  }

  if (payload.step !== "verify_totp") {
    return NextResponse.json({ error: "Step tidak valid." }, { status: 400 })
  }

  const email = (payload.email as string).toLowerCase()

  // ── Fetch TOTP secret from DB (server-authoritative) ──────────────────────
  const r = await fetch(
    `${supabaseConfig.url}/rest/v1/app_user_profiles?email=eq.${encodeURIComponent(email)}&select=totp_secret,totp_enabled,full_name,role,is_active`,
    { headers: svcHeaders(), cache: "no-store" }
  )
  const rows: Record<string, unknown>[] = r.ok ? await r.json() : []
  const user = rows[0]

  if (!user || !user.is_active || !user.totp_secret || !user.totp_enabled) {
    return NextResponse.json({ error: "Akun tidak valid atau 2FA tidak aktif." }, { status: 400 })
  }

  // ── Verify OTP ─────────────────────────────────────────────────────────────
  const isValid = TOTP.verify({ token: body.otp, secret: user.totp_secret as string })
  if (!isValid) {
    return NextResponse.json({ error: "Kode OTP tidak valid. Coba lagi." }, { status: 400 })
  }

  // ── Issue full session cookie ──────────────────────────────────────────────
  const role = normaliseRole(user.role)
  const sessionToken = await signSession({
    email,
    name:  (user.full_name as string) || email,
    role,
  })

  const res = NextResponse.json({ ok: true, role })
  res.cookies.set(COOKIE_NAME, sessionToken, sessionCookieOpts())
  return res
}
