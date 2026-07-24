import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

const BUCKET = "surat-jalan-docs"

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const formData = await request.formData()
    const file        = formData.get("file") as File | null
    const uploaded_by = formData.get("uploaded_by") as string | null

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }

    const prRes = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${id}&select=id,pr_no,sj_status,purchase_request_items(received)`,
      { headers: headers() }
    )
    if (!prRes.ok) throw new Error(await prRes.text())
    const [pr] = await prRes.json()
    if (!pr) return NextResponse.json({ error: "Purchase request not found" }, { status: 404 })
    if (pr.sj_status !== "PENDING_SIGNED_SJ") {
      return NextResponse.json(
        { error: "This PR is not waiting on a Surat Jalan upload" },
        { status: 400 }
      )
    }
    const items = (pr.purchase_request_items ?? []) as { received: boolean }[]
    if (items.length === 0 || items.some(it => !it.received)) {
      return NextResponse.json(
        { error: "All items must be marked as received before uploading Surat Jalan" },
        { status: 400 }
      )
    }

    const path = `${id}/${Date.now()}-${file.name}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const uploadRes = await fetch(`${supabaseConfig.url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey:        supabaseConfig.serviceRoleKey,
        Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert":     "true",
      },
      body: buffer,
    })
    if (!uploadRes.ok) throw new Error(`Storage error: ${await uploadRes.text()}`)

    const sj_document_url = `${supabaseConfig.url}/storage/v1/object/public/${BUCKET}/${path}`

    const patchRes = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${id}`,
      {
        method:  "PATCH",
        headers: { ...headers(), Prefer: "return=representation" },
        body: JSON.stringify({ sj_document_url, sj_uploaded_by: uploaded_by || null }),
      }
    )
    if (!patchRes.ok) throw new Error(await patchRes.text())
    const rows = await patchRes.json()

    await logActivity({
      actorEmail: uploaded_by ?? undefined,
      action:     "SJ_UPLOADED",
      entityId:   id,
      summary:    `Surat Jalan diunggah untuk PR ${pr.pr_no}`,
      payload:    { sj_document_url },
    })

    return NextResponse.json({ data: rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload Surat Jalan" },
      { status: 500 }
    )
  }
}
