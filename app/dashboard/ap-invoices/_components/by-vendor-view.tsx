"use client"

import * as React from "react"
import type { ApInvoice } from "@/types/ap-invoice"
import { computeInvoiceUrgency } from "@/lib/ap-invoices/status-rules"
import { formatIDR } from "@/lib/format"
import { CollapsibleSection } from "@/app/dashboard/maintenance-schedule/_components/all-sites-view"
import { InvoiceGrid } from "./invoice-grid"

// Collapsible per-vendor groups — reuses CollapsibleSection from the PM
// Schedule module instead of rebuilding a collapsible from scratch.
export function ByVendorView({ invoices, selectedIds, onToggleSelect, onToggleSelectGroup, onMarkPaid }: {
  invoices:              ApInvoice[]
  selectedIds:           Set<string>
  onToggleSelect:        (id: string, checked: boolean) => void
  onToggleSelectGroup:   (ids: string[], checked: boolean) => void
  onMarkPaid:            (invoice: ApInvoice) => void
}) {
  const groups = React.useMemo(() => {
    const byVendor = new Map<string, { name: string; rows: ApInvoice[] }>()
    for (const inv of invoices) {
      const key = inv.vendor_id
      if (!byVendor.has(key)) byVendor.set(key, { name: inv.ap_vendors?.name ?? "—", rows: [] })
      byVendor.get(key)!.rows.push(inv)
    }
    return Array.from(byVendor.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [invoices])

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-rose-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
        Belum ada invoice.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map(group => {
        const unpaid = group.rows.filter(r => !r.payment_date)
        const priority = unpaid.filter(r => {
          const { urgency } = computeInvoiceUrgency(r)
          return urgency === "OVERDUE" || urgency === "PRIORITY"
        })
        const outstanding = unpaid.reduce((sum, r) => sum + r.total_amount, 0)

        return (
          <CollapsibleSection
            key={group.rows[0].vendor_id}
            title={group.name}
            subtitle={
              <span className="inline-flex items-center gap-2">
                {group.rows.length} invoice · {unpaid.length} belum bayar
                {priority.length > 0 && <span className="text-rose-600 dark:text-rose-400 font-bold">· {priority.length} priority</span>}
                · outstanding <span className="font-bold text-fuchsia-700 dark:text-fuchsia-400">{formatIDR(outstanding)}</span>
              </span>
            }
          >
            <div className="p-2 bg-background">
              <InvoiceGrid
                invoices={group.rows}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                onToggleSelectGroup={onToggleSelectGroup}
                onMarkPaid={onMarkPaid}
              />
            </div>
          </CollapsibleSection>
        )
      })}
    </div>
  )
}
