import { NextResponse } from "next/server"
import { listChangedInvoices } from "@/lib/supabase/server"

export async function GET() {
  try {
    const changes = await listChangedInvoices()
    return NextResponse.json({ data: changes })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengambil perubahan invoice" },
      { status: 500 }
    )
  }
}
