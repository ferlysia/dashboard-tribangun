import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { deriveOverallStatus, canSelectForSJ } from "@/lib/purchase-request/status-rules"

const ONEDRIVE_URL_PATTERN = /^https?:\/\/.+/i

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const file_url    = typeof body.file_url === "string" ? body.file_url.trim() : ""
    const uploaded_by = typeof body.uploaded_by === "string" ? body.uploaded_by : null
    const itemIds     = body.item_ids

    if (!ONEDRIVE_URL_PATTERN.test(file_url)) {
      return NextResponse.json({ error: "Link folder OneDrive tidak valid (harus diawali http:// atau https://)" }, { status: 400 })
    }
    if (!Array.isArray(itemIds) || itemIds.length === 0 || !itemIds.every(v => typeof v === "string")) {
      return NextResponse.json({ error: "Pilih minimal satu item yang tercakup dalam Surat Jalan ini" }, { status: 400 })
    }

    const prRes = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_requests` +
      `?id=eq.${id}&select=id,pr_no,status,purchase_request_items(id,fulfillment_source,warehouse_status)`,
      { headers: headers() }
    )
    if (!prRes.ok) throw new Error(await prRes.text())
    const [pr] = await prRes.json()
    if (!pr) return NextResponse.json({ error: "Purchase request not found" }, { status: 404 })
    if (pr.status === "DRAFT" || pr.status === "REJECTED" || pr.status === "COMPLETED") {
      return NextResponse.json(
        { error: "SJ tidak dapat diunggah untuk PR dengan status ini" },
        { status: 400 }
      )
    }

    type ItemRow = { id: string; fulfillment_source: string; warehouse_status: string }
    const items = (pr.purchase_request_items ?? []) as ItemRow[]
    const itemsById = new Map(items.map(it => [it.id, it]))
    for (const itemId of itemIds) {
      const item = itemsById.get(itemId)
      if (!item) {
        return NextResponse.json({ error: "Salah satu item tidak ditemukan pada PR ini" }, { status: 400 })
      }
      if (!canSelectForSJ(item)) {
        return NextResponse.json(
          { error: "Salah satu item yang dipilih belum siap dikirim (harus melalui verifikasi dan alokasi pengiriman dulu)" },
          { status: 400 }
        )
      }
    }

    const sjRes = await fetch(`${supabaseConfig.url}/rest/v1/purchase_request_surat_jalan`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify({
        purchase_request_id: id,
        file_url,
        file_name:   null,
        uploaded_by: uploaded_by || null,
      }),
    })
    if (!sjRes.ok) throw new Error(await sjRes.text())
    const [sjDoc] = await sjRes.json()

    const itemsPatchRes = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_request_items?id=in.(${itemIds.join(",")})&purchase_request_id=eq.${id}`,
      {
        method:  "PATCH",
        headers: headers(),
        body: JSON.stringify({
          warehouse_status: "DISPATCHED",
          dispatched_at:    new Date().toISOString(),
          surat_jalan_id:   sjDoc.id,
        }),
      }
    )
    if (!itemsPatchRes.ok) throw new Error(await itemsPatchRes.text())

    const itemsAfter = items.map(it => itemIds.includes(it.id) ? { ...it, warehouse_status: "DISPATCHED" } : it)
    const nextStatus = deriveOverallStatus(itemsAfter, pr.status)
    if (nextStatus !== pr.status) {
      const headerPatch: Record<string, unknown> = { status: nextStatus }
      if (nextStatus === "COMPLETED") headerPatch.sj_status = "BILLING_READY"

      const statusRes = await fetch(
        `${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${id}`,
        { method: "PATCH", headers: headers(), body: JSON.stringify(headerPatch) }
      )
      if (!statusRes.ok) throw new Error(await statusRes.text())

      logActivity({
        actorEmail: uploaded_by ?? undefined,
        action:     "PR_STATUS_CHANGED",
        entityId:   id,
        summary:    `PR ${pr.pr_no} status diubah dari ${pr.status} ke ${nextStatus}`,
        payload:    { from: pr.status, to: nextStatus },
      })
    }

    logActivity({
      actorEmail: uploaded_by ?? undefined,
      action:     "SJ_UPLOADED",
      entityId:   id,
      summary:    `Surat Jalan diunggah untuk PR ${pr.pr_no} (${itemIds.length} item)`,
      payload:    { file_url, item_ids: itemIds },
    })

    const data = await fetchFullRecord(id)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload Surat Jalan" },
      { status: 500 }
    )
  }
}
