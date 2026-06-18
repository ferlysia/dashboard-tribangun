import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { dbRecordToMatrix, matrixToDbPayload, recomputeMatrix, type PnlMatrixValues } from "@/lib/pnl"

function headers() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

function parsePeriod(searchParams: URLSearchParams) {
  const periodType = searchParams.get("period_type") === "yearly" ? "yearly" : "monthly"
  const periodYear = Number(searchParams.get("period_year"))
  const periodMonth = periodType === "yearly" ? 0 : Number(searchParams.get("period_month") || 0)
  const perusahaan = (searchParams.get("perusahaan") || "").trim()
  const projectName = (searchParams.get("project_name") || "").trim()
  return { periodType, periodYear, periodMonth, perusahaan, projectName }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const { periodType, periodYear, periodMonth, perusahaan, projectName } = parsePeriod(searchParams)

    if (!periodYear) {
      return NextResponse.json({ error: "period_year is required" }, { status: 400 })
    }
    if (!perusahaan || !projectName) {
      return NextResponse.json({ error: "Perusahaan dan Project Name wajib diisi" }, { status: 400 })
    }

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/pnl_reconciliations` +
        `?select=*&period_type=eq.${periodType}&period_year=eq.${periodYear}&period_month=eq.${periodMonth}` +
        `&perusahaan=eq.${encodeURIComponent(perusahaan)}&project_name=eq.${encodeURIComponent(projectName)}&limit=1`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())

    const rows = await res.json()
    const record = rows[0] ?? null

    // Unlike a known package (already in the DB), a brand new
    // perusahaan/project_name combination is NOT auto-created here — it's
    // only persisted once the user explicitly clicks "Simpan Laporan".
    return NextResponse.json({
      matrix: dbRecordToMatrix(record),
      id: record?.id ?? null,
      periodType,
      periodYear,
      periodMonth,
      perusahaan,
      projectName,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load P&L report" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const periodType: "monthly" | "yearly" = body.period_type === "yearly" ? "yearly" : "monthly"
    const periodYear = Number(body.period_year)
    const periodMonth = periodType === "yearly" ? 0 : Number(body.period_month || 0)
    const perusahaan = String(body.perusahaan || "").trim()
    const npwp = String(body.npwp || "").trim()
    const projectName = String(body.project_name || "").trim()
    const matrix = recomputeMatrix(body.matrix as PnlMatrixValues)

    if (!periodYear) {
      return NextResponse.json({ error: "period_year is required" }, { status: 400 })
    }
    if (periodType === "monthly" && (periodMonth < 1 || periodMonth > 12)) {
      return NextResponse.json({ error: "period_month must be between 1 and 12" }, { status: 400 })
    }
    if (!perusahaan || !projectName) {
      return NextResponse.json({ error: "Perusahaan dan Project Name wajib diisi" }, { status: 400 })
    }

    const payload = {
      period_type: periodType,
      period_year: periodYear,
      period_month: periodMonth,
      perusahaan,
      npwp,
      project_name: projectName,
      ...matrixToDbPayload(matrix),
    }

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/pnl_reconciliations` +
        `?on_conflict=period_type,period_year,period_month,perusahaan,project_name`,
      {
        method: "POST",
        headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(payload),
      }
    )
    if (!res.ok) throw new Error(await res.text())

    const rows = await res.json()
    return NextResponse.json({ matrix: dbRecordToMatrix(rows[0] ?? null), id: rows[0]?.id ?? null })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save P&L report" },
      { status: 500 }
    )
  }
}
