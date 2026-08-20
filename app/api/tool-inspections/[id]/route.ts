import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

function photoUrl(path: string) {
  return `${supabaseConfig.url}/storage/v1/object/public/tool-inspection-photos/${path}`
}

// PostgREST returns photos with only storage_path — the UI needs a
// browsable URL, so it's derived here once instead of in every caller.
function shapePhotos(item: Record<string, unknown>) {
  const photos = (item.tool_inspection_photos as Record<string, unknown>[] | undefined) ?? []
  return {
    ...item,
    tool_inspection_photos: photos.map(p => ({ ...p, url: photoUrl(p.storage_path as string) })),
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/tool_inspections` +
      `?id=eq.${id}` +
      `&select=*,tool_inspection_items(*,tool_inspection_photos(*))` +
      `&tool_inspection_items.order=line_no.asc`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())
    const [data] = await res.json() as Record<string, unknown>[]
    if (!data) {
      return NextResponse.json({ error: "Tool inspection not found" }, { status: 404 })
    }

    const items = (data.tool_inspection_items as Record<string, unknown>[]).map(shapePhotos)
    return NextResponse.json({ data: { ...data, tool_inspection_items: items } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load tool inspection" },
      { status: 500 }
    )
  }
}

const HEADER_PATCHABLE_FIELDS = [
  "project_name", "project_location", "inspection_date", "week_label",
  "responsible_person", "inspector", "corrective_notes",
  "inspected_by_signature", "responsible_signature",
  "reviewer_name", "reviewer_signature",
] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json() as Record<string, unknown>

    const patch: Record<string, unknown> = {}
    for (const field of HEADER_PATCHABLE_FIELDS) {
      if (field in body) patch[field] = body[field]
    }
    // A signature is only meaningful paired with when it was signed —
    // stamp the timestamp server-side whenever its signature arrives so the
    // client can't spoof it or forget to send it.
    const now = new Date().toISOString()
    if ("inspected_by_signature" in patch) patch.inspected_by_signed_at = now
    if ("responsible_signature"  in patch) patch.responsible_signed_at  = now
    if ("reviewer_signature"     in patch) patch.reviewer_signed_at     = now

    // Submitting is a one-way DRAFT -> SUBMITTED transition, gated by the
    // chk_tool_inspections_submitted_signed DB constraint (inspector +
    // responsible-person signatures required) rather than re-checked here.
    if (body.submit === true) patch.status = "SUBMITTED"

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 })
    }

    const res = await fetch(`${supabaseConfig.url}/rest/v1/tool_inspections?id=eq.${id}`, {
      method:  "PATCH",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify(patch),
    })
    if (!res.ok) throw new Error(await res.text())
    const [data] = await res.json()
    if (!data) {
      return NextResponse.json({ error: "Tool inspection not found" }, { status: 404 })
    }
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update tool inspection" },
      { status: 500 }
    )
  }
}
