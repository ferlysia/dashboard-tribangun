"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import type { ApInvoice } from "@/types/ap-invoice"
import { formatIDR } from "@/lib/format"
import { useDeleteInvoice } from "../_hooks/use-ap-invoices"
import { UrgencyPill } from "./urgency-pill"
import { InlineEditCell } from "./inline-edit-cell"

function fDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

// Progressive Entry: missing data is never a blank cell — it's a subtle,
// clickable "+ Add X" placeholder that opens the same centered Edit modal
// as clicking the row itself.
function FieldCell({ value, placeholder, className }: { value: React.ReactNode; placeholder: string; className?: string }) {
  if (value === null || value === undefined || value === "") {
    return (
      <span className="text-[11px] font-medium italic text-rose-400/70 dark:text-rose-500/50 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
        + {placeholder}
      </span>
    )
  }
  return <span className={className}>{value}</span>
}

export const INVOICE_GRID_COLUMN_LABELS = [
  "Vendor", "PO Date", "PO No", "Project", "Invoice Date", "Invoice No",
  "DPP", "PPN", "PPh", "Total", "Due Date", "Status", "",
]

export const InvoiceRow = React.memo(function InvoiceRow({
  invoice, selected, onToggleSelect, onMarkPaid, onEdit,
}: {
  invoice:         ApInvoice
  selected:        boolean
  onToggleSelect:  (id: string, checked: boolean) => void
  onMarkPaid:      (invoice: ApInvoice) => void
  onEdit:          (invoice: ApInvoice) => void
}) {
  const deleteInvoice = useDeleteInvoice()
  const isPaid = !!invoice.payment_date

  const handleDelete = () => {
    if (!window.confirm(`Hapus invoice ${invoice.invoice_number ?? "(draft)"}?`)) return
    deleteInvoice.mutate(invoice.id)
  }

  // Row/vendor-name/placeholder click → centered Edit modal (Requirement
  // 2). Interactive controls (checkbox, Mark Paid, delete) stop propagation
  // so they don't also trigger the edit.
  return (
    <tr
      onClick={() => onEdit(invoice)}
      className={`group border-b border-slate-100 dark:border-slate-800 hover:bg-rose-50/60 dark:hover:bg-rose-950/20 transition-colors cursor-pointer ${isPaid ? "opacity-70" : ""}`}
    >
      <td className="px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={checked => onToggleSelect(invoice.id, checked === true)} />
      </td>
      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap hover:underline underline-offset-2">
        {invoice.ap_vendors?.name ?? "—"}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <FieldCell value={fDate(invoice.po_date)} placeholder="Add PO Date" className="text-slate-600 dark:text-slate-400" />
      </td>
      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
        <InlineEditCell id={invoice.id} field="po_number" value={invoice.po_number} placeholder="Add PO" className="text-slate-600 dark:text-slate-400" />
      </td>
      <td className="px-3 py-2.5 max-w-[160px] truncate">
        <FieldCell value={invoice.project_name} placeholder="Add Project" className="text-slate-600 dark:text-slate-400" />
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <FieldCell value={fDate(invoice.invoice_date)} placeholder="Add Invoice Date" className="text-slate-600 dark:text-slate-400" />
      </td>
      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
        <InlineEditCell id={invoice.id} field="invoice_number" value={invoice.invoice_number} placeholder="Add Invoice No" className="text-slate-900 dark:text-slate-100" />
      </td>
      <td className="px-2 py-2.5">
        <FieldCell value={invoice.dpp_amount != null ? formatIDR(invoice.dpp_amount) : null} placeholder="Add DPP" className="text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap" />
      </td>
      <td className="px-2 py-2.5">
        <FieldCell value={invoice.ppn_amount != null ? formatIDR(invoice.ppn_amount) : null} placeholder="Add PPN" className="text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap" />
      </td>
      <td className="px-2 py-2.5">
        <FieldCell value={invoice.pph_amount != null ? formatIDR(invoice.pph_amount) : null} placeholder="Add PPh" className="text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap" />
      </td>
      <td className="px-2 py-2.5 bg-fuchsia-50/50 dark:bg-fuchsia-950/10">
        <FieldCell value={invoice.total_amount != null ? formatIDR(invoice.total_amount) : null} placeholder="Add Total" className="text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap" />
      </td>
      <td className="px-2 py-2.5">
        <FieldCell value={fDate(invoice.due_date)} placeholder="Add Due Date" className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap" />
      </td>
      <td className="px-2 py-2.5">
        <UrgencyPill invoice={invoice} />
      </td>
      <td className="px-2 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          {!isPaid && (
            <Button type="button" size="sm" className="text-xs h-7 font-semibold bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white border-0 shadow-sm" onClick={() => onMarkPaid(invoice)}>
              Mark Paid
            </Button>
          )}
          <button type="button" onClick={handleDelete} className="p-1 text-slate-400 hover:text-rose-600 transition-colors" title="Hapus invoice">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
})
