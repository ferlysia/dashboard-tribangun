import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function getHeaders() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const projectKey = decodeURIComponent(key)
    const url = `${supabaseConfig.url}/rest/v1/project_details?project_key=eq.${encodeURIComponent(projectKey)}&select=*`
    const res = await fetch(url, { headers: getHeaders() })
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    return NextResponse.json({ data: rows[0] ?? null })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const projectKey = decodeURIComponent(key)
    const body = await request.json()
    const payload: Record<string, unknown> = {}

    if (body.display_name        !== undefined) payload.display_name        = String(body.display_name)
    if (body.customer_name       !== undefined) payload.customer_name       = String(body.customer_name)
    if (body.site_location       !== undefined) payload.site_location       = String(body.site_location)
    if (body.description         !== undefined) payload.description         = String(body.description)
    if (body.notes               !== undefined) payload.notes               = String(body.notes)
    if (body.po_number           !== undefined) payload.po_number           = body.po_number ? String(body.po_number) : null
    if (body.po_value_manual     !== undefined) payload.po_value_manual     = Number(body.po_value_manual)
    if (body.onedrive_folder_url !== undefined) payload.onedrive_folder_url = body.onedrive_folder_url ? String(body.onedrive_folder_url) : null
    if (body.pic_name            !== undefined) payload.pic_name            = body.pic_name ? String(body.pic_name) : null
    if (body.op_gaji              !== undefined) payload.op_gaji              = Number(body.op_gaji)
    if (body.op_material          !== undefined) payload.op_material          = Number(body.op_material)
    if (body.op_jasa_instalasi    !== undefined) payload.op_jasa_instalasi    = Number(body.op_jasa_instalasi)
    if (body.op_transport         !== undefined) payload.op_transport         = Number(body.op_transport)
    if (body.op_operasional       !== undefined) payload.op_operasional       = Number(body.op_operasional)
    if (body.op_sewa              !== undefined) payload.op_sewa              = Number(body.op_sewa)
    if (body.op_lainnya           !== undefined) payload.op_lainnya           = Number(body.op_lainnya)
    if (body.op_budget_vo         !== undefined) payload.op_budget_vo         = Number(body.op_budget_vo)
    if (body.op_vo_gaji           !== undefined) payload.op_vo_gaji           = Number(body.op_vo_gaji)
    if (body.op_vo_material       !== undefined) payload.op_vo_material       = Number(body.op_vo_material)
    if (body.op_vo_jasa_instalasi !== undefined) payload.op_vo_jasa_instalasi = Number(body.op_vo_jasa_instalasi)
    if (body.op_vo_transport      !== undefined) payload.op_vo_transport      = Number(body.op_vo_transport)
    if (body.op_vo_operasional    !== undefined) payload.op_vo_operasional    = Number(body.op_vo_operasional)
    if (body.op_vo_sewa           !== undefined) payload.op_vo_sewa           = Number(body.op_vo_sewa)
    if (body.op_vo_lainnya        !== undefined) payload.op_vo_lainnya        = Number(body.op_vo_lainnya)
    if (body.vo_entries          !== undefined) payload.vo_entries          = body.vo_entries
    if (body.termin_schedule     !== undefined) payload.termin_schedule     = body.termin_schedule
    if (body.physical_progress   !== undefined)
      payload.physical_progress = Math.min(100, Math.max(0, Number(body.physical_progress)))
    if (body.project_status      !== undefined) payload.project_status      = String(body.project_status)

    if (Object.keys(payload).length === 0) return NextResponse.json({ ok: true })

    const url = `${supabaseConfig.url}/rest/v1/project_details?project_key=eq.${encodeURIComponent(projectKey)}`
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...getHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    return NextResponse.json({ data: rows[0] ?? null })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const projectKey = decodeURIComponent(key)
    const body = await request.json()

    const payload: Record<string, unknown> = {
      project_key:       projectKey,
      display_name:      String(body.display_name ?? ""),
      physical_progress: Math.min(100, Math.max(0, Number(body.physical_progress ?? 0))),
      notes:             String(body.notes ?? ""),
      site_location:     String(body.site_location ?? ""),
      description:       String(body.description ?? ""),
      po_value_manual:   Number(body.po_value_manual ?? 0),
      op_gaji:           Number(body.op_gaji ?? 0),
      op_material:       Number(body.op_material ?? 0),
      op_jasa_instalasi: Number(body.op_jasa_instalasi ?? 0),
      op_transport:      Number(body.op_transport ?? 0),
      op_operasional:    Number(body.op_operasional ?? 0),
      op_sewa:           Number(body.op_sewa ?? 0),
      op_lainnya:        Number(body.op_lainnya ?? 0),
    }
    if (body.onedrive_folder_url !== undefined)
      payload.onedrive_folder_url = body.onedrive_folder_url ? String(body.onedrive_folder_url) : null
    if (body.created_manually !== undefined) payload.created_manually = Boolean(body.created_manually)
    if (body.customer_name    !== undefined) payload.customer_name    = String(body.customer_name)
    if (body.project_status   !== undefined) payload.project_status   = String(body.project_status)
    if (body.op_budget_vo     !== undefined) payload.op_budget_vo     = Number(body.op_budget_vo)
    if (body.po_number        !== undefined) payload.po_number        = body.po_number ? String(body.po_number) : null
    if (body.pic_name         !== undefined) payload.pic_name         = body.pic_name ? String(body.pic_name) : null
    if (body.vo_entries       !== undefined) payload.vo_entries       = body.vo_entries
    if (body.termin_schedule  !== undefined) payload.termin_schedule  = body.termin_schedule
    if (body.op_vo_gaji           !== undefined) payload.op_vo_gaji           = Number(body.op_vo_gaji)
    if (body.op_vo_material       !== undefined) payload.op_vo_material       = Number(body.op_vo_material)
    if (body.op_vo_jasa_instalasi !== undefined) payload.op_vo_jasa_instalasi = Number(body.op_vo_jasa_instalasi)
    if (body.op_vo_transport      !== undefined) payload.op_vo_transport      = Number(body.op_vo_transport)
    if (body.op_vo_operasional    !== undefined) payload.op_vo_operasional    = Number(body.op_vo_operasional)
    if (body.op_vo_sewa           !== undefined) payload.op_vo_sewa           = Number(body.op_vo_sewa)
    if (body.op_vo_lainnya        !== undefined) payload.op_vo_lainnya        = Number(body.op_vo_lainnya)

    const url = `${supabaseConfig.url}/rest/v1/project_details?on_conflict=project_key`
    const res = await fetch(url, {
      method: "POST",
      headers: { ...getHeaders(), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    return NextResponse.json({ data: rows[0] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
