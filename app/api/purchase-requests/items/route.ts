import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import type { PurchaseRequestItem, PurchaseRequestRecord } from "@/types/purchase-request"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export interface PaginatedItemRow {
  item: PurchaseRequestItem
  pr:   PurchaseRequestRecord
}

// Backs the "Validasi Stok" (Warehouse) and "Ready to Buy" (Purchasing)
// worklists. These are item-granularity, not PR-granularity — a single PR
// can contribute many qualifying items, and bulk actions operate on item
// ids — so unlike the main /api/purchase-requests route this paginates
// purchase_request_items directly, embedding the parent PR via the same
// !inner-join filter pattern used in app/api/pm-schedules/route.ts
// (sites!inner(*) + sites.region=eq.JABO).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const queue  = searchParams.get("queue")
    const cursor = searchParams.get("cursor")
    const limit  = Math.min(Number(searchParams.get("limit")) || 30, 100)
    const q      = searchParams.get("q")?.trim()

    if (queue !== "stock_check" && queue !== "ready_to_buy") {
      return NextResponse.json({ error: "queue must be 'stock_check' or 'ready_to_buy'" }, { status: 400 })
    }

    const queueFilter = queue === "stock_check"
      ? `&item_type=eq.MATERIAL&fulfillment_source=eq.PENDING_STOCK_CHECK`
      : `&fulfillment_source=eq.BELI_BARU&procurement_status=eq.AWAITING_PAYMENT`

    // Same opaque-string cursor rule as /api/purchase-requests/route.ts —
    // created_at is never parsed into a JS Date, to preserve Postgres'
    // microsecond precision across the round trip.
    let cursorFilter = ""
    if (cursor) {
      const sep = cursor.lastIndexOf("_")
      const cursorCreatedAt = decodeURIComponent(cursor.slice(0, sep))
      const cursorId        = cursor.slice(sep + 1)
      cursorFilter =
        `&or=(created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId}))`
    }

    const qFilter = q
      ? `&or=(purchase_requests.pr_no.ilike.*${q}*,purchase_requests.site_maintenance.ilike.*${q}*,purchase_requests.unit.ilike.*${q}*)`
      : ""

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_request_items` +
      `?select=*,purchase_requests!inner(*)` +
      queueFilter + qFilter + cursorFilter +
      `&order=created_at.desc,id.desc&limit=${limit}`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())

    const rows = await res.json() as Record<string, unknown>[]
    const data: PaginatedItemRow[] = rows.map(row => {
      const { purchase_requests, ...item } = row
      return { item: item as unknown as PurchaseRequestItem, pr: purchase_requests as unknown as PurchaseRequestRecord }
    })

    const last = rows[rows.length - 1]
    const nextCursor = rows.length === limit && last
      ? `${encodeURIComponent(last.created_at as string)}_${last.id as string}`
      : null

    return NextResponse.json({ data, nextCursor })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load purchase request items" },
      { status: 500 }
    )
  }
}
