import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

const BUCKET = "surat-jalan-docs"
// Keeps uploads inside typical serverless function payload limits (Netlify's
// synchronous function limit is a few MB) so oversized files fail fast with a
// clean JSON error instead of crashing the function with a raw "Internal Error".
const MAX_FILE_BYTES = 10 * 1024 * 1024

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
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File terlalu besar (maks ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))}MB)` },
        { status: 413 }
      )
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

    // Stream the file straight through instead of materializing a second
    // full copy via arrayBuffer() — halves peak memory for large PDFs and
    // reduces the odds of the function crashing (which is what surfaced as
    // "Internal Error" instead of a clean JSON response).
    const uploadRes = await fetch(`${supabaseConfig.url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey:          supabaseConfig.serviceRoleKey,
        Authorization:   `Bearer ${supabaseConfig.serviceRoleKey}`,
        "Content-Type":  file.type || "application/octet-stream",
        "Content-Length": String(file.size),
        "x-upsert":      "true",
      },
      body: file.stream(),
      // Node's fetch requires this when streaming a request body.
      duplex: "half",
    } as RequestInit & { duplex: "half" })
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

    logActivity({
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
