import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { jakartaDayRangeUTC } from "@/app/hr-dashboard/attendance/_lib/week"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
  }
}

// Sits under /api/hr/attendance/*, deliberately not /api/attendance/* —
// that prefix is public/unauthenticated by design for the clock-in POST
// route (see middleware.ts), and this endpoint serves PII-adjacent
// attendance counts to the internal dashboard, so it must stay behind the
// default session gate.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Parameter date (YYYY-MM-DD) wajib diisi" }, { status: 400 })
  }

  const { gte, lt } = jakartaDayRangeUTC(date)

  const attendanceParams = new URLSearchParams()
  attendanceParams.set("select", "employee_id,status")
  attendanceParams.append("recorded_at", `gte.${gte}`)
  attendanceParams.append("recorded_at", `lt.${lt}`)

  const [attendanceRes, employeesRes] = await Promise.all([
    fetch(`${supabaseConfig.url}/rest/v1/attendance_logs?${attendanceParams}`, {
      headers: headers(),
      cache: "no-store",
    }),
    fetch(`${supabaseConfig.url}/rest/v1/employees?select=employee_id&employee_id=not.is.null`, {
      headers: headers(),
      cache: "no-store",
    }),
  ])

  if (!attendanceRes.ok || !employeesRes.ok) {
    return NextResponse.json({ error: "Gagal memuat ringkasan kehadiran" }, { status: 500 })
  }

  const attendanceRows = await attendanceRes.json() as { employee_id: string; status: string }[]
  const employeeRows = await employeesRes.json() as { employee_id: string }[]

  const totalEmployees = employeeRows.length
  const present = attendanceRows.filter(r => r.status === "masuk").length
  const sick = attendanceRows.filter(r => r.status === "sakit").length
  const leave = attendanceRows.filter(r => r.status === "izin" || r.status === "cuti").length
  // Anyone without a positive-status row today (including rows HR has
  // explicitly marked "alpha") falls into this bucket — no separate
  // no-show detection needed since it's just the remainder.
  const alpha = Math.max(totalEmployees - present - sick - leave, 0)

  return NextResponse.json({ date, present, alpha, totalEmployees, sick, leave })
}
