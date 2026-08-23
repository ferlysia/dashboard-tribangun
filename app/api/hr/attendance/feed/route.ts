import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { jakartaDayRangeUTC } from "@/app/hr-dashboard/attendance/_lib/week"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Parameter date (YYYY-MM-DD) wajib diisi" }, { status: 400 })
  }

  const { gte, lt } = jakartaDayRangeUTC(date)

  const params = new URLSearchParams()
  // Embedded-resource join per project convention — attendance_logs.employee_id
  // has a real FK into employees(employee_id), so PostgREST can walk it.
  params.set("select", "id,employee_id,site_name,recorded_at,employees(full_name)")
  params.append("recorded_at", `gte.${gte}`)
  params.append("recorded_at", `lt.${lt}`)
  params.set("order", "recorded_at.desc")
  params.set("limit", "200")

  const res = await fetch(`${supabaseConfig.url}/rest/v1/attendance_logs?${params}`, {
    headers: {
      apikey:        supabaseConfig.serviceRoleKey,
      Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    },
    cache: "no-store",
  })

  if (!res.ok) {
    return NextResponse.json({ error: "Gagal memuat aktivitas kehadiran" }, { status: 500 })
  }

  const rows = await res.json() as {
    id:          string
    employee_id: string
    site_name:   string
    recorded_at: string
    employees:   { full_name: string } | null
  }[]

  return NextResponse.json({
    data: rows.map(r => ({
      id:         r.id,
      employeeId: r.employee_id,
      fullName:   r.employees?.full_name ?? r.employee_id,
      siteName:   r.site_name,
      recordedAt: r.recorded_at,
    })),
  })
}
