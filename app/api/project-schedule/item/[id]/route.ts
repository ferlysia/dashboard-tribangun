import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function getHeaders() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const payload: Record<string, unknown> = {}
    if (body.is_done !== undefined) {
      payload.is_done = Boolean(body.is_done)
      payload.completed_at = body.is_done ? new Date().toISOString() : null
    }
    const url = `${supabaseConfig.url}/rest/v1/project_schedule_items?id=eq.${id}`
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = `${supabaseConfig.url}/rest/v1/project_schedule_items?id=eq.${id}`
    const res = await fetch(url, { method: "DELETE", headers: getHeaders() })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
