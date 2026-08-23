import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { jakartaDayRangeUTC } from "@/app/hr-dashboard/attendance/_lib/week"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
  }
}

// Replaces the old /api/hr/attendance/feed — that endpoint only ever
// returned rows that existed in attendance_logs (i.e. people who'd
// clocked in). The Phase 3 data table needs one row per employee per
// day so HR can filter/act on people who are absent too, so this merges
// every employee against that day's log rows (LEFT JOIN semantics done
// in JS, same pattern the summary route already uses for present/alpha).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Parameter date (YYYY-MM-DD) wajib diisi" }, { status: 400 })
  }

  const { gte, lt } = jakartaDayRangeUTC(date)

  const logParams = new URLSearchParams()
  logParams.set("select", "id,employee_id,site_name,recorded_at,status,remarks,employees(full_name)")
  logParams.append("recorded_at", `gte.${gte}`)
  logParams.append("recorded_at", `lt.${lt}`)
  logParams.set("order", "recorded_at.desc")

  const [logsRes, employeesRes] = await Promise.all([
    fetch(`${supabaseConfig.url}/rest/v1/attendance_logs?${logParams}`, { headers: headers(), cache: "no-store" }),
    fetch(`${supabaseConfig.url}/rest/v1/employees?select=employee_id,full_name&employee_id=not.is.null`, {
      headers: headers(),
      cache: "no-store",
    }),
  ])

  if (!logsRes.ok || !employeesRes.ok) {
    return NextResponse.json({ error: "Gagal memuat data kehadiran" }, { status: 500 })
  }

  const logRows = await logsRes.json() as {
    id:          string
    employee_id: string
    site_name:   string | null
    recorded_at: string
    status:      string
    remarks:     string | null
    employees:   { full_name: string } | null
  }[]
  const employeeRows = await employeesRes.json() as { employee_id: string; full_name: string }[]

  const logByEmployeeId = new Map(logRows.map(row => [row.employee_id, row]))

  const data = employeeRows.map(emp => {
    const log = logByEmployeeId.get(emp.employee_id)
    if (log) {
      return {
        employeeId: emp.employee_id,
        fullName:   log.employees?.full_name ?? emp.full_name,
        siteName:   log.site_name,
        recordedAt: log.recorded_at,
        status:     log.status,
        remarks:    log.remarks,
      }
    }
    return {
      employeeId: emp.employee_id,
      fullName:   emp.full_name,
      siteName:   null,
      recordedAt: null,
      status:     "alpha",
      remarks:    null,
    }
  })

  return NextResponse.json({ data })
}
