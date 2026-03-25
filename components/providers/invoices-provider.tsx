"use client"

import * as React from "react"
import fallbackInvoices from "@/data/invoices-all.normalized.json"
import { filterInvoicesByYear, getDedupedInvoices, type YearFilter } from "@/lib/invoices"
import type { InvoiceRecord } from "@/types/invoice"
import { supabaseConfig } from "@/lib/supabase/config"

type InvoicesContextValue = {
  invoices: InvoiceRecord[]
  loading: boolean
  source: "supabase" | "local"
  refresh: () => Promise<void>
  filterByYear: (yearFilter: YearFilter) => InvoiceRecord[]
}

const FALLBACK_DATA = getDedupedInvoices(fallbackInvoices as InvoiceRecord[])

const InvoicesContext = React.createContext<InvoicesContextValue | null>(null)

async function fetchInvoicesFromSupabase() {
  const response = await fetch(
    `${supabaseConfig.url}/rest/v1/invoices?select=*&order=date.asc.nullslast,invoice_no.asc`,
    {
      headers: {
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${supabaseConfig.anonKey}`,
      },
      cache: "no-store",
    }
  )

  if (!response.ok) {
    throw new Error(`Supabase fetch failed: ${response.status}`)
  }

  const rows = ((await response.json()) as InvoiceRecord[]).map((record) => ({
    ...record,
    date: record.date || "",
    po_date: record.po_date || "",
  }))
  return getDedupedInvoices(rows)
}

export function InvoicesProvider({ children }: { children: React.ReactNode }) {
  const [invoices, setInvoices] = React.useState<InvoiceRecord[]>(FALLBACK_DATA)
  const [loading, setLoading] = React.useState(true)
  const [source, setSource] = React.useState<"supabase" | "local">("local")

  const refresh = React.useCallback(async () => {
    if (!supabaseConfig.url || !supabaseConfig.anonKey) {
      setInvoices(FALLBACK_DATA)
      setSource("local")
      setLoading(false)
      return
    }

    try {
      const rows = await fetchInvoicesFromSupabase()
      setInvoices(rows)
      setSource("supabase")
    } catch {
      setInvoices(FALLBACK_DATA)
      setSource("local")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  React.useEffect(() => {
    if (!supabaseConfig.url || !supabaseConfig.anonKey) return

    const interval = window.setInterval(() => {
      void refresh()
    }, 5000)

    const handleFocus = () => {
      void refresh()
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleFocus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleFocus)
    }
  }, [refresh])

  const value = React.useMemo<InvoicesContextValue>(
    () => ({
      invoices,
      loading,
      source,
      refresh,
      filterByYear: (yearFilter) => filterInvoicesByYear(invoices, yearFilter),
    }),
    [invoices, loading, refresh, source]
  )

  return <InvoicesContext.Provider value={value}>{children}</InvoicesContext.Provider>
}

export function useInvoices() {
  const context = React.useContext(InvoicesContext)
  if (!context) {
    throw new Error("useInvoices must be used within InvoicesProvider")
  }
  return context
}
