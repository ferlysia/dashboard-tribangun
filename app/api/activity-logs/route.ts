import { NextResponse } from "next/server"
import { listActivityLogs } from "@/lib/supabase/server"

export async function GET() {
  try {
    const logs = await listActivityLogs()
    return NextResponse.json({ data: logs })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengambil activity logs" },
      { status: 500 }
    )
  }
}
