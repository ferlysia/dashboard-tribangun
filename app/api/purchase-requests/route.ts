import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { deriveOverallStatus } from "@/lib/purchase-request/status-rules"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

async function logActivity(input: {
  actorEmail?: string
  action:      string
  entityId:    string
  summary:     string
  payload?:    Record<string, unknown>
}) {
  await fetch(`${supabaseConfig.url}/rest/v1/activity_logs`, {
    method:  "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_email: input.actorEmail || "unknown@local",
      action:      input.action,
      entity_type: "purchase_request",
      entity_id:   input.entityId,
      summary:     input.summary,
      payload:     input.payload || {},
    }),
  }).catch(() => { /* activity log is best-effort */ })
}

function shapeRow(r: Record<string, unknown>) {
  const { purchase_request_items, purchase_request_surat_jalan, ...rest } = r
  return {
    ...rest,
    items:                 purchase_request_items ?? [],
    surat_jalan_documents: purchase_request_surat_jalan ?? [],
  }
}

// "Sampai di Gudang" isn't a literal status match — a PR belongs there once
// ANY item has entered Warehouse Operations' pipeline (see
// hasEnteredWarehousePipeline / isInGudangPipeline in page.tsx), independent
// of the PR's own status column. Reproduced server-side as a two-step query:
// first resolve which PR ids qualify via an inner-join filter against
// purchase_request_items (a filtered embed only returns matching child rows,
// so it can't be used to fetch the full item set), then re-select those PRs
// in full — same two-step shape already used by items/bulk-mark-purchased.
async function fetchGudangPipelineIds(cursorFilter: string, limit: number) {
  const res = await fetch(
    `${supabaseConfig.url}/rest/v1/purchase_requests` +
    `?select=id,created_at,purchase_request_items!inner(fulfillment_source,procurement_status)` +
    `&status=not.in.(DRAFT,REJECTED,COMPLETED)` +
    `&purchase_request_items.or=(fulfillment_source.eq.STOK_INTERNAL,procurement_status.eq.PURCHASED)` +
    cursorFilter +
    `&order=created_at.desc,id.desc&limit=${limit}`,
    { headers: headers() }
  )
  if (!res.ok) throw new Error(await res.text())
  const rawRows = await res.json() as { id: string; created_at: string }[]
  // De-dupe: the inner join repeats a parent row once per matching child, but
  // pagination (limit / nextCursor) must be driven by the raw, pre-dedupe
  // rows — otherwise a PR with 2+ qualifying items shrinks the page below
  // `limit` and the `rows.length === limit` nextCursor check below would
  // stop paginating early even though more rows exist.
  const ids = Array.from(new Set(rawRows.map(r => r.id)))
  return { ids, rawRows }
}

// "Menunggu Validasi Stok" isn't a literal status match either, for the same
// reason as fetchGudangPipelineIds above: a hybrid PR's own status can
// already read PURCHASED/ARRIVED_AT_WAREHOUSE while a sibling MATERIAL item
// is still stuck waiting on Warehouse's stock-check decision
// (needsStockValidation in status-rules.ts). Filtering by status=eq
// undercounts/misses those PRs entirely — this is the bucket counterpart to
// counts/route.ts's identical fix for the tab-badge/filter-pill mismatch.
async function fetchStockCheckQueueIds(cursorFilter: string, limit: number) {
  const res = await fetch(
    `${supabaseConfig.url}/rest/v1/purchase_requests` +
    `?select=id,created_at,purchase_request_items!inner(item_type,fulfillment_source)` +
    `&purchase_request_items.item_type=eq.MATERIAL&purchase_request_items.fulfillment_source=eq.PENDING_STOCK_CHECK` +
    cursorFilter +
    `&order=created_at.desc,id.desc&limit=${limit}`,
    { headers: headers() }
  )
  if (!res.ok) throw new Error(await res.text())
  const rawRows = await res.json() as { id: string; created_at: string }[]
  const ids = Array.from(new Set(rawRows.map(r => r.id)))
  return { ids, rawRows }
}

