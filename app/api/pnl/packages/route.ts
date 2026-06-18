import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import type { PnlPackage } from "@/lib/pnl"

function headers() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

// Searches across existing pnl_reconciliations rows (no separate lookup
// table needed) and collapses the results down to distinct
// (perusahaan, project_name) packages — the header combobox uses this to
// resolve "GTN" or "EdgeConneX" to the same unified record.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get("q") || "").trim().replace(/[(),]/g, "")

    let url =
      `${supabaseConfig.url}/rest/v1/pnl_reconciliations` +
      `?select=perusahaan,npwp,project_name,updated_at&order=updated_at.desc&limit=300`

    if (q) {
      const orExpr = `(perusahaan.ilike.*${q}*,npwp.ilike.*${q}*,project_name.ilike.*${q}*)`
      url += `&or=${encodeURIComponent(orExpr)}`
    }

    const res = await fetch(url, { headers: headers() })
    if (!res.ok) throw new Error(await res.text())
    const rows: { perusahaan: string; npwp: string; project_name: string }[] = await res.json()

    const seen = new Set<string>()
    const packages: PnlPackage[] = []
    for (const r of rows) {
      if (!r.perusahaan && !r.project_name) continue
      const key = `${r.perusahaan}||${r.project_name}`
      if (seen.has(key)) continue
      seen.add(key)
      packages.push({ perusahaan: r.perusahaan, npwp: r.npwp, project_name: r.project_name })
      if (packages.length >= 20) break
    }

    return NextResponse.json({ data: packages })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search packages" },
      { status: 500 }
    )
  }
}
