import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function getHeaders() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

type VOEntry     = { id: string; nilai_po: number }
type TerminEntry = { id: string; target_progres: number; persen_tagihan: number; nama: string }

export type ExecProjectRow = {
  project_key:      string
  display_name:     string
  customer_name:    string
  project_status:   string
  physical_progress: number
  contractVal:      number
  totalCosts:       number
  netProfit:        number
  netMargin:        number
  financeStatus:    "READY" | "LOCKED"
  unlockedTermins:  string[]
}

export async function GET() {
  try {
    const [projRes, costsRes] = await Promise.all([
      fetch(
        `${supabaseConfig.url}/rest/v1/project_details?select=*&order=created_at.asc`,
        { headers: getHeaders(), next: { revalidate: 0 } }
      ),
      fetch(
        `${supabaseConfig.url}/rest/v1/project_costs?select=project_key,amount`,
        { headers: getHeaders(), next: { revalidate: 0 } }
      ),
    ])

    if (!projRes.ok) throw new Error(await projRes.text())
    if (!costsRes.ok) throw new Error(await costsRes.text())

    const projects = await projRes.json() as Record<string, unknown>[]
    const allCosts  = await costsRes.json() as { project_key: string; amount: string | number }[]

    // Aggregate costs per project
    const costMap: Record<string, number> = {}
    for (const c of allCosts) {
      costMap[c.project_key] = (costMap[c.project_key] || 0) + Number(c.amount || 0)
    }

    const rows: ExecProjectRow[] = projects.map(p => {
      const voEntries: VOEntry[]     = Array.isArray(p.vo_entries) ? (p.vo_entries as VOEntry[]) : []
      const terminSched: TerminEntry[] = Array.isArray(p.termin_schedule) ? (p.termin_schedule as TerminEntry[]) : []

      const poBase     = Number(p.po_value_manual || 0)
      const voTotal    = voEntries.length > 0
        ? voEntries.reduce((s, e) => s + Number(e.nilai_po || 0), 0)
        : Number(p.op_budget_vo || 0)
      const contractVal = poBase + voTotal

      const totalCosts = costMap[p.project_key as string] || 0
      const netProfit  = contractVal - totalCosts
      const netMargin  = contractVal > 0 ? (netProfit / contractVal) * 100 : 0
      const progress   = Number(p.physical_progress || 0)

      // Determine which termins are unlocked (progress >= target)
      const unlockedTermins = terminSched
        .filter(t => progress >= t.target_progres)
        .map(t => t.nama)

      let financeStatus: "READY" | "LOCKED" = "LOCKED"
      if (terminSched.length > 0) {
        financeStatus = unlockedTermins.length > 0 ? "READY" : "LOCKED"
      } else {
        financeStatus = progress >= 100 ? "READY" : "LOCKED"
      }

      return {
        project_key:       p.project_key as string,
        display_name:      (p.display_name as string) || (p.project_key as string),
        customer_name:     (p.customer_name as string) || "",
        project_status:    (p.project_status as string) || "BERJALAN",
        physical_progress: progress,
        contractVal,
        totalCosts,
        netProfit,
        netMargin,
        financeStatus,
        unlockedTermins,
      }
    })

    return NextResponse.json({ data: rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
