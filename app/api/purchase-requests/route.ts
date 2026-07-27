import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

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

export async function GET() {
  try {
    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_requests` +
      `?select=*,purchase_request_items(*),purchase_request_surat_jalan(*)` +
      `&order=created_at.desc`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())

    const rows = await res.json()
    const data = rows.map((r: Record<string, unknown>) => {
      const { purchase_request_items, purchase_request_surat_jalan, ...rest } = r
      return {
        ...rest,
        items:                 purchase_request_items ?? [],
        surat_jalan_documents: purchase_request_surat_jalan ?? [],
      }
    })

    return NextResponse.json({ data })
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
  fulfillment_source?: string
  po_number?:          string | null
}

function normalizeFulfillment(it: ItemInput): { fulfillment_source: string; po_number: string | null } {
  const source = it.fulfillment_source === "STOK_INTERNAL" ? "STOK_INTERNAL" : "BELI_BARU"
  return { fulfillment_source: source, po_number: source === "STOK_INTERNAL" ? null : (it.po_number?.trim() || null) }
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
    const itemRows = items.map((it, idx) => ({
      purchase_request_id: created.id,
      line_no:             idx + 1,
      qty:                 Number(it.qty),
      satuan:               it.satuan,
      nama_barang:          it.nama_barang,
      ...normalizeFulfillment(it),
    }))
    const itemsRes = await fetch(`${supabaseConfig.url}/rest/v1/purchase_request_items`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=minimal" },
      body:    JSON.stringify(itemRows),
    })
    if (!itemsRes.ok) throw new Error(await itemsRes.text())

    // Best-effort — the response doesn't wait on this.
    logActivity({
      actorEmail: requested_by,
      action:     "PR_CREATED",
      entityId:   created.id,
      summary:    `PR ${created.pr_no} dibuat untuk ${site_maintenance} (${unit})`,
      payload:    { pr_no: created.pr_no, item_count: itemRows.length },
    })

    return NextResponse.json({ data: { ...created, items: itemRows } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create purchase request" },
      { status: 500 }
    )
  }
}
