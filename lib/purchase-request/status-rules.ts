import type { PRStatus } from "@/types/purchase-request"

// Minimal shape needed to evaluate these rules — callers can pass either the
// full PurchaseRequestItem or a lightweight draft with just these fields.
interface FulfillmentItem {
  fulfillment_source:  string
  po_number?:          string | null
  procurement_status?: string
  received?:           boolean
}

// STOK_INTERNAL items are always implicitly ready (no vendor/PO involved).
// BELI_BARU items are ready only once Purchasing has marked them PURCHASED.
export function isWarehouseReady(item: FulfillmentItem): boolean {
  return item.fulfillment_source === "STOK_INTERNAL" || item.procurement_status === "PURCHASED"
}

// What actually gates the Warehouse checklist / SJ-upload selection — fully
// decoupled from the parent PR's status, which is what lets a hybrid PR's
// STOK_INTERNAL items become receivable immediately while sibling BELI_BARU
// items are still working through payment/PO.
export function isCheckoffEligible(item: FulfillmentItem): boolean {
  return isWarehouseReady(item) && !item.received
}

// Gate for the per-item "Tandai Dibeli" action — a PO must already be set.
export function canMarkPurchased(item: FulfillmentItem): boolean {
  return item.fulfillment_source === "BELI_BARU" && Boolean(item.po_number?.trim())
}

// The only two manual, user-triggered edges left. Everything else
// (WAITING_PAYMENT -> PURCHASED -> ARRIVED_AT_WAREHOUSE -> COMPLETED) is
// derived automatically from item state by deriveOverallStatus below and
// persisted directly — never routed through this transition table.
export function getLegalNextStatuses(status: PRStatus): PRStatus[] {
  switch (status) {
    case "DRAFT":
      return ["WAITING_PAYMENT", "REJECTED"]
    case "WAITING_PAYMENT":
    case "PURCHASED":
    case "ARRIVED_AT_WAREHOUSE":
      return ["REJECTED"]
    case "COMPLETED":
    case "REJECTED":
    default:
      return []
  }
}

export function describeTransition(from: PRStatus, to: PRStatus): string {
  if (from === "DRAFT" && to === "WAITING_PAYMENT") return "Setujui → Menunggu Pembayaran"
  if (to === "REJECTED") return "Tolak / Batalkan PR"
  return `Ubah ke ${to}`
}

// The PR's status is a derived, display-only aggregate of its items' actual
// procurement/receiving progress — except DRAFT and REJECTED, which stay
// explicit and manual (nothing here can move a PR into or out of either).
// Recomputed server-side after every item mutation (fulfillment/PO edit,
// mark purchased, receive, undo-receipt) and persisted directly; it can
// legitimately move backward (e.g. undoing the last receipt on a COMPLETED
// PR correctly un-derives it back to ARRIVED_AT_WAREHOUSE).
export function deriveOverallStatus<T extends FulfillmentItem>(items: T[], currentStatus: PRStatus): PRStatus {
  if (currentStatus === "DRAFT" || currentStatus === "REJECTED") return currentStatus
  if (items.length === 0) return currentStatus

  if (items.every(i => i.received)) return "COMPLETED"
  if (items.some(i => i.received)) return "ARRIVED_AT_WAREHOUSE"

  if (items.every(isWarehouseReady)) {
    // Real purchasing happened somewhere in this PR -> show "Sudah Dibayar"
    // as a checkpoint. A pure-internal PR (zero BELI_BARU items ever) has
    // nothing to checkpoint, so it skips straight to "Sampai di Gudang".
    return items.some(i => i.fulfillment_source === "BELI_BARU") ? "PURCHASED" : "ARRIVED_AT_WAREHOUSE"
  }

  return "WAITING_PAYMENT"
}
