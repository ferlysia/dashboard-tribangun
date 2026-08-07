"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Scoped to this page only, same rationale as ApInvoicesQueryProvider
// (app/dashboard/ap-invoices/_lib/query-client.tsx) — one instance per mount
// (useState, not module scope) so it isn't shared across concurrent requests
// during SSR.
export function PurchaseRequestsQueryProvider({ children }: { children: React.ReactNode }) {
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
