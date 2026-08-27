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

interface ItemInput {
  qty:         number
  satuan:      string
  nama_barang: string
  item_type?:  string
}

// Mirrors buildItemRow in app/api/purchase-requests/route.ts — item_type
// drives the initial fulfillment_source via the DB trigger (see
// 20260808_purchase_request_item_type_stock_gate.sql), so fulfillment_source
// is deliberately left unset here and always trigger-assigned. Unlike PR
// creation, a manually-added item never needs the "forced source" escape
// hatch that route supports (that's only for legacy data import).
function buildItemRow(it: ItemInput, purchaseRequestId: string, lineNo: number): Record<string, unknown> {
  return {
    purchase_request_id: purchaseRequestId,
    line_no:             lineNo,
    qty:                 Number(it.qty),
    satuan:              it.satuan,
    nama_barang:         it.nama_barang,
    item_type:           it.item_type === "NON_MATERIAL" ? "NON_MATERIAL" : "MATERIAL",
  }
}

type ItemRow = {
  id:                  string
  item_type:           string
  fulfillment_source:  string
  procurement_status:  string
  warehouse_status:    string
}

// Appends one or more new lines to an already-created PR (e.g. an additional
// request that surfaces after submission), so the admin isn't forced to spin
// up a brand-new PR number for it. Distinct from POST /api/purchase-requests
// (initial creation, header + items in one call) — this only ever adds items
// to an existing header, gated the same way item-level workflow edits are
// (itemsEditable in page.tsx / the DRAFT-REJECTED guard in
// [itemId]/route.ts): a PR with no separate draft step is either "live" and
// can grow, or REJECTED/DRAFT and shouldn't be touched here.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { items, actor_email } = body as { items: ItemInput[]; actor_email?: string }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 })
    }
    for (const it of items) {
      if (!(Number(it.qty) > 0) || !it.satuan?.trim() || !it.nama_barang?.trim()) {
        return NextResponse.json(
          { error: "Every item requires qty > 0, satuan, and nama_barang" },
          { status: 400 }
        )
      }
    }

    const prRes = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_requests` +
      `?id=eq.${id}&select=*,purchase_request_items(*),purchase_request_surat_jalan(*)`,
      { headers: headers() }
    )
    if (!prRes.ok) throw new Error(await prRes.text())
    const [prRow] = await prRes.json()
    if (!prRow) return NextResponse.json({ error: "Purchase request not found" }, { status: 404 })
    const { purchase_request_items, purchase_request_surat_jalan, ...prHeader } = prRow

    if (prHeader.status === "DRAFT" || prHeader.status === "REJECTED") {
      return NextResponse.json(
        { error: "Tidak dapat menambah item pada PR berstatus Draft atau Ditolak" },
        { status: 400 }
      )
    }

    const existingItems = (purchase_request_items ?? []) as (ItemRow & { line_no: number })[]
    let nextLineNo = existingItems.reduce((max, it) => Math.max(max, it.line_no), 0) + 1
    const itemRows = items.map(it => buildItemRow(it, id, nextLineNo++))

    const insertRes = await fetch(`${supabaseConfig.url}/rest/v1/purchase_request_items`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify(itemRows),
    })
    if (!insertRes.ok) throw new Error(await insertRes.text())
    const insertedItems = await insertRes.json() as ItemRow[]

    const itemsAfter = [...existingItems, ...insertedItems]
    const nextStatus = deriveOverallStatus(itemsAfter, prHeader.status)

    let responseHeader = prHeader
    if (nextStatus !== prHeader.status) {
      const statusRes = await fetch(`${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${id}`, {
        method:  "PATCH",
        headers: { ...headers(), Prefer: "return=representation" },
        body:    JSON.stringify({ status: nextStatus }),
      })
      if (!statusRes.ok) throw new Error(await statusRes.text())
      const [updatedHeader] = await statusRes.json()
      responseHeader = updatedHeader
    }

    logActivity({
      actorEmail: actor_email,
      action:     "PR_ITEMS_ADDED",
      entityId:   id,
      summary:    `${insertedItems.length} item baru ditambahkan ke PR ${prHeader.pr_no}`,
      payload:    { item_count: insertedItems.length, next_status: nextStatus },
    })

    const data = {
      ...responseHeader,
      items:                 itemsAfter,
      surat_jalan_documents: purchase_request_surat_jalan ?? [],
    }
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add items" },
      { status: 500 }
    )
  }
}
