import { NextResponse } from "next/server"
import { deleteInvoice, updateInvoice } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const invoice = await updateInvoice(id, body, body.actor_email)
    return NextResponse.json({ data: invoice })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal update invoice" },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await _request.json().catch(() => ({}))
    await deleteInvoice(id, body.actor_email)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal hapus invoice" },
      { status: 500 }
    )
  }
}
