/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user from the session cookie.
 * Used by CurrentUserProvider to populate client-side user state with role info.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyToken, COOKIE_NAME }  from "@/lib/auth/session"
import { supabaseConfig }            from "@/lib/supabase/config"

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ user: null })

  try {
    const payload = await verifyToken(token)

    // Live lookup (not embedded in the JWT) so branch reassignment takes
    // effect without forcing a re-login.
    let branch: string | null = null
    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/app_user_profiles?email=eq.${encodeURIComponent(payload.email as string)}&select=branch`,
      { headers: { apikey: supabaseConfig.serviceRoleKey, Authorization: `Bearer ${supabaseConfig.serviceRoleKey}` } }
    )
    if (res.ok) {
      const rows = await res.json()
      branch = rows[0]?.branch ?? null
    }

    return NextResponse.json({
      user: {
        email:  payload.email,
        name:   payload.name,
        role:   payload.role,
        branch,
      },
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
