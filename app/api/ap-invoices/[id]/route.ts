import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

const EDITABLE_FIELDS = [
  "po_date", "po_number", "project_name", "invoice_date", "invoice_number",
  "dpp_amount", "ppn_amount", "pph_amount", "total_amount",
  "due_date", "payment_date", "notes",
] as const

const NUMERIC_FIELDS = new Set(["dpp_amount", "ppn_amount", "pph_amount", "total_amount"])

// Single mutation endpoint for every inline cell edit AND mark-as-paid
// (payment_date is just another field here — no separate status column to
// keep in sync). See app/api/ap-invoices/bulk-paid/route.ts for the
// multi-row version of the same "set payment_date" operation.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const patch: Record<string, unknown> = {}
    for (const field of EDITABLE_FIELDS) {
      if (body[field] === undefined) continue
      if (NUMERIC_FIELDS.has(field)) {
        // Progressive Entry: an explicit null clears the field (still "not
        // entered yet"), it must not silently coerce to 0.
        if (body[field] === null) { patch[field] = null; continue }
        const n = Number(body[field])
        if (!Number.isFinite(n)) {
          return NextResponse.json({ error: `${field} harus berupa angka` }, { status: 400 })
        }
        patch[field] = n
      } else {
        patch[field] = body[field] === null ? null : String(body[field])
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    patch.updated_at = new Date().toISOString()

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/ap_invoices?id=eq.${id}&select=*,ap_vendors(*)`,
      { method: "PATCH", headers: { ...headers(), Prefer: "return=representation" }, body: JSON.stringify(patch) }
    )
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    if (rows.length === 0) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    return NextResponse.json({ data: rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update invoice" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/ap_invoices?id=eq.${id}`,
      { method: "DELETE", headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ data: { id } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete invoice" },
      { status: 500 }
    )
  }
}
