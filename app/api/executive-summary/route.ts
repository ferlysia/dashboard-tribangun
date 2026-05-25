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
type TerminEntry = { id: string; target_progres: number; nama: string }

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
  has_doc_con_data: boolean
  log_count:        number
  sched_count:      number
}

export async function GET() {
  try {
    const [projRes, costsRes, logsRes, schedRes] = await Promise.all([
      fetch(`${supabaseConfig.url}/rest/v1/project_details?select=*&order=created_at.asc`,
        { headers: getHeaders(), cache: "no-store" }),
      fetch(`${supabaseConfig.url}/rest/v1/project_costs?select=project_key,amount`,
        { headers: getHeaders(), cache: "no-store" }),
      fetch(`${supabaseConfig.url}/rest/v1/project_weekly_logs?select=project_key`,
        { headers: getHeaders(), cache: "no-store" }),
      fetch(`${supabaseConfig.url}/rest/v1/project_schedule_items?select=project_key`,
        { headers: getHeaders(), cache: "no-store" }),
    ])

    if (!projRes.ok)  throw new Error(await projRes.text())
    if (!costsRes.ok) throw new Error(await costsRes.text())

    const projects  = await projRes.json()  as Record<string, unknown>[]
    const allCosts  = costsRes.ok  ? await costsRes.json()  as { project_key: string; amount: string | number }[] : []
    const allLogs   = logsRes.ok   ? await logsRes.json()   as { project_key: string }[] : []
    const allScheds = schedRes.ok  ? await schedRes.json()  as { project_key: string }[] : []

    const costMap:  Record<string, number> = {}
    const logMap:   Record<string, number> = {}
    const schedMap: Record<string, number> = {}

    for (const c of allCosts)  costMap[c.project_key]  = (costMap[c.project_key]  || 0) + Number(c.amount || 0)
    for (const l of allLogs)   logMap[l.project_key]   = (logMap[l.project_key]   || 0) + 1
    for (const s of allScheds) schedMap[s.project_key] = (schedMap[s.project_key] || 0) + 1

    const rows: ExecProjectRow[] = projects.map(p => {
      const key         = p.project_key as string
      const voEntries   = Array.isArray(p.vo_entries)      ? (p.vo_entries      as VOEntry[])     : []
      const terminSched = Array.isArray(p.termin_schedule) ? (p.termin_schedule as TerminEntry[]) : []

      const poBase      = Number(p.po_value_manual || 0)
      const voTotal     = voEntries.length > 0
        ? voEntries.reduce((s, e) => s + Number(e.nilai_po || 0), 0)
        : Number(p.op_budget_vo || 0)
      const contractVal = poBase + voTotal
      const totalCosts  = costMap[key] || 0
      const netProfit   = contractVal - totalCosts
      const netMargin   = contractVal > 0 ? (netProfit / contractVal) * 100 : 0
      const progress    = Number(p.physical_progress || 0)

      const unlockedTermins = terminSched.filter(t => progress >= t.target_progres).map(t => t.nama)

      let financeStatus: "READY" | "LOCKED" = "LOCKED"
      if (terminSched.length > 0) financeStatus = unlockedTermins.length > 0 ? "READY" : "LOCKED"
      else financeStatus = progress >= 100 ? "READY" : "LOCKED"

      const log_count   = logMap[key]   || 0
      const sched_count = schedMap[key] || 0

      return {
        project_key: key,
        display_name:     (p.display_name  as string) || key,
        customer_name:    (p.customer_name as string) || "",
        project_status:   (p.project_status as string) || "BERJALAN",
        physical_progress: progress,
        contractVal, totalCosts, netProfit, netMargin,
        financeStatus, unlockedTermins,
        has_doc_con_data: log_count > 0 || sched_count > 0,
        log_count, sched_count,
      }
    })

    return NextResponse.json({ data: rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
