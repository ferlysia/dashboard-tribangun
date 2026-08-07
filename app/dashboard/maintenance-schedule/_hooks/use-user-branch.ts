"use client"

import * as React from "react"

export function useUserBranch() {
  const [branch, setBranch] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(({ user }: { user: { branch?: string | null } | null }) => setBranch(user?.branch ?? null))
      .catch(() => setBranch(null))
      .finally(() => setLoading(false))
  }, [])

  return { branch, loading }
}
