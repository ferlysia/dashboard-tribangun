import rawInvoices from "@/data/invoices-all.normalized.json"
import type { InvoiceRecord } from "@/types/invoice"

export type YearFilter = "all" | "2025" | "2026"

export function getDedupedInvoices(records: InvoiceRecord[]) {
  const deduped = new Map<string, InvoiceRecord>()

  for (const record of records) {
    const existing = deduped.get(record.invoice_no)
    if (!existing) {
      deduped.set(record.invoice_no, record)
      continue
    }

    // Prefer richer records over placeholder carry-overs.
    if (existing.is_placeholder && !record.is_placeholder) {
      deduped.set(record.invoice_no, record)
    }
  }

  return [...deduped.values()].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0
    const dateB = b.date ? new Date(b.date).getTime() : 0
    if (dateA !== dateB) return dateA - dateB
    return a.invoice_no.localeCompare(b.invoice_no)
  })
}

const invoices = getDedupedInvoices(rawInvoices as InvoiceRecord[])

export const YEAR_FILTER_OPTIONS: { value: YearFilter; label: string }[] = [
  { value: "all", label: "All Years" },
  { value: "2025", label: "2025" },
  { value: "2026", label: "2026" },
]

export function getAllInvoices() {
  return invoices
}

export function filterInvoicesByYear(records: InvoiceRecord[], yearFilter: YearFilter) {
  if (yearFilter === "all") return records
  const year = Number(yearFilter)
  return records.filter((invoice) => invoice.year === year)
}

export function getPeriodLabel(yearFilter: YearFilter) {
  return yearFilter === "all" ? "2025-2026" : yearFilter
}

export function getPeriodDescription(yearFilter: YearFilter) {
  return yearFilter === "all" ? "Semua tahun aktif" : `Tahun ${yearFilter}`
}
