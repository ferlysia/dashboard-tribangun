import { SignJWT, jwtVerify, type JWTPayload } from "jose"
import type { AppRole } from "@/lib/rbac/access-control"

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

const VALID_ROLES = new Set<string>(["ADMIN", "BOSS", "PR", "PROJECT", "HR"])

export function normaliseRole(raw: unknown): AppRole {
  if (typeof raw === "string" && VALID_ROLES.has(raw)) return raw as AppRole
  return "STAFF"
}
