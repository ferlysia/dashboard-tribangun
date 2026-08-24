/**
 * Central RBAC config — single source of truth for role-based page access.
 *
 * Zero runtime dependencies (pure types/data) so this file is safe to import
 * from:
 *   - middleware.ts (Edge runtime — route-level enforcement, blocks direct URL nav)
 *   - components/app-sidebar.tsx (client — hides nav links the role can't open)
 *   - lib/auth/session.ts (server — role normalisation)
 *
 * To change what a role can see, edit ROUTE_RULES here. Every other call site
 * derives its behavior from this one table.
 */

export type AppRole = "ADMIN" | "BOSS" | "PR" | "PROJECT" | "STAFF"

export const APP_ROLES: readonly AppRole[] = ["ADMIN", "BOSS", "PR", "PROJECT", "STAFF"]

interface RouteRule {
  pattern: RegExp
  roles: readonly AppRole[]
}

// Ordered most-specific-first — first matching pattern wins. ADMIN always
// bypasses (checked separately in isRouteAllowed). A pathname that matches no
// rule is left unguarded (allowed for any authenticated role).
const ROUTE_RULES: readonly RouteRule[] = [
  // ── PR (Purchasing / Maintenance) ──
  { pattern: /^\/dashboard\/maintenance-assets(\/|$)/,   roles: ["PR"] },
  { pattern: /^\/dashboard\/maintenance-schedule(\/|$)/, roles: ["PR"] },
  { pattern: /^\/dashboard\/purchasing-request(\/|$)/,   roles: ["PR"] },

  // ── Project (Operations) ──
  { pattern: /^\/dashboard\/doc-con(\/|$)/,          roles: ["PROJECT"] },
  { pattern: /^\/dashboard\/tool-inspection(\/|$)/,  roles: ["PROJECT"] },

  // ── Boss (Executive) ──
  { pattern: /^\/dashboard\/new-project(\/|$)/,     roles: ["BOSS"] },
  { pattern: /^\/dashboard\/cost-control(\/|$)/,    roles: ["BOSS"] },
  { pattern: /^\/dashboard\/finance(\/|$)/,         roles: ["BOSS"] },
  { pattern: /^\/dashboard\/pnl(\/|$)/,             roles: ["BOSS"] },
  { pattern: /^\/input-invoice(\/|$)/,              roles: ["BOSS"] },
  { pattern: /^\/analytics(\/|$)/,                  roles: ["BOSS"] },
  { pattern: /^\/clients(\/|$)/,                    roles: ["BOSS"] },
  { pattern: /^\/lifecycle(\/|$)/,                  roles: ["BOSS"] },
  { pattern: /^\/projects\/executive-view(\/|$)/,   roles: ["BOSS"] },
  { pattern: /^\/projects(\/|$)/,                   roles: ["BOSS"] },
  // Catch-all for the Dashboard home + any un-enumerated /dashboard/* page
  // (e.g. project detail views). Must stay LAST among /dashboard rules.
  { pattern: /^\/dashboard(\/|$)/,                  roles: ["BOSS"] },
]

/** Full nav catalogue, keyed by URL, used to drive the sidebar + ⌘K search. */
export interface NavPage {
  title: string
  url: string
  desc?: string
}

// Default landing page per role — plain "/dashboard" is Boss-only under
// ROUTE_RULES above, so PR/Project roles must land on the first page they
// can actually open (after login, or when bounced off /login while already
// signed in).
const ROLE_HOME: Readonly<Partial<Record<AppRole, string>>> = {
  PR:      "/dashboard/maintenance-assets",
  PROJECT: "/dashboard/doc-con",
}

export function getRoleHome(role: AppRole | undefined): string {
  if (!role) return "/dashboard"
  return ROLE_HOME[role] ?? "/dashboard"
}

export function isRouteAllowed(pathname: string, role: AppRole | undefined): boolean {
  if (!role) return false
  if (role === "ADMIN") return true

  for (const rule of ROUTE_RULES) {
    if (rule.pattern.test(pathname)) {
      return rule.roles.includes(role)
    }
  }

  // No rule matches this path — not one of the pages under strict RBAC scope.
  return true
}
