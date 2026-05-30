"use client"

import * as React from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppRole = "ADMIN" | "DOC_CON" | "COST_CONTROL" | "FINANCE" | "STAFF"

type CurrentUser = {
  name:      string
  firstName: string
  email:     string
  role?:     AppRole
}

type CurrentUserContextValue = {
  user:      CurrentUser
  setUser:   (user: CurrentUser) => void
  clearUser: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "dashboard-current-user"

const DEFAULT_USER: CurrentUser = {
  name:      "Guest",
  firstName: "Guest",
  email:     "",
  role:      undefined,
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CurrentUserContext = React.createContext<CurrentUserContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = React.useState<CurrentUser>(DEFAULT_USER)

  // On mount: hydrate from /api/auth/me (reads the HTTP-only session cookie).
  // Falls back to localStorage for display continuity between navigations.
  React.useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(({ user: u }: { user: { email: string; name: string; role: string } | null }) => {
        if (!u?.email) return
        const next: CurrentUser = {
          name:      u.name  || u.email,
          firstName: (u.name || u.email).split(" ")[0],
          email:     u.email,
          role:      u.role as AppRole | undefined,
        }
        setUserState(next)
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      })
      .catch(() => {
        // /api/auth/me unreachable — fall back to cached localStorage value
        try {
          const saved = window.localStorage.getItem(STORAGE_KEY)
          if (!saved) return
          const parsed = JSON.parse(saved) as Partial<CurrentUser>
          if (parsed.name && parsed.email) {
            setUserState({
              name:      parsed.name,
              firstName: parsed.firstName ?? parsed.name.split(" ")[0],
              email:     parsed.email,
              role:      parsed.role,
            })
          }
        } catch { /* ignore */ }
      })
  }, [])

  const setUser = React.useCallback((nextUser: CurrentUser) => {
    setUserState(nextUser)
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser)) } catch { /* ignore */ }
  }, [])

  const clearUser = React.useCallback(async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }) } catch { /* ignore */ }
    setUserState(DEFAULT_USER)
    try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  const value = React.useMemo(
    () => ({ user, setUser, clearUser }),
    [user, setUser, clearUser]
  )

  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCurrentUser() {
  const ctx = React.useContext(CurrentUserContext)
  if (!ctx) throw new Error("useCurrentUser must be used within CurrentUserProvider")
  return ctx
}
