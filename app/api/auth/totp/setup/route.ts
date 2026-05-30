/**
 * POST /api/auth/totp/setup
 *
 * Generates a fresh TOTP secret and returns:
 *   - qrDataUrl : PNG data URL for the QR code
 *   - secret    : raw base32 secret (for manual entry)
 *
 * The secret is NOT saved to the DB here.
 * The client must call /api/auth/totp/confirm with the verified OTP to persist it.
 */

import { NextResponse }                  from "next/server"
import { generateSecret, generateURI }  from "otplib"
import QRCode                           from "qrcode"
import { verifyToken }                  from "@/lib/auth/session"

const ISSUER = "TUP Dashboard"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { tempToken?: string }

  if (!body.tempToken) {
    return NextResponse.json({ error: "Token diperlukan." }, { status: 400 })
  }

  let payload: Awaited<ReturnType<typeof verifyToken>>
  try {
    payload = await verifyToken(body.tempToken)
  } catch {
    return NextResponse.json({ error: "Token tidak valid atau kedaluwarsa." }, { status: 401 })
  }

  if (payload.step !== "setup_totp") {
    return NextResponse.json({ error: "Step tidak valid untuk endpoint ini." }, { status: 400 })
  }

  const email      = payload.email as string
  const secret     = generateSecret()
  const otpauthUrl = generateURI({ label: email, issuer: ISSUER, secret })
  const qrDataUrl  = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: "M",
    width: 220,
    margin: 2,
  })

  return NextResponse.json({ secret, qrDataUrl })
}
