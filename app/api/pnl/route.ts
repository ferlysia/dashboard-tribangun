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
  return { periodType, periodYear, periodMonth }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const { periodType, periodYear, periodMonth } = parsePeriod(searchParams)

    if (!periodYear) {
      return NextResponse.json({ error: "period_year is required" }, { status: 400 })
    }

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/pnl_reconciliations` +
        `?select=*&period_type=eq.${periodType}&period_year=eq.${periodYear}&period_month=eq.${periodMonth}&limit=1`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())

    const rows = await res.json()
    const matrix = dbRecordToMatrix(rows[0] ?? null)

    return NextResponse.json({ matrix, periodType, periodYear, periodMonth })
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
    const matrix = recomputeMatrix(body.matrix as PnlMatrixValues)

    if (!periodYear) {
      return NextResponse.json({ error: "period_year is required" }, { status: 400 })
    }
    if (periodType === "monthly" && (periodMonth < 1 || periodMonth > 12)) {
      return NextResponse.json({ error: "period_month must be between 1 and 12" }, { status: 400 })
    }

    const payload = {
      period_type: periodType,
      period_year: periodYear,
      period_month: periodMonth,
      ...matrixToDbPayload(matrix),
    }

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/pnl_reconciliations?on_conflict=period_type,period_year,period_month`,
      {
        method: "POST",
        headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(payload),
      }
    )
    if (!res.ok) throw new Error(await res.text())

    const rows = await res.json()
    return NextResponse.json({ matrix: dbRecordToMatrix(rows[0] ?? null) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save P&L report" },
      { status: 500 }
    )
  }
}
