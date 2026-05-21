import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function getHeaders() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

// GET — semua escalations untuk satu proyek
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const projectKey = decodeURIComponent(key)
    const url = `${supabaseConfig.url}/rest/v1/project_escalations?project_key=eq.${encodeURIComponent(projectKey)}&order=triggered_at.desc&select=*`
    const res = await fetch(url, { headers: getHeaders() })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ data: await res.json() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST — buat escalation baru
export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const projectKey = decodeURIComponent(key)
    const body = await request.json()

    const payload = {
      project_key:     projectKey,
      escalation_type: String(body.escalation_type ?? "vo_budget_80pct"),
      threshold_pct:   Number(body.threshold_pct ?? 80),
      notes:           body.notes ? String(body.notes) : null,
    }

    const url = `${supabaseConfig.url}/rest/v1/project_escalations`
    const res = await fetch(url, {
      method: "POST",
      headers: { ...getHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    return NextResponse.json({ data: rows[0] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH — acknowledge escalation (by id)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await params
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 })

    const payload = {
      acknowledged_by:  body.acknowledged_by ? String(body.acknowledged_by) : "system",
      acknowledged_at:  new Date().toISOString(),
      notes:            body.notes ? String(body.notes) : null,
    }

    const url = `${supabaseConfig.url}/rest/v1/project_escalations?id=eq.${encodeURIComponent(body.id)}`
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...getHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    return NextResponse.json({ data: rows[0] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
