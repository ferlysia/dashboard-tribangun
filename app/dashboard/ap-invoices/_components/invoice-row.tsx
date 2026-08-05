"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import type { ApInvoice } from "@/types/ap-invoice"
import { computeTotal } from "@/lib/ap-invoices/status-rules"
import { formatIDR } from "@/lib/format"
import { useDeleteInvoice, useUpdateInvoice, type InvoicePatch } from "../_hooks/use-ap-invoices"
import { UrgencyPill } from "./urgency-pill"

function fDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

// Click-to-edit, onBlur-commit — same interaction as UnitCell/UnitCountEditor
// in the PM Schedule module (app/dashboard/maintenance-schedule/_components/).
function EditableDateCell({ value, onCommit }: { value: string | null; onCommit: (next: string | null) => void }) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value ?? "")

  const commit = () => {
    setEditing(false)
    const next = draft.trim() || null
    if (next === value) return
    onCommit(next)
  }

  if (editing) {
    return (
      <input
        type="date" autoFocus value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false) } }}
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-xs text-foreground px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-ring/30"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value ?? ""); setEditing(true) }}
      className="text-left w-full text-xs font-medium text-slate-900 dark:text-slate-100 hover:text-rose-600 dark:hover:text-rose-400 hover:underline underline-offset-2"
      title="Klik untuk ubah"
    >
      {fDate(value)}
    </button>
  )
}

function EditableAmountCell({ value, onCommit }: { value: number; onCommit: (next: number) => void }) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(String(value))

  const commit = () => {
    setEditing(false)
    const n = Number(draft)
    if (!Number.isFinite(n) || n === value) { setDraft(String(value)); return }
    onCommit(n)
  }

  if (editing) {
    return (
      <input
        type="number" autoFocus value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(value)); setEditing(false) } }}
        className="w-28 rounded-md border border-slate-300 dark:border-slate-700 bg-background text-xs text-foreground px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-ring/30"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      className="text-left w-full text-xs font-semibold text-slate-900 dark:text-slate-100 hover:text-rose-600 dark:hover:text-rose-400 hover:underline underline-offset-2 whitespace-nowrap"
      title="Klik untuk ubah"
    >
      {formatIDR(value)}
    </button>
  )
}

export const INVOICE_GRID_COLUMN_LABELS = [
  "Vendor", "PO Date", "PO No", "Project", "Invoice Date", "Invoice No",
  "DPP", "PPN", "PPh", "Total", "Due Date", "Status", "",
]

export const InvoiceRow = React.memo(function InvoiceRow({
  invoice, selected, onToggleSelect, onMarkPaid,
}: {
  invoice:         ApInvoice
  selected:        boolean
  onToggleSelect:  (id: string, checked: boolean) => void
  onMarkPaid:      (invoice: ApInvoice) => void
}) {
  const updateInvoice = useUpdateInvoice()
  const deleteInvoice = useDeleteInvoice()
  const isPaid = !!invoice.payment_date

  // total_amount auto-recomputes live when DPP/PPN/PPh change (the only
  // field that's derived-by-default) but stays a normal editable cell the
  // user can override afterward — never forced, matches the create dialog.
  const commitAmountField = (field: "dpp_amount" | "ppn_amount" | "pph_amount", next: number) => {
    const patch: InvoicePatch = { id: invoice.id, [field]: next }
    const dpp = field === "dpp_amount" ? next : invoice.dpp_amount
    const ppn = field === "ppn_amount" ? next : invoice.ppn_amount
    const pph = field === "pph_amount" ? next : invoice.pph_amount
    patch.total_amount = computeTotal(dpp, ppn, pph)
    updateInvoice.mutate(patch)
  }

  const handleDelete = () => {
    if (!window.confirm(`Hapus invoice ${invoice.invoice_number}?`)) return
    deleteInvoice.mutate(invoice.id)
  }

  return (
    <tr className={`border-b border-slate-100 dark:border-slate-800 hover:bg-rose-50/60 dark:hover:bg-rose-950/20 transition-colors ${isPaid ? "opacity-70" : ""}`}>
      <td className="px-2 py-2.5 text-center">
        <Checkbox checked={selected} onCheckedChange={checked => onToggleSelect(invoice.id, checked === true)} />
      </td>
      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
        {invoice.ap_vendors?.name ?? "—"}
      </td>
      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{fDate(invoice.po_date)}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{invoice.po_number ?? "—"}</td>
      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 max-w-[160px] truncate">{invoice.project_name ?? "—"}</td>
      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{fDate(invoice.invoice_date)}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-slate-900 dark:text-slate-100 whitespace-nowrap">{invoice.invoice_number}</td>
      <td className="px-2 py-2.5">
        <EditableAmountCell value={invoice.dpp_amount} onCommit={n => commitAmountField("dpp_amount", n)} />
      </td>
      <td className="px-2 py-2.5">
        <EditableAmountCell value={invoice.ppn_amount} onCommit={n => commitAmountField("ppn_amount", n)} />
      </td>
      <td className="px-2 py-2.5">
        <EditableAmountCell value={invoice.pph_amount} onCommit={n => commitAmountField("pph_amount", n)} />
      </td>
      <td className="px-2 py-2.5 bg-fuchsia-50/50 dark:bg-fuchsia-950/10">
        <EditableAmountCell value={invoice.total_amount} onCommit={n => updateInvoice.mutate({ id: invoice.id, total_amount: n })} />
      </td>
      <td className="px-2 py-2.5">
        <EditableDateCell value={invoice.due_date} onCommit={next => updateInvoice.mutate({ id: invoice.id, due_date: next })} />
      </td>
      <td className="px-2 py-2.5">
        <UrgencyPill invoice={invoice} />
      </td>
      <td className="px-2 py-2.5 whitespace-nowrap">
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
