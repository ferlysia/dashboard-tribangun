import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function getHeaders() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key")
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 })

    // Explicit columns — never select=* to protect egress on Supabase Free Tier
    const url = `${supabaseConfig.url}/rest/v1/project_costs?project_key=eq.${encodeURIComponent(key)}&order=created_at.asc&select=id,project_key,category,description,amount,cost_date,cost_stream,created_at,input_by,no_po,supplier,qty,harga_satuan,harga_satuan_pph,total_pph`
    const res = await fetch(url, { headers: getHeaders() })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ data: await res.json() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.project_key || !body.description || body.amount === undefined) {
      return NextResponse.json(
        { error: "project_key, description, amount wajib diisi" },
        { status: 400 }
      )
    }

    const isVO = body.cost_stream === "vo"
    const payload = {
      project_key:  body.project_key,
      category:     body.category || "lainnya",
      description:  String(body.description),
      amount:       Number(body.amount),
      cost_date:    body.cost_date || null,
      input_by:     String(body.input_by || ""),
      cost_stream:  isVO ? "vo" : "main",
    }

    const insertUrl = `${supabaseConfig.url}/rest/v1/project_costs`
    const insertRes = await fetch(insertUrl, {
      method: "POST",
      headers: { ...getHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(payload),
    })
    if (!insertRes.ok) throw new Error(await insertRes.text())
    const rows = await insertRes.json()

    // ── VO Escalation Gate ───────────────────────────────────────────────────
    // After every VO cost insert, check whether thresholds have been crossed.
    let escalationWarning: string | null = null
    if (isVO) {
      // 1. Current total VO costs for this project
      const sumUrl = `${supabaseConfig.url}/rest/v1/project_costs?project_key=eq.${encodeURIComponent(body.project_key)}&cost_stream=eq.vo&select=amount`
      const sumRes = await fetch(sumUrl, { headers: getHeaders() })
      const costRows: { amount: number }[] = sumRes.ok ? await sumRes.json() : []
      const totalVO = costRows.reduce((s, r) => s + Number(r.amount), 0)

      // 2. Approved VO budget from project_details
      const detUrl = `${supabaseConfig.url}/rest/v1/project_details?project_key=eq.${encodeURIComponent(body.project_key)}&select=op_budget_vo`
      const detRes = await fetch(detUrl, { headers: getHeaders() })
      const detRows: { op_budget_vo: number }[] = detRes.ok ? await detRes.json() : []
      const budgetVO = Number(detRows[0]?.op_budget_vo ?? 0)

      if (budgetVO > 0) {
        const pct = (totalVO / budgetVO) * 100

        // Determine which threshold was crossed
        const newType = pct >= 100 ? "vo_budget_exceeded" : pct >= 80 ? "vo_budget_80pct" : null

        if (newType) {
          // Only insert if no unacknowledged escalation of this type already exists
          const chkUrl = `${supabaseConfig.url}/rest/v1/project_escalations?project_key=eq.${encodeURIComponent(body.project_key)}&escalation_type=eq.${newType}&acknowledged_at=is.null&select=id`
          const chkRes = await fetch(chkUrl, { headers: getHeaders() })
          const existing: { id: string }[] = chkRes.ok ? await chkRes.json() : []

          if (existing.length === 0) {
            const escPayload = {
              project_key:     body.project_key,
              escalation_type: newType,
              threshold_pct:   newType === "vo_budget_exceeded" ? 100 : 80,
              notes: `Total VO: ${totalVO.toLocaleString("id-ID")}, Budget VO: ${budgetVO.toLocaleString("id-ID")} (${pct.toFixed(1)}%)`,
            }
            await fetch(`${supabaseConfig.url}/rest/v1/project_escalations`, {
              method: "POST",
              headers: { ...getHeaders(), Prefer: "return=minimal" },
              body: JSON.stringify(escPayload),
            })
            escalationWarning = newType
          }
        }
      }
    }

    return NextResponse.json({
      data: rows[0],
      ...(escalationWarning && { escalationWarning }),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
