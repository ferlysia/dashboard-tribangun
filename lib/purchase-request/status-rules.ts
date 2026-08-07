import type { PRStatus, PurchaseRequestRecord } from "@/types/purchase-request"

// Minimal shape needed to evaluate these rules — callers can pass either the
// full PurchaseRequestItem or a lightweight draft with just these fields.
interface FulfillmentItem {
  fulfillment_source:  string
  po_number?:          string | null
  procurement_status?: string
  warehouse_status?:   string
  item_type?:          string
}

// Warehouse's stock-check queue: MATERIAL items awaiting handover, not yet
// visible to Purchasing. NON_MATERIAL items never enter this (they start
// life at BELI_BARU, enforced by the DB trigger + guard constraint).
export function needsStockValidation(item: FulfillmentItem): boolean {
  return item.item_type === "MATERIAL" && item.fulfillment_source === "PENDING_STOCK_CHECK"
}

// Purchasing's worklist: items Warehouse has handed off (or that bypassed
// Warehouse entirely) and haven't been purchased yet. Mutually exclusive
// with needsStockValidation by construction — same column, different value.
export function isReadyToBuy(item: FulfillmentItem): boolean {
  return item.fulfillment_source === "BELI_BARU" && item.procurement_status === "AWAITING_PAYMENT"
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

// Gate for the per-item "Tandai Dibeli" action. PO number is optional —
// urgent no-PO checkouts (e.g. e-commerce) must still be markable.
export function canMarkPurchased(item: FulfillmentItem): boolean {
  return item.fulfillment_source === "BELI_BARU"
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
    case "PENDING_STOCK_CHECK":
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

// A PR belongs in the "Sampai di Gudang" bucket the moment ANY of its items
// has entered Warehouse Operations' pipeline (hasEnteredWarehousePipeline) —
// independent of whether every item has, and independent of which of the 3
// warehouse steps that item is actually at. Shared by the main PR table's
// tab filter, the paginated GET route's ARRIVED_AT_WAREHOUSE bucket
// (app/api/purchase-requests/route.ts), the counts route, and the
// client-side cache-eviction logic (use-purchase-requests.ts) — kept in one
// place so all four can never drift apart.
export function isInGudangPipeline(pr: Pick<PurchaseRequestRecord, "status" | "items">): boolean {
  return pr.status !== "DRAFT" && pr.status !== "REJECTED" && pr.status !== "COMPLETED" &&
    pr.items.some(hasEnteredWarehousePipeline)
}

// A PR belongs in Warehouse's stock-check queue while ANY MATERIAL item is
// still awaiting the handover decision.
export function isInStockCheckQueue(pr: Pick<PurchaseRequestRecord, "items">): boolean {
  return pr.items.some(needsStockValidation)
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

  // At least one MATERIAL item is still awaiting Warehouse's stock-check
  // handover — earliest lifecycle stage, precedes WAITING_PAYMENT.
  if (items.some(needsStockValidation)) return "PENDING_STOCK_CHECK"

  return "WAITING_PAYMENT"
}