// "Menunggu Pembayaran" isn't a literal status match either, for the same
// reason as the two bucket fetchers above: a hybrid PR's own status can
// already read ARRIVED_AT_WAREHOUSE/PURCHASED (because a sibling item went
// STOK_INTERNAL or further into the warehouse pipeline) while another item
// is still genuinely stuck awaiting purchase (isReadyToBuy in
// status-rules.ts). Filtering by status=eq undercounts those PRs — this is
// the third occurrence of the same bug pattern, fixed the same way.
async function fetchReadyToBuyQueueIds(cursorFilter: string, limit: number) {
  const res = await fetch(
    `${supabaseConfig.url}/rest/v1/purchase_requests` +
    `?select=id,created_at,purchase_request_items!inner(fulfillment_source,procurement_status)` +
    `&purchase_request_items.fulfillment_source=eq.BELI_BARU&purchase_request_items.procurement_status=eq.AWAITING_PAYMENT` +
    cursorFilter +
    `&order=created_at.desc,id.desc&limit=${limit}`,
    { headers: headers() }
  )
  if (!res.ok) throw new Error(await res.text())
  const rawRows = await res.json() as { id: string; created_at: string }[]
  const ids = Array.from(new Set(rawRows.map(r => r.id)))
  return { ids, rawRows }
}

