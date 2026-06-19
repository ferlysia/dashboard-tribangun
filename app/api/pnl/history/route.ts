import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import type { PnlHistoryRecord } from "@/lib/pnl"

function headers() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

// Lists every saved pnl_reconciliations record (one row per period snapshot,
// not deduplicated by package like /api/pnl/packages) so the summary table
// on the P&L page can show — and link back into — each historical revision.
export async function GET() {
  try {
    const url =
      `${supabaseConfig.url}/rest/v1/pnl_reconciliations` +
      `?select=id,perusahaan,npwp,project_name,period_type,period_year,period_month,laba_bersih_fiskal,updated_at` +
      `&order=updated_at.desc&limit=100`

    const res = await fetch(url, { headers: headers() })
    if (!res.ok) throw new Error(await res.text())
    const rows: (Omit<PnlHistoryRecord, "laba_bersih_fiskal"> & { laba_bersih_fiskal: number | null })[] =
      await res.json()

    const records: PnlHistoryRecord[] = rows
      .filter((r) => r.perusahaan || r.project_name)
      .map((r) => ({
        id: r.id,
        perusahaan: r.perusahaan,
        npwp: r.npwp,
        project_name: r.project_name,
        period_type: r.period_type,
        period_year: r.period_year,
        period_month: r.period_month,
        laba_bersih_fiskal: Number(r.laba_bersih_fiskal ?? 0),
      }))

    return NextResponse.json({ data: records })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load report history" },
      { status: 500 }
    )
  }
}
