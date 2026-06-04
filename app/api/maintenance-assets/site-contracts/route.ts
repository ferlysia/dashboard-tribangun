import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function headers() {
  return {
    apikey:          supabaseConfig.serviceRoleKey,
    Authorization:  `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      editing_id,
      site_name,
      po_number,
      contract_start_date,
      contract_duration_years,
      total_planned_visits,
      notes,
    } = body

    if (!site_name || !po_number || !contract_start_date || !contract_duration_years || !total_planned_visits) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const payload = { site_name, po_number, contract_start_date, contract_duration_years, total_planned_visits, notes: notes || null }

    let contractId: string

    if (editing_id) {
      const res = await fetch(
        `${supabaseConfig.url}/rest/v1/site_contracts?id=eq.${editing_id}`,
        { method: "PATCH", headers: { ...headers(), Prefer: "return=representation" }, body: JSON.stringify(payload) }
      )
      if (!res.ok) throw new Error(await res.text())
      contractId = editing_id
    } else {
      const res = await fetch(
        `${supabaseConfig.url}/rest/v1/site_contracts`,
        { method: "POST", headers: { ...headers(), Prefer: "return=representation" }, body: JSON.stringify({ ...payload, status: "ACTIVE" }) }
      )
      if (!res.ok) throw new Error(await res.text())
      const rows = await res.json()
      contractId = rows[0].id
    }

    // Call fn_generate_site_milestones via Supabase RPC
    const rpcRes = await fetch(
      `${supabaseConfig.url}/rest/v1/rpc/fn_generate_site_milestones`,
      { method: "POST", headers: headers(), body: JSON.stringify({ p_site_contract_id: contractId }) }
    )

    const milestonesGenerated: number = rpcRes.ok ? await rpcRes.json() : 0
    if (!rpcRes.ok) {
      console.error("fn_generate_site_milestones error:", await rpcRes.text())
    }

    return NextResponse.json({ contractId, milestonesGenerated })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save site contract" },
      { status: 500 }
    )
  }
}
