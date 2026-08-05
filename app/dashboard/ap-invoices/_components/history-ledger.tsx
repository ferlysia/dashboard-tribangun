"use client"

import * as React from "react"
import type { ApInvoice } from "@/types/ap-invoice"
import { groupHistoryByMonthThenVendor, matchesSearch } from "@/lib/ap-invoices/grouping"
import { formatIDR } from "@/lib/format"
import { InvoiceGrid } from "./invoice-grid"
import { AnimatedCollapse, CollapseTrigger } from "./animated-collapse"

// Done/History tab: Month/Year -> Vendor -> rows. Grouping runs in a
// useMemo keyed on (invoices, searchQuery) so it's skipped entirely on
// unrelated re-renders (selection changes, other tabs, etc).
export function HistoryLedger({ invoices, searchQuery, selectedIds, onToggleSelect, onToggleSelectGroup, onMarkPaid }: {
  invoices:             ApInvoice[] // payment_date != null
  searchQuery:          string
  selectedIds:          Set<string>
  onToggleSelect:       (id: string, checked: boolean) => void
  onToggleSelectGroup:  (ids: string[], checked: boolean) => void
  onMarkPaid:           (invoice: ApInvoice) => void
}) {
  const searching = searchQuery.trim().length > 0

  const months = React.useMemo(() => {
    const filtered = searching ? invoices.filter(inv => matchesSearch(inv, searchQuery)) : invoices
    return groupHistoryByMonthThenVendor(filtered)
  }, [invoices, searchQuery, searching])

  const [openMonths, setOpenMonths] = React.useState<Set<string>>(() => new Set())
  const [openVendors, setOpenVendors] = React.useState<Set<string>>(() => new Set())

  // Seed the most-recent month open the first time real data lands, without
  // fighting the user's manual toggles on every re-render afterward.
  const seededRef = React.useRef(false)
  React.useEffect(() => {
    if (seededRef.current || months.length === 0) return
    seededRef.current = true
    setOpenMonths(new Set([months[0].key]))
  }, [months])

  const toggleMonth = (key: string) =>
    setOpenMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  const toggleVendor = (key: string) =>
    setOpenVendors(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })

  if (months.length === 0) {
    return (
      <div className="rounded-xl border border-rose-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
        {searching ? "Tidak ada hasil yang cocok." : "Belum ada invoice yang lunas."}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {months.map(month => {
        // While searching, every remaining group (already pre-filtered to
        // only those with matches) is force-expanded so results are
        // immediately visible without hunting through the accordion.
        const monthOpen = searching || openMonths.has(month.key)
        return (
          <div key={month.key} className="rounded-xl border-2 border-rose-100 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
            <CollapseTrigger
              open={monthOpen}
              onClick={() => toggleMonth(month.key)}
              className="w-full flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-rose-50 to-fuchsia-50 dark:from-slate-800 dark:to-slate-800 text-left"
            >
              <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 capitalize">{month.label}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">· {month.count} invoice</span>
              <span className="ml-auto text-sm font-bold text-fuchsia-700 dark:text-fuchsia-400">{formatIDR(month.total)}</span>
            </CollapseTrigger>

            <AnimatedCollapse open={monthOpen}>
              <div className="flex flex-col gap-2 p-2.5 bg-rose-50/30 dark:bg-slate-950/40">
                {month.vendors.map(vendor => {
                  const vKey = `${month.key}:${vendor.vendorId}`
                  const vendorOpen = searching || openVendors.has(vKey)
                  return (
                    <div key={vKey} className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                      <CollapseTrigger
                        open={vendorOpen}
                        onClick={() => toggleVendor(vKey)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 text-left"
                      >
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{vendor.vendorName}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">· {vendor.rows.length} invoice</span>
                        <span className="ml-auto text-xs font-bold text-teal-700 dark:text-teal-400">{formatIDR(vendor.total)}</span>
                      </CollapseTrigger>
                      <AnimatedCollapse open={vendorOpen}>
                        <div className="p-2">
                          <InvoiceGrid
                            invoices={vendor.rows}
                            selectedIds={selectedIds}
                            onToggleSelect={onToggleSelect}
                            onToggleSelectGroup={onToggleSelectGroup}
                            onMarkPaid={onMarkPaid}
                          />
                        </div>
                      </AnimatedCollapse>
                    </div>
                  )
                })}
              </div>
            </AnimatedCollapse>
          </div>
        )
      })}
    </div>
  )
}
