"use client"

import * as React from "react"
import { useYearFilter } from "@/components/providers/year-filter-provider"
import { useInvoices } from "@/components/providers/invoices-provider"

export function useFilteredInvoices() {
  const { yearFilter, periodLabel, periodDescription } = useYearFilter()
  const { invoices: allInvoices, loading, source, refresh, filterByYear } = useInvoices()
  const invoices = React.useMemo(() => filterByYear(yearFilter), [filterByYear, yearFilter])

  return {
    invoices,
    yearFilter,
    periodLabel,
    periodDescription,
    loading,
    source,
    refresh,
    totalRecords: allInvoices.length,
  }
}
