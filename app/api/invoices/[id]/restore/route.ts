import { NextResponse } from "next/server"
import { restoreInvoiceToBaseline } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const invoice = await restoreInvoiceToBaseline(id, body.actor_email)
    return NextResponse.json({ data: invoice })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal restore invoice" },
      { status: 500 }
    )
  }
}
