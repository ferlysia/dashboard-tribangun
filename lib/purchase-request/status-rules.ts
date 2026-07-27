import type { PRStatus } from "@/types/purchase-request"

// Minimal shape needed to evaluate these rules — callers can pass either the
// full PurchaseRequestItem or a lightweight draft with just these fields.
interface FulfillmentItem {
  fulfillment_source: string
  po_number?:          string | null
}

export function isAllStokInternal(items: FulfillmentItem[]): boolean {
  return items.length > 0 && items.every(i => i.fulfillment_source === "STOK_INTERNAL")
}

// ARRIVED_AT_WAREHOUSE -> COMPLETED is intentionally not listed here — it
// happens automatically once every item on the PR has been received across
// however many partial Surat Jalan uploads it took (see the surat-jalan
// route), not via a manual status-transition request.
export function getLegalNextStatuses(status: PRStatus, items: FulfillmentItem[]): PRStatus[] {
  switch (status) {
    case "DRAFT":
      return isAllStokInternal(items) ? ["PURCHASED", "REJECTED"] : ["WAITING_PAYMENT", "REJECTED"]
    case "WAITING_PAYMENT":
      return ["PURCHASED", "REJECTED"]
    case "PURCHASED":
      return ["ARRIVED_AT_WAREHOUSE", "REJECTED"]
    case "ARRIVED_AT_WAREHOUSE":
      return ["REJECTED"]
    case "COMPLETED":
    case "REJECTED":
    default:
      return []
  }
}

// UI label for a given legal edge — the DRAFT bypass (skipping straight to
// PURCHASED because every item is stock-sourced) reads differently from the
// normal "approve into payment" edge, even though both start at DRAFT. The
// (from, to) pair alone is enough to disambiguate every edge getLegalNextStatuses
// can produce, so no item data is needed here.
export function describeTransition(from: PRStatus, to: PRStatus): string {
  if (from === "DRAFT" && to === "PURCHASED") return "Setujui → Langsung Dibeli (Stok Internal)"
  if (from === "DRAFT" && to === "WAITING_PAYMENT") return "Setujui → Menunggu Pembayaran"
  if (to === "PURCHASED") return "Tandai Sudah Dibayar"
  if (to === "ARRIVED_AT_WAREHOUSE") return "Tandai Sampai di Gudang"
  if (to === "REJECTED") return "Tolak / Batalkan PR"
  return `Ubah ke ${to}`
}

// Every BELI_BARU item must have a PO number before the PR can be marked
// PURCHASED — vacuously satisfied for the all-STOK_INTERNAL bypass edge,
// since there are no BELI_BARU items to check.
export function validateBeliBaruPoNumbers(items: FulfillmentItem[]): string | null {
  const missing = items.some(i => i.fulfillment_source === "BELI_BARU" && !i.po_number?.trim())
  if (missing) return "Setiap item Beli Baru harus memiliki No. PO sebelum ditandai Sudah Dibayar."
  return null
}
