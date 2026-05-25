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
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.status        !== undefined) payload.status        = String(body.status)
    if (body.amount_billed !== undefined) payload.amount_billed = body.amount_billed !== null ? Number(body.amount_billed) : null
    if (body.invoice_date  !== undefined) payload.invoice_date  = body.invoice_date  || null
    if (body.notes         !== undefined) payload.notes         = body.notes         || null

    const url = `${supabaseConfig.url}/rest/v1/termin_invoices?id=eq.${id}`
    const res = await fetch(url, {
      method:  "PATCH",
      headers: { ...getHeaders(), Prefer: "return=representation" },
      body:    JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    return NextResponse.json({ data: rows[0] ?? null })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
