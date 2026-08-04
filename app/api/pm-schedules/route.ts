import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { isValidUnitTypes } from "@/lib/pm-schedule/recurring"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

// Every view (Matrix Grid, Weekly Board, Sites Overview, Calendar) reads
// from the same query key on the client (see _hooks/use-pm-schedules.ts),
// so this is the only fetch the whole dashboard needs per active month —
// switching tabs never re-triggers this route.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month  = searchParams.get("month")     // e.g. "2026-07-01"
    const siteId = searchParams.get("site_id")
    const status = searchParams.get("status")
    const region = searchParams.get("region")

    // !inner is safe unconditionally — site_id is NOT NULL, so the inner
    // join never drops a row when no region filter is given below.
    const filters = [`select=*,sites!inner(*)`, `order=scheduled_date.asc`]
    if (month)  filters.push(`scheduled_month=eq.${month}`)
    if (siteId) filters.push(`site_id=eq.${siteId}`)
    if (status) filters.push(`status=eq.${status}`)
    if (region === "JABO" || region === "CIKARANG") filters.push(`sites.region=eq.${region}`)

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/pm_schedules?${filters.join("&")}`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load PM schedules" },
      { status: 500 }
    )
  }
}

// Accepts either one schedule or an array — supports "multiple visits for
// one site in the same month" being created in a single request.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rows = Array.isArray(body) ? body : [body]

    for (const row of rows) {
      if (!row.site_id || !row.scheduled_date) {
        return NextResponse.json({ error: "site_id and scheduled_date are required" }, { status: 400 })
      }
      if (row.unit_types !== undefined && row.unit_types !== null && !isValidUnitTypes(row.unit_types)) {
        return NextResponse.json({ error: "unit_types tidak valid" }, { status: 400 })
      }
    }

    const payload = rows.map(row => ({
      site_id:        row.site_id,
      scheduled_date: row.scheduled_date,
      status:         row.status ?? "PLANNED",
      // Always optional, empty by default — never pre-filled, including on
      // recurring/batch-generated visits (technicians are assigned
      // dynamically ~1 week before the visit, not at scheduling time).
      assignees:      Array.isArray(row.assignees) ? row.assignees : [],
      unit_count:     row.unit_count ?? null,
      unit_types:     row.unit_types ?? null,
      notes:          row.notes ?? null,
      sn:             row.sn ? String(row.sn).trim() || null : null,
    }))

    const res = await fetch(`${supabaseConfig.url}/rest/v1/pm_schedules?select=*,sites(*)`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create PM schedule" },
      { status: 500 }
    )
  }
}
