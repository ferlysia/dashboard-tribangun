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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // upah/hari/calc_mode jointly determine jumlah, so fetch whichever
    // weren't sent in this PATCH to recompute it correctly.
    const existingRes = await fetch(
      `${supabaseConfig.url}/rest/v1/pnl_gaji_details?id=eq.${id}&select=upah,hari,calc_mode`,
      { headers: headers() }
    )
    if (!existingRes.ok) throw new Error(await existingRes.text())
    const existingRows = await existingRes.json()
    const existing = existingRows[0] ?? { upah: 0, hari: 0, calc_mode: "multiply" as PnlGajiCalcMode }

    const upah = body.upah !== undefined ? Number(body.upah) : Number(existing.upah)
    const hari = body.hari !== undefined ? Number(body.hari) : Number(existing.hari)
    const calcMode: PnlGajiCalcMode =
      body.calc_mode !== undefined ? (body.calc_mode === "add" ? "add" : "multiply") : existing.calc_mode

    const payload: Record<string, unknown> = {
      upah,
      hari,
      calc_mode: calcMode,
      jumlah: computeGajiJumlah(upah, hari, calcMode),
    }
    if (body.nama !== undefined) payload.nama = String(body.nama)
    if (body.nik !== undefined) payload.nik = String(body.nik)
    if (body.tahun !== undefined) payload.tahun = body.tahun ? Number(body.tahun) : null
    if (body.ptkp !== undefined) payload.ptkp = String(body.ptkp)

    const res = await fetch(`${supabaseConfig.url}/rest/v1/pnl_gaji_details?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    return NextResponse.json({ data: rows[0] ?? null })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update row" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const res = await fetch(`${supabaseConfig.url}/rest/v1/pnl_gaji_details?id=eq.${id}`, {
      method: "DELETE",
      headers: { ...headers(), Prefer: "return=minimal" },
    })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete row" },
      { status: 500 }
    )
  }
}
