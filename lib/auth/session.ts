import { SignJWT, jwtVerify, type JWTPayload } from "jose"
import { normaliseAppRole, type AppRole } from "@/lib/rbac/access-control"

export type { AppRole }

// ─── Constants ────────────────────────────────────────────────────────────────

export const COOKIE_NAME = "__tup_session"

export type SessionPayload = JWTPayload & {
  email: string
  name:  string
  role:  AppRole
}

// ─── Key ─────────────────────────────────────────────────────────────────────

// Lazy — throws at call time, not module load (safe for edge middleware)
function jwtKey() {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error("SESSION_SECRET env var is required. Add it to .env.local.")
  return new TextEncoder().encode(s)
}

// ─── Sign / Verify ────────────────────────────────────────────────────────────

export async function signSession(
  payload: Omit<SessionPayload, keyof JWTPayload>
): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(jwtKey())
}

/** Short-lived token used to bridge password → TOTP verification steps */
export async function signTempToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(jwtKey())
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, jwtKey())
  return payload
}

// ─── Cookie options ───────────────────────────────────────────────────────────

export function sessionCookieOpts(maxAge = 12 * 3_600) {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax"  as const,
    path:     "/",
    maxAge,
  } as const
}

// ─── Role normalisation ───────────────────────────────────────────────────────

// Re-exported for call-site continuity (login/totp routes import this name).
// Actual logic lives in lib/rbac/access-control.ts — the single source of
// truth for turning a raw DB/JWT value into a canonical AppRole.
export const normaliseRole = normaliseAppRole
