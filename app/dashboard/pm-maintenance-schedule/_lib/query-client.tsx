"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Scoped to this page only — the rest of the app uses plain fetch+useState,
// so this instantiates its own QueryClient rather than touching the root
// layout. One instance per mount (useState, not module scope) so it isn't
// shared across concurrent requests during SSR.
export function PmScheduleQueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  }))

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
