import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { computeGajiJumlah, type PnlGajiCalcMode } from "@/lib/pnl"

function headers() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pnlId = searchParams.get("pnl_id")
    if (!pnlId) return NextResponse.json({ error: "pnl_id is required" }, { status: 400 })

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/pnl_gaji_details?pnl_id=eq.${pnlId}&select=*&order=created_at.asc`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ data: await res.json() })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Beban Gaji" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const pnlId = body.pnl_id
    if (!pnlId) return NextResponse.json({ error: "pnl_id is required" }, { status: 400 })

    const upah = Number(body.upah || 0)
    const hari = Number(body.hari || 0)
    const calcMode: PnlGajiCalcMode = body.calc_mode === "add" ? "add" : "multiply"

    const payload = {
      pnl_id: pnlId,
      nama: String(body.nama || ""),
      nik: String(body.nik || ""),
      tahun: body.tahun ? Number(body.tahun) : null,
      ptkp: String(body.ptkp || ""),
      upah,
      hari,
      calc_mode: calcMode,
      jumlah: computeGajiJumlah(upah, hari, calcMode),
    }

    const res = await fetch(`${supabaseConfig.url}/rest/v1/pnl_gaji_details`, {
      method: "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    return NextResponse.json({ data: rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add Beban Gaji row" },
      { status: 500 }
    )
  }
}
