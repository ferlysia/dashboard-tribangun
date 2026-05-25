import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function getHeaders() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key")
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 })

    const url = `${supabaseConfig.url}/rest/v1/termin_invoices?project_key=eq.${encodeURIComponent(key)}&order=created_at.asc&select=*`
    const res = await fetch(url, { headers: getHeaders() })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ data: await res.json() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Upsert: insert or update on conflict (project_key, termin_id).
// SOW Bridge calls this with status="SIAP_TAGIH" to auto-unlock; the DB
// UNIQUE constraint on (project_key, termin_id) ensures idempotency.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.project_key || !body.termin_id)
      return NextResponse.json({ error: "project_key and termin_id required" }, { status: 400 })

    const payload: Record<string, unknown> = {
      project_key: String(body.project_key),
      termin_id:   String(body.termin_id),
      status:      String(body.status ?? "TERKUNCI"),
      updated_at:  new Date().toISOString(),
    }
    if (body.amount_billed  !== undefined) payload.amount_billed  = body.amount_billed  !== null ? Number(body.amount_billed)   : null
    if (body.invoice_date   !== undefined) payload.invoice_date   = body.invoice_date   || null
    if (body.notes          !== undefined) payload.notes          = body.notes          || null

    const url = `${supabaseConfig.url}/rest/v1/termin_invoices?on_conflict=project_key,termin_id`
    const res = await fetch(url, {
      method:  "POST",
      headers: { ...getHeaders(), Prefer: "resolution=merge-duplicates,return=representation" },
      body:    JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    return NextResponse.json({ data: rows[0] ?? null })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
