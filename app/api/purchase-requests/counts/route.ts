import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import type { PRStatus } from "@/types/purchase-request"

function headers(extra?: Record<string, string>) {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  }
}

// Prefer: count=exact + limit=0 gets an exact row count from PostgREST
// without transferring any rows — the count comes back on the
// Content-Range response header ("0-0/<count>" or "*/<count>" when empty).
async function exactCount(query: string): Promise<number> {
  const res = await fetch(
    `${supabaseConfig.url}/rest/v1/${query}`,
    { headers: headers({ Prefer: "count=exact", Range: "0-0" }) }
  )
  if (!res.ok) throw new Error(await res.text())
  const range = res.headers.get("content-range") ?? "*/0"
  return Number(range.split("/")[1] ?? 0)
}

// PENDING_STOCK_CHECK is excluded here — like ARRIVED_AT_WAREHOUSE, it isn't
// a literal status match (see below): a hybrid PR's own status column can
// already read PURCHASED/ARRIVED_AT_WAREHOUSE (deriveOverallStatus prioritizes
// warehouse progress on ANY item) while it still has a sibling MATERIAL item
// stuck waiting on Warehouse's stock-check decision. Counting by status=eq
// undercounts that real backlog — this is exactly what caused the "Validasi
// Stok" tab badge and the "Menunggu Validasi Stok" filter pill to disagree
// (tab: 2 items awaiting validation; pill: 0 PRs literally in that status).
const PLAIN_STATUS_BUCKETS: PRStatus[] = ["DRAFT", "WAITING_PAYMENT", "PURCHASED", "COMPLETED", "REJECTED"]

export async function GET() {
  try {
    const [
      all,
      ...plain
    ] = await Promise.all([
      exactCount("purchase_requests?select=id"),
      ...PLAIN_STATUS_BUCKETS.map(s => exactCount(`purchase_requests?select=id&status=eq.${s}`)),
    ])

    // ARRIVED_AT_WAREHOUSE is an item-derived bucket (see
    // fetchGudangPipelineIds in ../route.ts), not a literal status match, so
    // it can't use a simple status=eq filter — count distinct PR ids via the
    // same inner-join filter instead.
    const gudangRes = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_requests` +
      `?select=id,purchase_request_items!inner(fulfillment_source,procurement_status)` +
      `&status=not.in.(DRAFT,REJECTED,COMPLETED)` +
      `&purchase_request_items.or=(fulfillment_source.eq.STOK_INTERNAL,procurement_status.eq.PURCHASED)`,
      { headers: headers() }
    )
    if (!gudangRes.ok) throw new Error(await gudangRes.text())
    const gudangRows = await gudangRes.json() as { id: string }[]
    const arrivedAtWarehouse = new Set(gudangRows.map(r => r.id)).size

    // Single query is the shared source of truth for BOTH numbers: `stockCheck`
    // (item count — what the "Validasi Stok" tab badge shows) and
    // counts.PENDING_STOCK_CHECK (distinct PR count — what the "Menunggu
    // Validasi Stok" filter pill shows). Deriving both from one fetch means
    // they can never drift apart the way the tab/pill did before.
    const [stockCheckItemsRes, readyToBuy] = await Promise.all([
      fetch(
        `${supabaseConfig.url}/rest/v1/purchase_request_items` +
        `?select=id,purchase_request_id&item_type=eq.MATERIAL&fulfillment_source=eq.PENDING_STOCK_CHECK`,
        { headers: headers() }
      ),
      exactCount(`purchase_request_items?select=id&fulfillment_source=eq.BELI_BARU&procurement_status=eq.AWAITING_PAYMENT`),
    ])
    if (!stockCheckItemsRes.ok) throw new Error(await stockCheckItemsRes.text())
    const stockCheckItems = await stockCheckItemsRes.json() as { id: string; purchase_request_id: string }[]
    const stockCheck = stockCheckItems.length
    const pendingStockCheckPrCount = new Set(stockCheckItems.map(r => r.purchase_request_id)).size

    const counts: Record<string, number> = {
      ALL: all,
      ARRIVED_AT_WAREHOUSE: arrivedAtWarehouse,
      PENDING_STOCK_CHECK:  pendingStockCheckPrCount,
    }
    PLAIN_STATUS_BUCKETS.forEach((s, i) => { counts[s] = plain[i] })

    return NextResponse.json({ counts, stockCheck, readyToBuy })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load purchase request counts" },
      { status: 500 }
    )
  }
}
