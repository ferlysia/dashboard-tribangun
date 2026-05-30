/**
 * Next.js Edge Middleware — Authentication Guard + RBAC
 *
 * Runs on EVERY request before any page/API handler.
 * Must stay edge-compatible (no Node.js APIs, no bcryptjs).
 * Only jose (pure JS JWT) is used here.
 */

import { NextRequest, NextResponse } from "next/server"
import { jwtVerify }                 from "jose"
import { COOKIE_NAME }               from "@/lib/auth/session"

// ─── JWT key (inline to guarantee edge-safe lazy initialisation) ───────────

function edgeKey(): Uint8Array | null {
  const s = process.env.SESSION_SECRET
  return s ? new TextEncoder().encode(s) : null
}

// ─── Role → protected path matrix ────────────────────────────────────────────

const ROLE_GUARDS: ReadonlyArray<{ pattern: RegExp; allowed: ReadonlyArray<string> }> = [
  { pattern: /^\/dashboard\/doc-con(\/|$)/,      allowed: ["ADMIN", "DOC_CON"]       },
  { pattern: /^\/dashboard\/cost-control(\/|$)/, allowed: ["ADMIN", "COST_CONTROL"]  },
  { pattern: /^\/dashboard\/finance(\/|$)/,      allowed: ["ADMIN", "FINANCE"]       },
  { pattern: /^\/input-invoice(\/|$)/,           allowed: ["ADMIN", "FINANCE"]       },
]

// ─── Session reader ───────────────────────────────────────────────────────────

async function readSession(req: NextRequest) {
  const key = edgeKey()
  if (!key) return null           // SESSION_SECRET not configured

  const raw = req.cookies.get(COOKIE_NAME)?.value
  if (!raw) return null

  try {
    const { payload } = await jwtVerify(raw, key)
    return payload
  } catch {
    return null                   // expired or tampered
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── 1. Always pass through ─────────────────────────────────────────────────
  if (
    pathname.startsWith("/api/auth/")                 || // auth API routes
    pathname.startsWith("/_next/")                    || // Next.js internals
    pathname === "/403"                               || // 403 page itself
    /\.(png|jpe?g|ico|svg|webp|gif|woff2?)$/i.test(pathname)
  ) {
    return NextResponse.next()
  }

  const session = await readSession(req)

  // ── 2. Authenticated users must not see /login ─────────────────────────────
  if (pathname === "/login") {
    if (session) return NextResponse.redirect(new URL("/dashboard", req.url))
    return NextResponse.next()
  }

  // ── 3. All other routes require a valid session ────────────────────────────
  if (!session) {
    const dest = new URL("/login", req.url)
    if (pathname !== "/") dest.searchParams.set("next", pathname)
    const res = NextResponse.redirect(dest)
    res.cookies.delete(COOKIE_NAME)    // purge any stale / corrupted cookie
    return res
  }

  const role = (session.role as string | undefined) ?? "STAFF"

  // ── 4. RBAC path guards ────────────────────────────────────────────────────
  for (const guard of ROLE_GUARDS) {
    if (guard.pattern.test(pathname) && !guard.allowed.includes(role)) {
      // Hard abort — no fallback, redirect to 403
      return NextResponse.redirect(new URL("/403", req.url))
    }
  }

  // ── 5. Forward user identity as headers for server components ─────────────
  const res = NextResponse.next()
  res.headers.set("x-user-email", (session.email as string) ?? "")
  res.headers.set("x-user-role",  role)
  return res
}

export const config = {
  // Match everything except Next.js static assets and image optimiser
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
}
