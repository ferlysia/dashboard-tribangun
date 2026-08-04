import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { computeTotal } from "@/lib/ap-invoices/status-rules"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

// Urgency/aging is never filtered/computed here — it's derived entirely
// client-side from due_date/invoice_date/payment_date (see
// lib/ap-invoices/status-rules.ts), so this route only ever needs a plain
// list. ?vendor_id and ?paid are the only server-side filters, both cheap
// equality checks.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get("vendor_id")
    const paid     = searchParams.get("paid") // "true" | "false" | null (all)

    const filters = [`select=*,ap_vendors(*)`, `order=due_date.asc.nullslast,invoice_date.asc`]
    if (vendorId) filters.push(`vendor_id=eq.${vendorId}`)
    if (paid === "true")  filters.push(`payment_date=not.is.null`)
    if (paid === "false") filters.push(`payment_date=is.null`)

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/ap_invoices?${filters.join("&")}`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load invoices" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { vendor_id, invoice_date, invoice_number } = body as {
      vendor_id:      string
      invoice_date:   string
      invoice_number: string
    }

    if (!vendor_id || !invoice_date || !invoice_number) {
      return NextResponse.json(
        { error: "vendor_id, invoice_date, and invoice_number are required" },
        { status: 400 }
      )
    }

    const dpp = Number(body.dpp_amount) || 0
    const ppn = Number(body.ppn_amount) || 0
    const pph = Number(body.pph_amount) || 0

    const payload = {
      vendor_id,
      po_date:        body.po_date || null,
      po_number:      body.po_number || null,
      project_name:   body.project_name || null,
      invoice_date,
      invoice_number,
      dpp_amount:     dpp,
      ppn_amount:     ppn,
      pph_amount:     pph,
      // Pre-filled by the formula but never forced — the client already
      // sends whatever the user landed on (possibly hand-edited away from
      // the formula), this is just the fallback if omitted entirely.
      total_amount:   body.total_amount !== undefined ? Number(body.total_amount) : computeTotal(dpp, ppn, pph),
      due_date:       body.due_date || null,
      payment_date:   body.payment_date || null,
      notes:          body.notes || null,
    }

    const res = await fetch(`${supabaseConfig.url}/rest/v1/ap_invoices?select=*,ap_vendors(*)`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    const [data] = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create invoice" },
      { status: 500 }
    )
  }
}
