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
  DRAFT:           ["WAITING_PAYMENT", "REJECTED"],
  WAITING_PAYMENT: ["PURCHASED", "REJECTED"],
  PURCHASED:       ["COMPLETED", "REJECTED"],
  COMPLETED:       [],
  REJECTED:        [],
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
