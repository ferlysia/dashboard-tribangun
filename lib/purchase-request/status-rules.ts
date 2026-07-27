import type { PRStatus } from "@/types/purchase-request"

// Minimal shape needed to evaluate these rules — callers can pass either the
// full PurchaseRequestItem or a lightweight draft with just these fields.
interface FulfillmentItem {
  fulfillment_source:  string
  po_number?:          string | null
  procurement_status?: string
  warehouse_status?:   string
}

// The ONLY gate deciding ProcurementTable ("Sudah Dibayar") vs
// WarehouseTable ("Sampai di Gudang") membership. STOK_INTERNAL items skip
// Purchasing entirely (no vendor/PO involved); BELI_BARU items enter once
// the PO has been placed. Warehouse's own 3-step progress (warehouse_status)
// plays no part in this — an item stays visible in the Warehouse section
// throughout all of its steps, never bounces back to Purchasing.
export function hasEnteredWarehousePipeline(item: FulfillmentItem): boolean {
  return item.fulfillment_source === "STOK_INTERNAL" || item.procurement_status === "PURCHASED"
}

// Step-3 gate: only items Warehouse has already verified (Step 1) AND
// allocated for dispatch (Step 2) may be selected for an SJ batch upload.
export function canSelectForSJ(item: FulfillmentItem): boolean {
  return item.warehouse_status === "READY_FOR_DISPATCH"
}

// Final state — item is linked to an uploaded Surat Jalan. Only ever set by
// the surat-jalan upload route, never a direct manual toggle.
export function isDispatched(item: FulfillmentItem): boolean {
  return item.warehouse_status === "DISPATCHED"
}

// Gate for the per-item "Tandai Dibeli" action — a PO must already be set.
export function canMarkPurchased(item: FulfillmentItem): boolean {
  return item.fulfillment_source === "BELI_BARU" && Boolean(item.po_number?.trim())
}

// Warehouse Operations' 3-step pipeline, forward and backward (corrections).
// DISPATCHED is intentionally absent as a *target* here — it's only ever
// reachable via the surat-jalan upload route (a real file + SJ record must
// exist), never a bare status toggle. Undoing a dispatch (DISPATCHED ->
// READY_FOR_DISPATCH) IS legal here, since that's just clearing the link.
const WAREHOUSE_STEP_ADJACENCY: Record<string, string[]> = {
  PENDING:             ["RECEIVED"],
  RECEIVED:            ["PENDING", "READY_FOR_DISPATCH"],
  READY_FOR_DISPATCH:  ["RECEIVED"],
  DISPATCHED:          ["READY_FOR_DISPATCH"],
}

export function isLegalWarehouseStatusChange(from: string, to: string): boolean {
  return WAREHOUSE_STEP_ADJACENCY[from]?.includes(to) ?? false
}

// The only two manual, user-triggered PR-level edges left. Everything else
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
// procurement/warehouse progress — except DRAFT and REJECTED, which stay
// explicit and manual. Recomputed server-side after every item mutation and
// persisted directly; it can legitimately move backward (e.g. undoing the
// last dispatch on a COMPLETED PR correctly un-derives it back to
// ARRIVED_AT_WAREHOUSE).
export function deriveOverallStatus<T extends FulfillmentItem>(items: T[], currentStatus: PRStatus): PRStatus {
  if (currentStatus === "DRAFT" || currentStatus === "REJECTED") return currentStatus
  if (items.length === 0) return currentStatus

  if (items.every(isDispatched)) return "COMPLETED"

  // Any real warehouse progress at all (even on a single item) means the PR
  // is actively "Sampai di Gudang" — partial fulfillment is the norm, not
  // an edge case (a PR's items routinely arrive/dispatch across multiple
  // separate Surat Jalan over time).
  if (items.some(i => i.warehouse_status !== "PENDING")) return "ARRIVED_AT_WAREHOUSE"

  if (items.every(hasEnteredWarehousePipeline)) {
    // Real purchasing happened somewhere in this PR -> show "Sudah Dibayar"
    // as a checkpoint. A pure-internal PR (zero BELI_BARU items ever) has
    // nothing to checkpoint, so it skips straight to "Sampai di Gudang".
    return items.some(i => i.fulfillment_source === "BELI_BARU") ? "PURCHASED" : "ARRIVED_AT_WAREHOUSE"
  }

  return "WAITING_PAYMENT"
}
