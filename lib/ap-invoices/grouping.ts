import type { ApInvoice } from "@/types/ap-invoice"

// Pure, framework-free grouping/search helpers — consumed via useMemo in
// client components so heavy grouping never re-runs on unrelated re-renders
// (only when `invoices` or the search query actually changes).

export function matchesSearch(inv: ApInvoice, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    inv.invoice_number.toLowerCase().includes(q) ||
    (inv.po_number?.toLowerCase().includes(q) ?? false) ||
    (inv.ap_vendors?.name?.toLowerCase().includes(q) ?? false)
  )
}

function monthKey(iso: string): string {
  return iso.slice(0, 7) // "YYYY-MM"
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" })
}

export interface SimpleMonthGroup {
  key:   string
  label: string
  rows:  ApInvoice[]
  total: number
}

// Groups a flat row list by the month of `dateField`, most-recent month
// first. Used both standalone (paid history nested inside a vendor's
// profile) and as the inner step of groupHistoryByMonthThenVendor below.
export function groupByMonth(rows: ApInvoice[], dateField: "payment_date" | "invoice_date" = "payment_date"): SimpleMonthGroup[] {
  const map = new Map<string, ApInvoice[]>()
  for (const r of rows) {
    const d = r[dateField]
    if (!d) continue
    const key = monthKey(d)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, groupRows]) => ({ key, label: monthLabel(key), rows: groupRows, total: groupRows.reduce((s, r) => s + r.total_amount, 0) }))
}

export interface VendorGroup {
  vendorId:   string
  vendorName: string
  rows:       ApInvoice[]
  total:      number
}

export interface MonthGroup {
  key:     string
  label:   string
  vendors: VendorGroup[]
  total:   number
  count:   number
}

// Done/History ledger: Month/Year (by payment_date — this is a cash
// outflow ledger, so it's keyed off when money actually left, not the
// invoice date) -> Vendor -> rows.
export function groupHistoryByMonthThenVendor(invoices: ApInvoice[]): MonthGroup[] {
  const months = new Map<string, Map<string, VendorGroup>>()
  for (const inv of invoices) {
    if (!inv.payment_date) continue
    const mKey = monthKey(inv.payment_date)
    if (!months.has(mKey)) months.set(mKey, new Map())
    const vendorMap = months.get(mKey)!
    if (!vendorMap.has(inv.vendor_id)) {
      vendorMap.set(inv.vendor_id, { vendorId: inv.vendor_id, vendorName: inv.ap_vendors?.name ?? "—", rows: [], total: 0 })
    }
    const vg = vendorMap.get(inv.vendor_id)!
    vg.rows.push(inv)
    vg.total += inv.total_amount
  }
  return Array.from(months.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, vendorMap]) => {
      const vendors = Array.from(vendorMap.values()).sort((a, b) => a.vendorName.localeCompare(b.vendorName))
      return { key, label: monthLabel(key), vendors, total: vendors.reduce((s, v) => s + v.total, 0), count: vendors.reduce((s, v) => s + v.rows.length, 0) }
    })
}

export interface VendorProfile {
  vendorId:            string
  vendorName:          string
  totalInvoices:       number
  totalPaidCount:      number
  totalUnpaidCount:    number
  outstandingBalance:  number
  unpaidRows:          ApInvoice[]        // sorted by closest due date first
  paidByMonth:         SimpleMonthGroup[] // most-recent month first
}

// By Vendor master profile: one row per vendor across the vendor's FULL
// invoice history (paid + unpaid), not just the open ones.
export function buildVendorProfiles(invoices: ApInvoice[]): VendorProfile[] {
  const byVendor = new Map<string, ApInvoice[]>()
  for (const inv of invoices) {
    if (!byVendor.has(inv.vendor_id)) byVendor.set(inv.vendor_id, [])
    byVendor.get(inv.vendor_id)!.push(inv)
  }

  const profiles: VendorProfile[] = []
  for (const [vendorId, rows] of byVendor) {
    const unpaidRows = rows
      .filter(r => !r.payment_date)
      .sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1  // open-debt (no due date) sinks to the bottom
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date) // closest due date first
      })
    const paidRows = rows.filter(r => r.payment_date)

    profiles.push({
      vendorId,
      vendorName:         rows[0].ap_vendors?.name ?? "—",
      totalInvoices:       rows.length,
      totalPaidCount:      paidRows.length,
      totalUnpaidCount:    unpaidRows.length,
      outstandingBalance:  unpaidRows.reduce((s, r) => s + r.total_amount, 0),
      unpaidRows,
      paidByMonth: groupByMonth(paidRows, "payment_date"),
    })
  }

  return profiles.sort((a, b) => a.vendorName.localeCompare(b.vendorName))
}
