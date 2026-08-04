"use client"

import type { ApInvoice } from "@/types/ap-invoice"
import { computeInvoiceUrgency, type Urgency } from "@/lib/ap-invoices/status-rules"

// High-contrast, color-coded per the monday.com-style requirement:
// 🔴 overdue, 🟠 priority (<=7d), 🟢 safe, 🔵 open debt (aging), ⚪ paid.
const URGENCY_CFG: Record<Urgency, { emoji: string; label: (days: number) => string; badge: string }> = {
  OVERDUE:   { emoji: "🔴", label: d => `Lewat ${Math.abs(d)} hari`,     badge: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 font-semibold" },
  PRIORITY:  { emoji: "🟠", label: d => (d === 0 ? "Jatuh tempo hari ini" : `${d} hari lagi`), badge: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400 font-semibold" },
  SAFE:      { emoji: "🟢", label: d => `${d} hari lagi`,                badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  OPEN_DEBT: { emoji: "🔵", label: d => `Aging ${d} hari`,                badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  PAID:      { emoji: "⚪", label: () => "Paid",                         badge: "bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 line-through" },
}

export function UrgencyPill({ invoice, today }: { invoice: Pick<ApInvoice, "due_date" | "invoice_date" | "payment_date">; today?: Date }) {
  const { urgency, days } = computeInvoiceUrgency(invoice, today)
  const cfg = URGENCY_CFG[urgency]
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${cfg.badge}`}>
      {cfg.emoji} {cfg.label(days)}
    </span>
  )
}
