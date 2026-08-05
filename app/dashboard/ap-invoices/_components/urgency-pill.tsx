"use client"

import type { ApInvoice } from "@/types/ap-invoice"
import { computeInvoiceUrgency, type Urgency } from "@/lib/ap-invoices/status-rules"

function formatPaidDate(iso: string) {
  // Matches the requirement's exact example format: "12 Aug 2026".
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

// Vibrant, high-contrast, solid-tinted pills — no dull flat grays. Each
// urgency gets its own saturated color family with a matching ring for pop.
const URGENCY_CFG: Record<Urgency, { emoji: string; label: (days: number, paymentDate: string | null) => string; badge: string }> = {
  DRAFT:     {
    emoji: "📝",
    label: () => "Draft",
    badge: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-300 dark:bg-slate-800/60 dark:text-slate-400 dark:ring-slate-700 font-medium italic",
  },
  OVERDUE:   {
    emoji: "🔴",
    label: d => `Lewat ${Math.abs(d)} hari`,
    badge: "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800 font-bold",
  },
  PRIORITY:  {
    emoji: "🟠",
    label: d => (d === 0 ? "Jatuh tempo hari ini" : `${d} hari lagi`),
    badge: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800 font-bold",
  },
  SAFE:      {
    emoji: "🟢",
    label: d => `${d} hari lagi`,
    badge: "bg-teal-100 text-teal-700 ring-1 ring-inset ring-teal-300 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-800 font-semibold",
  },
  OPEN_DEBT: {
    emoji: "🟣",
    label: d => `Aging ${d} hari`,
    badge: "bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-300 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800 font-semibold",
  },
  PAID:      {
    emoji: "✅",
    // The requirement: PAID must explicitly show the actual payment date,
    // Day/Month/Year, inside the pill — never just a bare "Paid" label.
    label: (_d, paymentDate) => (paymentDate ? `Paid: ${formatPaidDate(paymentDate)}` : "Paid"),
    badge: "bg-pink-100 text-pink-700 ring-1 ring-inset ring-pink-300 dark:bg-pink-950/40 dark:text-pink-300 dark:ring-pink-800 font-semibold",
  },
}

export function UrgencyPill({ invoice, today }: { invoice: Pick<ApInvoice, "due_date" | "invoice_date" | "payment_date">; today?: Date }) {
  const { urgency, days } = computeInvoiceUrgency(invoice, today)
  const cfg = URGENCY_CFG[urgency]
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm ${cfg.badge}`}>
      {cfg.emoji} {cfg.label(days, invoice.payment_date)}
    </span>
  )
}
