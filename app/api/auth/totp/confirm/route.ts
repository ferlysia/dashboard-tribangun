/**
 * POST /api/auth/totp/confirm  — First-time TOTP activation.
 *
 * Called after the user scans the QR code and enters their first OTP.
 * On success:
 *   1. Persists totp_secret + totp_enabled=true to app_user_profiles
 *   2. Issues the full __tup_session cookie (12h)
 */

import { NextResponse }        from "next/server"
import { verify as totpVerify } from "otplib"
import {
  verifyToken, signSession, sessionCookieOpts,
  normaliseRole, COOKIE_NAME,
} from "@/lib/auth/session"
import { supabaseConfig } from "@/lib/supabase/config"

function svcHeaders() {
  return {
    apikey:          supabaseConfig.serviceRoleKey,
    Authorization:   `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type":  "application/json",
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    tempToken?: string; secret?: string; otp?: string
  }

  if (!body.tempToken || !body.secret || !body.otp) {
    return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 })
  }

  // ── Validate temp token ────────────────────────────────────────────────────
  let payload: Awaited<ReturnType<typeof verifyToken>>
  try {
    payload = await verifyToken(body.tempToken)
  } catch {
    return NextResponse.json({ error: "Token tidak valid atau kedaluwarsa." }, { status: 401 })
  }

  if (payload.step !== "setup_totp") {
    return NextResponse.json({ error: "Step tidak valid." }, { status: 400 })
  }

  // ── Verify OTP against the client-provided secret ─────────────────────────
  //    Even if the client sends an arbitrary secret, the OTP verification
  //    ensures they possess an authenticator bound to that exact secret.
  const result  = await totpVerify({ token: body.otp, secret: body.secret, epochTolerance: 30 })
  const isValid = typeof result === "boolean" ? result : result.valid
  if (!isValid) {
    return NextResponse.json(
      { error: "Kode OTP tidak valid. Pastikan waktu perangkat Anda sudah benar." },
      { status: 400 }
    )
  }

  const email = (payload.email as string).toLowerCase()

  // ── Persist TOTP secret ────────────────────────────────────────────────────
  await fetch(
    `${supabaseConfig.url}/rest/v1/app_user_profiles?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: { ...svcHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ totp_secret: body.secret, totp_enabled: true }),
    }
  )

  // ── Issue full session cookie ──────────────────────────────────────────────
  const role = normaliseRole(payload.role)
  const sessionToken = await signSession({
    email,
    name:  (payload.name as string) || email,
    role,
  })

  const res = NextResponse.json({ ok: true, role })
  res.cookies.set(COOKIE_NAME, sessionToken, sessionCookieOpts())
  return res
}
