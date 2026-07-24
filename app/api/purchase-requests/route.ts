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
      `?select=*,purchase_request_items(*)` +
      `&order=created_at.desc`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())

    const rows = await res.json()
    const data = rows.map((r: Record<string, unknown>) => {
      const { purchase_request_items, ...rest } = r
      return { ...rest, items: purchase_request_items ?? [] }
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
  qty:         number
  satuan:      string
  nama_barang: string
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

    // 1. Generate the sequential PR number
    const rpcRes = await fetch(`${supabaseConfig.url}/rest/v1/rpc/fn_next_pr_no`, {
      method:  "POST",
      headers: headers(),
      body:    JSON.stringify({ p_date: permintaan_tanggal }),
    })
    if (!rpcRes.ok) throw new Error(await rpcRes.text())
    const pr_no = await rpcRes.json()

    // 2. Insert the header
    const headerRes = await fetch(`${supabaseConfig.url}/rest/v1/purchase_requests`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify({
        pr_no,
        site_maintenance,
        unit,
        permintaan_tanggal,
        status:       "DRAFT",
        requested_by: requested_by || null,
        notes:        notes || null,
      }),
    })
    if (!headerRes.ok) throw new Error(await headerRes.text())
    const [created] = await headerRes.json()

    // 3. Bulk-insert items
    const itemRows = items.map((it, idx) => ({
      purchase_request_id: created.id,
      line_no:             idx + 1,
      qty:                 Number(it.qty),
      satuan:               it.satuan,
      nama_barang:          it.nama_barang,
    }))
    const itemsRes = await fetch(`${supabaseConfig.url}/rest/v1/purchase_request_items`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify(itemRows),
    })
    if (!itemsRes.ok) throw new Error(await itemsRes.text())
    const insertedItems = await itemsRes.json()

    await logActivity({
      actorEmail: requested_by,
      action:     "PR_CREATED",
      entityId:   created.id,
      summary:    `PR ${pr_no} dibuat untuk ${site_maintenance} (${unit})`,
      payload:    { pr_no, item_count: itemRows.length },
    })

    return NextResponse.json({ data: { ...created, items: insertedItems } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create purchase request" },
      { status: 500 }
    )
  }
}
