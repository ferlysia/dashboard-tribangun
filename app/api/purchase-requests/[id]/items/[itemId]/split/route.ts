import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { deriveOverallStatus, hasEnteredWarehousePipeline } from "@/lib/purchase-request/status-rules"

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

type ItemRow = {
  id:                  string
  fulfillment_source:  string
  po_number:           string | null
  procurement_status:  string
  warehouse_status:    string
  parent_item_id:      string | null
}

async function loadPr(id: string) {
  const prRes = await fetch(
    `${supabaseConfig.url}/rest/v1/purchase_requests` +
    `?id=eq.${id}&select=*,purchase_request_items(*),purchase_request_surat_jalan(*)`,
    { headers: headers() }
  )
  if (!prRes.ok) throw new Error(await prRes.text())
  const [row] = await prRes.json()
  if (!row) return null
  const { purchase_request_items, purchase_request_surat_jalan, ...prHeader } = row
  return {
    prHeader,
    items:                 (purchase_request_items ?? []) as ItemRow[],
    surat_jalan_documents: purchase_request_surat_jalan ?? [],
  }
}

// See persistDerivedStatusInBackground in ../route.ts for the rationale —
// this is a derived, display-only aggregate; a failed/delayed write here
// only leaves it briefly stale, so it doesn't need to block the response.
function persistDerivedStatusInBackground(
  id: string,
  pr: { pr_no: string; status: string },
  nextStatus: string,
  headerPatch: Record<string, unknown>
) {
  fetch(`${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${id}`, {
    method: "PATCH", headers: headers(), body: JSON.stringify(headerPatch),
  })
    .then(res => { if (!res.ok) return res.text().then(text => Promise.reject(new Error(text))) })
    .then(() => {
      logActivity({
        action:   "PR_STATUS_CHANGED",
        entityId: id,
        summary:  `PR ${pr.pr_no} status diubah dari ${pr.status} ke ${nextStatus}`,
        payload:  { from: pr.status, to: nextStatus },
      })
    })
    .catch(err => console.error(`Failed to persist derived status for PR ${id}:`, err))
}

function deriveAndRespond(
  id: string,
  prHeader: Record<string, unknown> & { status: string; pr_no: string },
  surat_jalan_documents: unknown[],
  itemsAfter: ItemRow[]
) {
  const nextStatus = deriveOverallStatus(itemsAfter, prHeader.status as never)
  let responseHeader = prHeader
  if (nextStatus !== prHeader.status) {
    const headerPatch: Record<string, unknown> = { status: nextStatus }
    if (nextStatus === "COMPLETED") headerPatch.sj_status = "BILLING_READY"
    responseHeader = { ...prHeader, ...headerPatch }
    persistDerivedStatusInBackground(id, prHeader, nextStatus, headerPatch)
  }
  return { ...responseHeader, items: itemsAfter, surat_jalan_documents }
}

// Splits a pre-pipeline item into a BELI_BARU remainder (this item id, qty
// reduced) and a new STOK_INTERNAL sibling row (parent_item_id = this item
// id) for the split-off qty. Delegates the atomic mutate+insert to
// fn_split_purchase_request_item (see the 20260730 migration) — every
// status-rules.ts predicate already operates per-item over the full items
// array, so no other endpoint needs to change. Only two DB round trips on
// the critical path: the upfront fetch and the RPC call itself.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    const body = await request.json()
    const stok_internal_qty = Number(body.stok_internal_qty)
    if (!(stok_internal_qty > 0)) {
      return NextResponse.json({ error: "stok_internal_qty harus lebih dari 0" }, { status: 400 })
    }

    const loaded = await loadPr(id)
    if (!loaded) return NextResponse.json({ error: "Purchase request not found" }, { status: 404 })
    const { prHeader, items, surat_jalan_documents } = loaded
    const item = items.find(it => it.id === itemId)
    if (!item) return NextResponse.json({ error: "Item not found on this PR" }, { status: 404 })

    if (prHeader.status === "DRAFT" || prHeader.status === "REJECTED") {
      return NextResponse.json(
        { error: "Item hanya dapat diubah setelah PR disetujui dan sebelum ditolak" },
        { status: 400 }
      )
    }
    if (hasEnteredWarehousePipeline(item)) {
      return NextResponse.json({ error: "Item yang sudah masuk pipeline gudang tidak dapat displit" }, { status: 400 })
    }

    const rpcRes = await fetch(`${supabaseConfig.url}/rest/v1/rpc/fn_split_purchase_request_item`, {
      method:  "POST",
      headers: headers(),
      body: JSON.stringify({ p_item_id: itemId, p_stok_internal_qty: stok_internal_qty }),
    })
    if (!rpcRes.ok) throw new Error(await rpcRes.text())
    const splitRows = (await rpcRes.json()) as ItemRow[]

    const parentAfter = splitRows.find(r => r.id === itemId)
    const childAfter  = splitRows.find(r => r.id !== itemId)
    const itemsAfter: ItemRow[] = [
      ...items.filter(it => it.id !== itemId),
      ...(parentAfter ? [parentAfter] : []),
      ...(childAfter ? [childAfter] : []),
    ]

    const data = deriveAndRespond(id, prHeader, surat_jalan_documents, itemsAfter)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to split item" },
      { status: 500 }
    )
  }
}

// Undoes a split: merges a still-PENDING STOK_INTERNAL child back into its
// BELI_BARU parent (qty restored, child row deleted). itemId here is the
// CHILD row's id. Only legal while Warehouse hasn't started physical
// verification (warehouse_status must still be PENDING) — enforced in
// fn_unsplit_purchase_request_item.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params

    const loaded = await loadPr(id)
    if (!loaded) return NextResponse.json({ error: "Purchase request not found" }, { status: 404 })
    const { prHeader, items, surat_jalan_documents } = loaded
    const item = items.find(it => it.id === itemId)
    if (!item) return NextResponse.json({ error: "Item not found on this PR" }, { status: 404 })
    if (!item.parent_item_id) {
      return NextResponse.json({ error: "Item ini bukan hasil split" }, { status: 400 })
    }

    const rpcRes = await fetch(`${supabaseConfig.url}/rest/v1/rpc/fn_unsplit_purchase_request_item`, {
      method:  "POST",
      headers: headers(),
      body: JSON.stringify({ p_child_item_id: itemId }),
    })
    if (!rpcRes.ok) throw new Error(await rpcRes.text())
    const parentAfter = (await rpcRes.json()) as ItemRow

    const itemsAfter: ItemRow[] = [
      ...items.filter(it => it.id !== itemId && it.id !== parentAfter.id),
      parentAfter,
    ]

    const data = deriveAndRespond(id, prHeader, surat_jalan_documents, itemsAfter)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unsplit item" },
      { status: 500 }
    )
  }
}
