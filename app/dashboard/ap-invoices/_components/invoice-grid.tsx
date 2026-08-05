"use client"

import { Checkbox } from "@/components/ui/checkbox"
import type { ApInvoice } from "@/types/ap-invoice"
import { InvoiceRow, INVOICE_GRID_COLUMN_LABELS } from "./invoice-row"

// The smart data grid — shared by every tab (Priority/All/By Vendor/Done).
// Selection state lives in the parent so the bulk-action bar can span the
// whole page, not just one grid instance.
export function InvoiceGrid({ invoices, selectedIds, onToggleSelect, onToggleSelectGroup, onMarkPaid, onEdit, emptyMessage }: {
  invoices:              ApInvoice[]
  selectedIds:           Set<string>
  onToggleSelect:        (id: string, checked: boolean) => void
  onToggleSelectGroup:   (ids: string[], checked: boolean) => void
  onMarkPaid:            (invoice: ApInvoice) => void
  onEdit:                (invoice: ApInvoice) => void
  emptyMessage?:         string
}) {
  const ids = invoices.map(inv => inv.id)
  const allSelected = ids.length > 0 && ids.every(id => selectedIds.has(id))

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-rose-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
        {emptyMessage ?? "Tidak ada invoice."}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-rose-100 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-rose-50 to-fuchsia-50 dark:from-slate-800 dark:to-slate-800">
              <th className="px-2 py-2.5 border-b border-rose-100 dark:border-slate-700 text-center">
                <Checkbox checked={allSelected} onCheckedChange={checked => onToggleSelectGroup(ids, checked === true)} />
              </th>
              {INVOICE_GRID_COLUMN_LABELS.map((col, i) => (
                <th key={i} className="px-3 py-2.5 border-b border-rose-100 dark:border-slate-700 text-left text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                selected={selectedIds.has(inv.id)}
                onToggleSelect={onToggleSelect}
                onMarkPaid={onMarkPaid}
                onEdit={onEdit}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
