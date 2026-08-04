import type { ApInvoice } from "@/types/ap-invoice"

export type Urgency = "PAID" | "OVERDUE" | "PRIORITY" | "SAFE" | "OPEN_DEBT"

// Date-only, local-midnight math — due_date/invoice_date are bare DATE
// columns (e.g. "2026-08-02"), so we avoid UTC-parse/time-of-day drift by
// comparing local midnights throughout.
function toMidnight(input: string | Date): Date {
  if (typeof input === "string") {
    const [y, m, d] = input.split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(input.getFullYear(), input.getMonth(), input.getDate())
}

export function daysBetween(from: string | Date, to: string | Date): number {
  return Math.round((toMidnight(to).getTime() - toMidnight(from).getTime()) / 86_400_000)
}

// Never stored — always derived from payment_date/due_date/invoice_date vs.
// `today`, so an invoice moves into Priority/Overdue tomorrow with zero DB
// writes. Mirrors computeSourcingSla in app/dashboard/purchasing-request.
export function computeInvoiceUrgency(
  inv: Pick<ApInvoice, "due_date" | "invoice_date" | "payment_date">,
  today: Date = new Date()
): { urgency: Urgency; days: number } {
  if (inv.payment_date) return { urgency: "PAID", days: 0 }
  if (!inv.due_date) return { urgency: "OPEN_DEBT", days: daysBetween(inv.invoice_date, today) }

  const days = daysBetween(today, inv.due_date)
  if (days < 0) return { urgency: "OVERDUE", days }
  if (days <= 7) return { urgency: "PRIORITY", days }
  return { urgency: "SAFE", days }
}

export function isPriorityQueue(inv: Pick<ApInvoice, "due_date" | "invoice_date" | "payment_date">, today?: Date): boolean {
  const { urgency } = computeInvoiceUrgency(inv, today)
  return urgency === "OVERDUE" || urgency === "PRIORITY"
}

export function computeTotal(dpp: number, ppn: number, pph: number): number {
  return dpp + ppn - pph
}
