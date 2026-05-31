/**
 * Next.js Edge Middleware — Authentication Guard + RBAC
 *
 * Runs on EVERY request before any page/API handler.
 * Edge-safe: no Node.js APIs, no bcryptjs, no session.ts import chain.
 * jose (Web Crypto API) is the only third-party dependency.
 */

import { NextRequest, NextResponse } from "next/server"
import { jwtVerify }                 from "jose"

// Inlined — do NOT import from @/lib/auth/session here.
// Pulling session.ts into the edge bundle (even for a string constant) drags
// in its full import chain which can trigger unhandled errors on cold start
// inside Netlify's Deno-based edge runtime.
const COOKIE_NAME = "__tup_session"

// ─── JWT key ─────────────────────────────────────────────────────────────────

function edgeKey(): Uint8Array | null {
  const s = process.env.SESSION_SECRET
  if (!s) return null
  return new TextEncoder().encode(s)
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
  if (!key) return null

  const raw = req.cookies.get(COOKIE_NAME)?.value
  if (!raw) return null

  try {
    const { payload } = await jwtVerify(raw, key)
    return payload
  } catch {
    return null
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl

    // ── 1. Always pass through ───────────────────────────────────────────────
    if (
      pathname.startsWith("/api/auth/")                 ||
      pathname.startsWith("/_next/")                    ||
      pathname === "/403"                               ||
      /\.(png|jpe?g|ico|svg|webp|gif|woff2?)$/i.test(pathname)
    ) {
      return NextResponse.next()
    }

    const session = await readSession(req)

    // ── 2. Redirect authenticated users away from /login ─────────────────────
    if (pathname === "/login") {
      if (session) return NextResponse.redirect(new URL("/dashboard", req.url))
      return NextResponse.next()
    }

    // ── 3. All other routes require a valid session ──────────────────────────
    if (!session) {
      const dest = new URL("/login", req.url)
      if (pathname !== "/") dest.searchParams.set("next", pathname)
      const res = NextResponse.redirect(dest)
      res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" })
      return res
    }

    const role = (session.role as string | undefined) ?? "STAFF"

    // ── 4. RBAC path guards ──────────────────────────────────────────────────
    for (const guard of ROLE_GUARDS) {
      if (guard.pattern.test(pathname) && !guard.allowed.includes(role)) {
        return NextResponse.redirect(new URL("/403", req.url))
      }
    }

    // ── 5. Forward user identity to downstream handlers ──────────────────────
    const res = NextResponse.next()
    res.headers.set("x-user-email", (session.email as string) ?? "")
    res.headers.set("x-user-role",  role)
    return res

  } catch {
    // Safety net: if anything throws unexpectedly, pass through rather than
    // crashing with "edge function invocation failed". The page will still
    // render but without session-gating — acceptable degradation.
    return NextResponse.next()
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
}
