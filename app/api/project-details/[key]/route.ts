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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const projectKey = decodeURIComponent(key)
    const body = await request.json()

    const payload = {
      project_key: projectKey,
      display_name:      String(body.display_name ?? ""),
      physical_progress: Math.min(100, Math.max(0, Number(body.physical_progress ?? 0))),
      notes:             String(body.notes ?? ""),
      site_location:     String(body.site_location ?? ""),
      description:       String(body.description ?? ""),
      po_value_manual:   Number(body.po_value_manual ?? 0),
      op_gaji:           Number(body.op_gaji ?? 0),
      op_material:       Number(body.op_material ?? 0),
      op_transport:      Number(body.op_transport ?? 0),
      op_operasional:    Number(body.op_operasional ?? 0),
      op_sewa:           Number(body.op_sewa ?? 0),
      op_lainnya:        Number(body.op_lainnya ?? 0),
    }

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
