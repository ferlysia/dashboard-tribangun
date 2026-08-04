import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

// Backs the bulk-selection "Mark N as Paid" action — one PostgREST round
// trip via id=in.(...) instead of N sequential PATCHes.
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : []
    const paymentDate = String(body.payment_date ?? "").trim()

    if (ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 })
    }
    if (!paymentDate) {
      return NextResponse.json({ error: "payment_date is required" }, { status: 400 })
    }

    const idList = ids.map((id: string) => `"${id}"`).join(",")
    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/ap_invoices?id=in.(${idList})&select=*,ap_vendors(*)`,
      {
        method:  "PATCH",
        headers: { ...headers(), Prefer: "return=representation" },
        body:    JSON.stringify({ payment_date: paymentDate, updated_at: new Date().toISOString() }),
      }
    )
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to mark invoices as paid" },
      { status: 500 }
    )
  }
}
