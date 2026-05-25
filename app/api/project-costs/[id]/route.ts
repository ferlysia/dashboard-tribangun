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
    if (body.description !== undefined) payload.description = String(body.description)
    if (body.amount      !== undefined) payload.amount      = Number(body.amount)
    if (body.category    !== undefined) payload.category    = String(body.category)
    if (body.cost_date   !== undefined) payload.cost_date   = body.cost_date || null
    if (Object.keys(payload).length === 0) return NextResponse.json({ ok: true })
    const url = `${supabaseConfig.url}/rest/v1/project_costs?id=eq.${id}`
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = `${supabaseConfig.url}/rest/v1/project_costs?id=eq.${id}`
    const res = await fetch(url, {
      method: "DELETE",
      headers: { ...getHeaders(), Prefer: "return=minimal" },
    })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
