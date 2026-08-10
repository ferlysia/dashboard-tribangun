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

// PENDING_STOCK_CHECK and WAITING_PAYMENT are excluded here — like
// ARRIVED_AT_WAREHOUSE, neither is a literal status match (see below): a
// hybrid PR's own status column can already read PURCHASED/ARRIVED_AT_WAREHOUSE
// (deriveOverallStatus prioritizes warehouse progress on ANY item) while it
// still has a sibling item stuck waiting on Warehouse's stock-check decision
// or on Purchasing. Counting by status=eq undercounts that real backlog —
// this is exactly what caused the "Validasi Stok"/"Ready to Buy" tab badges
// and their filter pills to disagree with the item-level worklists.
const PLAIN_STATUS_BUCKETS: PRStatus[] = ["DRAFT", "PURCHASED", "COMPLETED", "REJECTED"]

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

    // Each pair below is the shared source of truth for BOTH of its numbers:
    // the item count (what a tab badge shows) and the distinct-PR count
    // (what the matching filter pill shows) come from one fetch each, so
    // they can never drift apart the way they did before this fix.
    const [stockCheckItemsRes, readyToBuyItemsRes] = await Promise.all([
      fetch(
        `${supabaseConfig.url}/rest/v1/purchase_request_items` +
        `?select=id,purchase_request_id&item_type=eq.MATERIAL&fulfillment_source=eq.PENDING_STOCK_CHECK`,
        { headers: headers() }
      ),
      fetch(
        `${supabaseConfig.url}/rest/v1/purchase_request_items` +
        `?select=id,purchase_request_id&fulfillment_source=eq.BELI_BARU&procurement_status=eq.AWAITING_PAYMENT`,
        { headers: headers() }
      ),
    ])
    if (!stockCheckItemsRes.ok) throw new Error(await stockCheckItemsRes.text())
    if (!readyToBuyItemsRes.ok) throw new Error(await readyToBuyItemsRes.text())
    const stockCheckItems = await stockCheckItemsRes.json() as { id: string; purchase_request_id: string }[]
    const readyToBuyItems = await readyToBuyItemsRes.json() as { id: string; purchase_request_id: string }[]
    const stockCheck = stockCheckItems.length
    const readyToBuy = readyToBuyItems.length
    const pendingStockCheckPrCount = new Set(stockCheckItems.map(r => r.purchase_request_id)).size
    const waitingPaymentPrCount    = new Set(readyToBuyItems.map(r => r.purchase_request_id)).size

    const counts: Record<string, number> = {
      ALL: all,
      ARRIVED_AT_WAREHOUSE: arrivedAtWarehouse,
      PENDING_STOCK_CHECK:  pendingStockCheckPrCount,
      WAITING_PAYMENT:      waitingPaymentPrCount,
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
