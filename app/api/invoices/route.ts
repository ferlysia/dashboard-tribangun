import { NextResponse } from "next/server"
import { createInvoice } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.invoice_no || !body.customer || !body.description) {
      return NextResponse.json({ error: "invoice_no, customer, dan description wajib diisi" }, { status: 400 })
    }

    const invoice = await createInvoice(body, body.actor_email)
    return NextResponse.json({ data: invoice })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat invoice" },
      { status: 500 }
    )
  }
}
