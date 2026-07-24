import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import type { PRStatus } from "@/types/purchase-request"

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

const LEGAL_TRANSITIONS: Record<PRStatus, PRStatus[]> = {
  DRAFT:                 ["WAITING_PAYMENT", "REJECTED"],
  WAITING_PAYMENT:       ["PURCHASED", "REJECTED"],
  PURCHASED:             ["ARRIVED_AT_WAREHOUSE", "REJECTED"],
  // ARRIVED_AT_WAREHOUSE -> COMPLETED happens automatically once a signed
  // Surat Jalan is uploaded (see fn_pr_lifecycle_interlock), not via this endpoint.
  ARRIVED_AT_WAREHOUSE: ["REJECTED"],
  COMPLETED:             [],
  REJECTED:              [],
}

// Item quantities/descriptions only make sense to edit before the PR has
// actually been purchased — once PURCHASED or later, Purchasing has already
// acted on the original list.
const EDITABLE_STATUSES: PRStatus[] = ["DRAFT", "WAITING_PAYMENT"]

interface ItemInput {
  qty:         number
  satuan:      string
  nama_barang: string
}

async function fetchOne(id: string) {
  const res = await fetch(
    `${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${id}&select=*`,
    { headers: headers() }
  )
  if (!res.ok) throw new Error(await res.text())
  const rows = await res.json()
  return rows[0] ?? null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // ── Status transition ──────────────────────────────────────────────────
    if (body.status !== undefined) {
      const { status, rejection_reason, actor_email } = body as {
        status: PRStatus; rejection_reason?: string; actor_email?: string
      }

      const current = await fetchOne(id)
      if (!current) return NextResponse.json({ error: "Purchase request not found" }, { status: 404 })

      const allowed = LEGAL_TRANSITIONS[current.status as PRStatus] ?? []
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Cannot move a ${current.status} PR to ${status}` },
          { status: 400 }
        )
      }
      if (status === "REJECTED" && !rejection_reason?.trim()) {
        return NextResponse.json({ error: "rejection_reason is required to reject a PR" }, { status: 400 })
      }

      const patch: Record<string, unknown> = { status }
      if (status === "REJECTED") patch.rejection_reason = rejection_reason!.trim()

      const res = await fetch(
        `${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${id}`,
        { method: "PATCH", headers: { ...headers(), Prefer: "return=representation" }, body: JSON.stringify(patch) }
      )
      if (!res.ok) throw new Error(await res.text())
      const rows = await res.json()

      await logActivity({
        actorEmail: actor_email,
        action:     "PR_STATUS_CHANGED",
        entityId:   id,
        summary:    `PR ${current.pr_no} status diubah dari ${current.status} ke ${status}`,
        payload:    { from: current.status, to: status, rejection_reason: patch.rejection_reason ?? null },
      })

      return NextResponse.json({ data: rows[0] })
    }

    // ── Full edit: header + item replacement ───────────────────────────────
    if (body.items !== undefined) {
      const { items, site_maintenance, unit, permintaan_tanggal, notes, actor_email } = body as {
        items:               ItemInput[]
        site_maintenance?:   string
        unit?:               string
        permintaan_tanggal?: string
        notes?:              string
        actor_email?:        string
      }

      const current = await fetchOne(id)
      if (!current) return NextResponse.json({ error: "Purchase request not found" }, { status: 404 })
      if (!EDITABLE_STATUSES.includes(current.status as PRStatus)) {
        return NextResponse.json(
          { error: "Only DRAFT or WAITING_PAYMENT purchase requests can be edited" },
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

      const headerPatch: Record<string, unknown> = {}
      if (site_maintenance   !== undefined) headerPatch.site_maintenance   = site_maintenance
      if (unit               !== undefined) headerPatch.unit               = unit
      if (permintaan_tanggal !== undefined) headerPatch.permintaan_tanggal = permintaan_tanggal
      if (notes              !== undefined) headerPatch.notes              = notes || null

      let headerRow = current
      if (Object.keys(headerPatch).length > 0) {
        const headerRes = await fetch(
          `${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${id}`,
          { method: "PATCH", headers: { ...headers(), Prefer: "return=representation" }, body: JSON.stringify(headerPatch) }
        )
        if (!headerRes.ok) throw new Error(await headerRes.text())
        ;[headerRow] = await headerRes.json()
      }

      const deleteRes = await fetch(
        `${supabaseConfig.url}/rest/v1/purchase_request_items?purchase_request_id=eq.${id}`,
        { method: "DELETE", headers: headers() }
      )
      if (!deleteRes.ok) throw new Error(await deleteRes.text())

      const itemRows = items.map((it, idx) => ({
        purchase_request_id: id,
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
        actorEmail: actor_email,
        action:     "PR_UPDATED",
        entityId:   id,
        summary:    `PR ${headerRow.pr_no} diedit (${itemRows.length} item)`,
      })

      return NextResponse.json({ data: { ...headerRow, items: insertedItems } })
    }

    // ── Header field corrections ───────────────────────────────────────────
    const { site_maintenance, unit, permintaan_tanggal, notes } = body as {
      site_maintenance?:   string
      unit?:               string
      permintaan_tanggal?: string
      notes?:              string
    }
    const patch: Record<string, unknown> = {}
    if (site_maintenance   !== undefined) patch.site_maintenance   = site_maintenance
    if (unit               !== undefined) patch.unit               = unit
    if (permintaan_tanggal !== undefined) patch.permintaan_tanggal = permintaan_tanggal
    if (notes              !== undefined) patch.notes              = notes || null

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${id}`,
      { method: "PATCH", headers: { ...headers(), Prefer: "return=representation" }, body: JSON.stringify(patch) }
    )
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    return NextResponse.json({ data: rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update purchase request" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const current = await fetchOne(id)
    if (!current) return NextResponse.json({ error: "Purchase request not found" }, { status: 404 })
    if (!["DRAFT", "REJECTED"].includes(current.status)) {
      return NextResponse.json(
        { error: "Only DRAFT or REJECTED purchase requests can be deleted" },
        { status: 400 }
      )
    }

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${id}`,
      { method: "DELETE", headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())

    await logActivity({
      actorEmail: body.actor_email,
      action:     "PR_DELETED",
      entityId:   id,
      summary:    `PR ${current.pr_no} dihapus`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete purchase request" },
      { status: 500 }
    )
  }
}
