"use client"

import * as React from "react"

type CurrentUser = {
  name: string
  firstName: string
  email: string
}

type CurrentUserContextValue = {
  user: CurrentUser
  setUser: (user: CurrentUser) => void
  clearUser: () => void
}

const STORAGE_KEY = "dashboard-current-user"

const DEFAULT_USER: CurrentUser = {
  name: "Kane Chen",
  firstName: "Kane",
  email: "kane@tup.id",
}

const CurrentUserContext = React.createContext<CurrentUserContextValue | null>(null)

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = React.useState<CurrentUser>(DEFAULT_USER)

  const syncProfile = React.useCallback(async (nextUser: CurrentUser) => {
    try {
      await fetch("/api/user-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: nextUser.email,
          full_name: nextUser.name,
          role: "editor",
        }),
      })
    } catch {}
  }, [])

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (!saved) return
      const parsed = JSON.parse(saved) as Partial<CurrentUser>
      if (parsed.name && parsed.firstName && parsed.email) {
        const nextUser = {
          name: parsed.name,
          firstName: parsed.firstName,
          email: parsed.email,
        }
        setUserState(nextUser)
        void syncProfile(nextUser)
      }
    } catch {}
  }, [syncProfile])

  const setUser = React.useCallback((nextUser: CurrentUser) => {
    setUserState(nextUser)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser))
    } catch {}
    void syncProfile(nextUser)
  }, [syncProfile])

  const clearUser = React.useCallback(() => {
    setUserState(DEFAULT_USER)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }, [])

  const value = React.useMemo(() => ({ user, setUser, clearUser }), [user, setUser, clearUser])

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}

export function useCurrentUser() {
  const context = React.useContext(CurrentUserContext)
  if (!context) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider")
  }
  return context
}
