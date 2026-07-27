import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { deriveOverallStatus, canMarkPurchased } from "@/lib/purchase-request/status-rules"

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

async function fetchFullRecord(id: string) {
  const res = await fetch(
    `${supabaseConfig.url}/rest/v1/purchase_requests` +
    `?id=eq.${id}&select=*,purchase_request_items(*),purchase_request_surat_jalan(*)`,
    { headers: headers() }
  )
  if (!res.ok) throw new Error(await res.text())
  const [row] = await res.json()
  if (!row) return null
  const { purchase_request_items, purchase_request_surat_jalan, ...rest } = row
  return {
    ...rest,
    items:                 purchase_request_items ?? [],
    surat_jalan_documents: purchase_request_surat_jalan ?? [],
  }
}

type ItemRow = {
  id:                  string
  fulfillment_source:  string
  po_number:           string | null
  procurement_status:  string
  received:            boolean
}

// The item, not the PR, is the unit of procurement progress. This endpoint
// handles every per-item mutation once a PR has left DRAFT:
//   - {received:false}                    undo a mistaken receipt
//   - {fulfillment_source, po_number}      (re)assign Sumber / No. PO
//   - {procurement_status}                 mark Beli Baru purchased / undo
// After any mutation, the parent PR's (derived, display-only) status is
// recomputed from its full item list and persisted if it changed.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    const body = await request.json()

    const prRes = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_requests` +
      `?id=eq.${id}&select=id,pr_no,status,purchase_request_items(id,fulfillment_source,po_number,procurement_status,received)`,
      { headers: headers() }
    )
    if (!prRes.ok) throw new Error(await prRes.text())
    const [pr] = await prRes.json()
    if (!pr) return NextResponse.json({ error: "Purchase request not found" }, { status: 404 })

    const items = (pr.purchase_request_items ?? []) as ItemRow[]
    const item = items.find(it => it.id === itemId)
    if (!item) return NextResponse.json({ error: "Item not found on this PR" }, { status: 404 })

    if (pr.status === "DRAFT" || pr.status === "REJECTED") {
      return NextResponse.json(
        { error: "Item hanya dapat diubah setelah PR disetujui dan sebelum ditolak" },
        { status: 400 }
      )
    }

    let itemPatch: Record<string, unknown>

    if (body.received === false) {
      itemPatch = { received: false, received_at: null, surat_jalan_id: null }
    } else if (body.fulfillment_source !== undefined) {
      if (item.received) {
        return NextResponse.json({ error: "Item yang sudah diterima tidak dapat diubah sumbernya" }, { status: 400 })
      }
      const source = body.fulfillment_source === "STOK_INTERNAL" ? "STOK_INTERNAL" : "BELI_BARU"
      itemPatch = {
        fulfillment_source: source,
        po_number:          source === "STOK_INTERNAL" ? null : (String(body.po_number ?? "").trim() || null),
        // Any source change resets procurement progress — conservative and
        // always safe, avoids a stale "already purchased" flag surviving a
        // flip back to BELI_BARU with no PO.
        procurement_status: "AWAITING_PAYMENT",
      }
    } else if (body.procurement_status === "PURCHASED" || body.procurement_status === "AWAITING_PAYMENT") {
      if (item.received) {
        return NextResponse.json({ error: "Item yang sudah diterima tidak dapat diubah statusnya" }, { status: 400 })
      }
      if (body.procurement_status === "PURCHASED" && !canMarkPurchased(item)) {
        return NextResponse.json({ error: "Isi No. PO terlebih dahulu sebelum menandai Dibeli" }, { status: 400 })
      }
      itemPatch = { procurement_status: body.procurement_status }
    } else {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const patchRes = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_request_items?id=eq.${itemId}&purchase_request_id=eq.${id}`,
      { method: "PATCH", headers: { ...headers(), Prefer: "return=representation" }, body: JSON.stringify(itemPatch) }
    )
    if (!patchRes.ok) throw new Error(await patchRes.text())
    const patchedRows = await patchRes.json()
    if (patchedRows.length === 0) return NextResponse.json({ error: "Item not found on this PR" }, { status: 404 })
    const updatedItem = patchedRows[0] as ItemRow

    const itemsAfter = items.map(it => it.id === itemId ? updatedItem : it)
    const nextStatus = deriveOverallStatus(itemsAfter, pr.status)
    if (nextStatus !== pr.status) {
      const headerPatch: Record<string, unknown> = { status: nextStatus }
      if (nextStatus === "COMPLETED") headerPatch.sj_status = "BILLING_READY"

      const headerRes = await fetch(
        `${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${id}`,
        { method: "PATCH", headers: headers(), body: JSON.stringify(headerPatch) }
      )
      if (!headerRes.ok) throw new Error(await headerRes.text())

      logActivity({
        action:   "PR_STATUS_CHANGED",
        entityId: id,
        summary:  `PR ${pr.pr_no} status diubah dari ${pr.status} ke ${nextStatus}`,
        payload:  { from: pr.status, to: nextStatus },
      })
    }

    const data = await fetchFullRecord(id)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update item" },
      { status: 500 }
    )
  }
}
