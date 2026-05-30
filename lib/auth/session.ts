import { SignJWT, jwtVerify, type JWTPayload } from "jose"

// ─── Constants ────────────────────────────────────────────────────────────────

export const COOKIE_NAME = "__tup_session"

export type AppRole = "ADMIN" | "DOC_CON" | "COST_CONTROL" | "FINANCE" | "STAFF"

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
    .setExpirationTime("8h")
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

export function sessionCookieOpts(maxAge = 8 * 3_600) {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax"  as const,
    path:     "/",
    maxAge,
  } as const
}

// ─── Role normalisation ───────────────────────────────────────────────────────

const VALID_ROLES = new Set<string>(["ADMIN", "DOC_CON", "COST_CONTROL", "FINANCE"])

export function normaliseRole(raw: unknown): AppRole {
  if (typeof raw === "string" && VALID_ROLES.has(raw)) return raw as AppRole
  return "STAFF"
}
