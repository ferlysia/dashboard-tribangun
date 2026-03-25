"use client"

import * as React from "react"
import { getPeriodDescription, getPeriodLabel, type YearFilter } from "@/lib/invoices"

type YearFilterContextValue = {
  yearFilter: YearFilter
  setYearFilter: (value: YearFilter) => void
  periodLabel: string
  periodDescription: string
}

const STORAGE_KEY = "dashboard-year-filter"

const YearFilterContext = React.createContext<YearFilterContextValue | null>(null)

export function YearFilterProvider({ children }: { children: React.ReactNode }) {
  const [yearFilter, setYearFilterState] = React.useState<YearFilter>("all")

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as YearFilter | null
      if (saved === "all" || saved === "2025" || saved === "2026") {
        setYearFilterState(saved)
      }
    } catch {}
  }, [])

  const setYearFilter = React.useCallback((value: YearFilter) => {
    setYearFilterState(value)
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
    } catch {}
  }, [])

  const value = React.useMemo(
    () => ({
      yearFilter,
      setYearFilter,
      periodLabel: getPeriodLabel(yearFilter),
      periodDescription: getPeriodDescription(yearFilter),
    }),
    [yearFilter, setYearFilter]
  )

  return <YearFilterContext.Provider value={value}>{children}</YearFilterContext.Provider>
}

export function useYearFilter() {
  const context = React.useContext(YearFilterContext)
  if (!context) {
    throw new Error("useYearFilter must be used within YearFilterProvider")
  }
  return context
}
