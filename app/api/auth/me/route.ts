/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user from the session cookie.
 * Used by CurrentUserProvider to populate client-side user state with role info.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyToken, COOKIE_NAME }  from "@/lib/auth/session"

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ user: null })

  try {
    const payload = await verifyToken(token)
    return NextResponse.json({
      user: {
        email: payload.email,
        name:  payload.name,
        role:  payload.role,
      },
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