const BUCKETED_STATUSES = new Set(["ARRIVED_AT_WAREHOUSE", "PENDING_STOCK_CHECK", "WAITING_PAYMENT"])

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get("cursor")
    const limit  = Math.min(Number(searchParams.get("limit")) || 30, 100)
    const status = searchParams.get("status")
    const q      = searchParams.get("q")?.trim()

    // Cursor is the exact, unparsed "<created_at>_<id>" string of the last
    // row of the previous page. created_at is echoed back verbatim (never
    // round-tripped through a JS Date) to avoid losing Postgres' microsecond
    // precision, which would otherwise skip or duplicate rows created within
    // the same millisecond.
    let cursorFilter = ""
    if (cursor) {
      const sep = cursor.lastIndexOf("_")
      const cursorCreatedAt = decodeURIComponent(cursor.slice(0, sep))
      const cursorId        = cursor.slice(sep + 1)
      cursorFilter =
        `&or=(created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId}))`
    }

    // ARRIVED_AT_WAREHOUSE, PENDING_STOCK_CHECK, and WAITING_PAYMENT are all
    // item-derived buckets, not literal status matches — see
    // fetchGudangPipelineIds/fetchStockCheckQueueIds/fetchReadyToBuyQueueIds
    // above. Every other status filters by the purchase_requests.status
    // column directly.
    let idFilter = ""
    let bucketRawRows: { id: string; created_at: string }[] | null = null
    const isBucketedStatus = status !== null && BUCKETED_STATUSES.has(status)
    if (isBucketedStatus) {
      const { ids, rawRows } = status === "ARRIVED_AT_WAREHOUSE" ? await fetchGudangPipelineIds(cursorFilter, limit)
        : status === "PENDING_STOCK_CHECK" ? await fetchStockCheckQueueIds(cursorFilter, limit)
        : await fetchReadyToBuyQueueIds(cursorFilter, limit)
      bucketRawRows = rawRows
      if (ids.length === 0) return NextResponse.json({ data: [], nextCursor: null })
      idFilter = `&id=in.(${ids.map(id => `"${id}"`).join(",")})`
    } else if (status) {
      idFilter = `&status=eq.${status}`
    }

    const qFilter = q
      ? `&or=(pr_no.ilike.*${q}*,site_maintenance.ilike.*${q}*,unit.ilike.*${q}*)`
      : ""

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_requests` +
      `?select=*,purchase_request_items(*),purchase_request_surat_jalan(*)` +
      idFilter + qFilter +
      // Re-apply the cursor here too (not just inside the bucket fetchers)
      // so the non-bucketed status/no-status paths paginate correctly.
      (isBucketedStatus ? "" : cursorFilter) +
      `&order=created_at.desc,id.desc&limit=${limit}`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())

    const rows = await res.json() as Record<string, unknown>[]
    // Re-sort into the id order the full-select query returned in (already
    // created_at.desc,id.desc, matching the id-filter query's own order).
    const data = rows.map(shapeRow)

    const cursorSourceRows = bucketRawRows ?? (rows as { id: string; created_at: string }[])
    const last = cursorSourceRows[cursorSourceRows.length - 1]
    const nextCursor = cursorSourceRows.length === limit && last
      ? `${encodeURIComponent(last.created_at)}_${last.id}`
      : null

    return NextResponse.json({ data, nextCursor })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load purchase requests" },
      { status: 500 }
    )
  }
}

interface ItemInput {
  qty:                 number
  satuan:              string
  nama_barang:         string
  item_type?:          string
  fulfillment_source?: string
  po_number?:          string | null
}

// item_type drives the initial fulfillment_source via a DB trigger (see
// 20260808_purchase_request_item_type_stock_gate.sql) — MATERIAL starts
// PENDING_STOCK_CHECK (Warehouse's queue), NON_MATERIAL starts BELI_BARU
// (Purchasing's queue immediately). We only send an explicit
// fulfillment_source when the caller forces one (e.g. legacy data import);
// otherwise the key is omitted so the column stays NULL and the trigger
// decides — sending a computed default here would silently defeat the gate.
function buildItemRow(it: ItemInput, purchaseRequestId: string, idx: number): Record<string, unknown> {
  const item_type = it.item_type === "NON_MATERIAL" ? "NON_MATERIAL" : "MATERIAL"
  const row: Record<string, unknown> = {
    purchase_request_id: purchaseRequestId,
    line_no:             idx + 1,
    qty:                 Number(it.qty),
    satuan:               it.satuan,
    nama_barang:          it.nama_barang,
    item_type,
  }
  if (it.fulfillment_source === "STOK_INTERNAL" || it.fulfillment_source === "BELI_BARU") {
    row.fulfillment_source = it.fulfillment_source
    row.po_number = it.fulfillment_source === "STOK_INTERNAL" ? null : (it.po_number?.trim() || null)
  }
  return row
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      site_maintenance, unit, permintaan_tanggal,
      items, requested_by, notes,
    } = body as {
      site_maintenance:   string
      unit:               string
      permintaan_tanggal: string
      items:              ItemInput[]
      requested_by?:      string
      notes?:             string
    }

    if (!site_maintenance || !unit || !permintaan_tanggal) {
      return NextResponse.json(
        { error: "site_maintenance, unit, and permintaan_tanggal are required" },
        { status: 400 }
      )
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 })
    }
    for (const it of items) {
      if (!(Number(it.qty) > 0) || !it.satuan || !it.nama_barang) {
        return NextResponse.json(
          { error: "Every item requires qty > 0, satuan, and nama_barang" },
          { status: 400 }
        )
      }
    }

    // 1. Generate the PR number and insert the header in a single round trip
    const headerRes = await fetch(`${supabaseConfig.url}/rest/v1/rpc/fn_create_purchase_request`, {
      method:  "POST",
      headers: headers(),
      body: JSON.stringify({
        p_site_maintenance:   site_maintenance,
        p_unit:               unit,
        p_permintaan_tanggal: permintaan_tanggal,
        p_requested_by:       requested_by || null,
        p_notes:              notes || null,
      }),
    })
    if (!headerRes.ok) throw new Error(await headerRes.text())
    const created = await headerRes.json()

    // 2. Bulk-insert items — response body isn't used by any caller, so skip
    // parsing it (return=minimal avoids Supabase building/transferring it).
    const itemRows = items.map((it, idx) => buildItemRow(it, created.id, idx))
    const itemsRes = await fetch(`${supabaseConfig.url}/rest/v1/purchase_request_items`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=minimal" },
      body:    JSON.stringify(itemRows),
    })
    if (!itemsRes.ok) throw new Error(await itemsRes.text())

    // 3. This app has no separate "save as draft" step — a created PR is
    // immediately submitted, so its status must reflect where its items
    // actually stand (e.g. PENDING_STOCK_CHECK for a MATERIAL item) instead
    // of lingering at the purchase_requests.status column's DRAFT default.
    // deriveOverallStatus early-returns unchanged for a DRAFT/REJECTED
    // currentStatus, so "WAITING_PAYMENT" is passed as a neutral seed purely
    // to bypass that guard — the actual result is fully computed from
    // itemRows, this seed value is never itself returned unless there were
    // zero items, which POST already rejects above.
    const derivedItems = itemRows.map(row => ({
      item_type:           row.item_type as string,
      fulfillment_source:  (row.fulfillment_source as string | undefined)
        ?? (row.item_type === "MATERIAL" ? "PENDING_STOCK_CHECK" : "BELI_BARU"),
      procurement_status:  "AWAITING_PAYMENT",
      warehouse_status:    "PENDING",
    }))
    const initialStatus = deriveOverallStatus(derivedItems, "WAITING_PAYMENT")

    const statusRes = await fetch(`${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${created.id}`, {
      method:  "PATCH",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify({ status: initialStatus }),
    })
    if (!statusRes.ok) throw new Error(await statusRes.text())
    const [updatedHeader] = await statusRes.json()

    // Best-effort — the response doesn't wait on this.
    logActivity({
      actorEmail: requested_by,
      action:     "PR_CREATED",
      entityId:   created.id,
      summary:    `PR ${created.pr_no} dibuat untuk ${site_maintenance} (${unit})`,
      payload:    { pr_no: created.pr_no, item_count: itemRows.length, initial_status: initialStatus },
    })

    return NextResponse.json({ data: { ...updatedHeader, items: itemRows } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create purchase request" },
      { status: 500 }
    )
  }
}
