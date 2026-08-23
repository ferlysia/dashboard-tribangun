import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import {
  jakartaPayrollPeriodRangeUTC,
  getPayrollPeriodDays,
  getPayrollPeriodLabel,
  getJakartaToday,
  type PayrollPeriodDay,
} from "@/app/hr-dashboard/attendance/_lib/week"

const STATUS_LABEL: Record<string, string> = { alpha: "Alpha", sakit: "Sakit", izin: "Izin", cuti: "Cuti" }

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
  }
}

function compareYMD(a: { year: number; month: number; day: number }, b: { year: number; month: number; day: number }): number {
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

// Payroll's recap, aggregated over the company's actual 26th-to-25th
// cut-off cycle (not the calendar month — books close on the 25th,
// salaries go out ~27th-28th, per HR). Scheduling reality (confirmed
// with HR, not guessed): Mon-Fri are normal working days — a weekday
// with no clock-in and no HR-set status is Alpha. Sat/Sun are off by
// default and NEVER auto-penalized as Alpha, but field techs regularly
// pull weekend shifts (data center troubleshooting), so a weekend
// clock-in is tracked as its own "weekend shift" metric rather than
// blended into regular weekday attendance.
//
// Also computes the period's benchmark: the total count of Mon-Fri
// calendar days in the period (a fixed target for the whole period,
// not prorated by how much of it has elapsed) — so HR can compare
// "Target Hari Kerja" against actual Hadir at a glance.
//
// Aggregated server-side in one pass over one period's attendance_logs
// (a few thousand rows at most for this headcount) — plenty fast
// without needing a SQL view; the per-day detail this produces is also
// exactly what the Excel export needs, so the client never re-derives
// it or makes a second request.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get("year"))
  const month = Number(searchParams.get("month")) // 1-12, names the period by its closing month

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Parameter year dan month (1-12) wajib diisi" }, { status: 400 })
  }

  const { gte, lt } = jakartaPayrollPeriodRangeUTC(year, month)
  const dayHeaders = getPayrollPeriodDays(year, month)
  const today = getJakartaToday()
  const todayYMD = { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() }

  const logParams = new URLSearchParams()
  logParams.set("select", "employee_id,recorded_at,status,remarks")
  logParams.append("recorded_at", `gte.${gte}`)
  logParams.append("recorded_at", `lt.${lt}`)
  logParams.set("order", "recorded_at.asc")

  const [logsRes, employeesRes] = await Promise.all([
    fetch(`${supabaseConfig.url}/rest/v1/attendance_logs?${logParams}`, { headers: headers(), cache: "no-store" }),
    fetch(`${supabaseConfig.url}/rest/v1/employees?select=employee_id,full_name&employee_id=not.is.null&order=full_name.asc`, {
      headers: headers(),
      cache:   "no-store",
    }),
  ])

  if (!logsRes.ok || !employeesRes.ok) {
    return NextResponse.json({ error: "Gagal memuat rekap periode" }, { status: 500 })
  }

  const logRows = await logsRes.json() as {
    employee_id: string
    recorded_at: string
    status:      string
    remarks:     string | null
  }[]
  const employeeRows = await employeesRes.json() as { employee_id: string; full_name: string }[]

  const jakartaYMDFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year:     "numeric",
    month:    "2-digit",
    day:      "2-digit",
  })
  const jakartaTimeFormatter = new Intl.DateTimeFormat("id-ID", {
    hour:     "2-digit",
    minute:   "2-digit",
    timeZone: "Asia/Jakarta",
  })

  function jakartaYMD(iso: string) {
    const parts = jakartaYMDFormatter.formatToParts(new Date(iso))
    return {
      year:  Number(parts.find(p => p.type === "year")?.value),
      month: Number(parts.find(p => p.type === "month")?.value),
      day:   Number(parts.find(p => p.type === "day")?.value),
    }
  }

  // Keyed by "year-month-day" — day-of-month alone would collide across
  // the two calendar months this period spans (both have a "1", a "15"...).
  const dayKey = (d: { year: number; month: number; day: number }) => `${d.year}-${d.month}-${d.day}`

  const byEmployee = new Map<string, Map<string, typeof logRows[number]>>()
  for (const row of logRows) {
    const key = dayKey(jakartaYMD(row.recorded_at))
    if (!byEmployee.has(row.employee_id)) byEmployee.set(row.employee_id, new Map())
    byEmployee.get(row.employee_id)!.set(key, row)
  }

  const expectedWorkdays = dayHeaders.filter(d => !d.isWeekend).length

  function buildRow(day: PayrollPeriodDay, log: typeof logRows[number] | undefined, totals: {
    weekdayMasuk: number; weekendShifts: number; cuti: number; sakit: number; izin: number; alpha: number
  }, keteranganParts: string[]): string {
    const isFuture = compareYMD(day, todayYMD) > 0
    if (isFuture) return ""

    if (!log) {
      if (day.isWeekend) return "Libur"
      totals.alpha++
      return "Alpha"
    }

    if (log.remarks) keteranganParts.push(`${day.dateLabel}: ${log.remarks}`)

    if (log.status === "masuk") {
      if (day.isWeekend) totals.weekendShifts++
      else totals.weekdayMasuk++
      return jakartaTimeFormatter.format(new Date(log.recorded_at))
    }

    // Weekends never count toward Alpha even if a status row somehow says
    // so — only an explicit weekday no-show produces that bucket.
    if (log.status === "alpha") {
      if (!day.isWeekend) totals.alpha++
    } else if (log.status === "cuti" || log.status === "sakit" || log.status === "izin") {
      totals[log.status as "cuti" | "sakit" | "izin"]++
    }
    return STATUS_LABEL[log.status] ?? log.status
  }

  const employees = employeeRows.map(emp => {
    const logsByDay = byEmployee.get(emp.employee_id) ?? new Map()
    const totals = { weekdayMasuk: 0, weekendShifts: 0, cuti: 0, sakit: 0, izin: 0, alpha: 0 }
    const keteranganParts: string[] = []

    const cells = dayHeaders.map(day => buildRow(day, logsByDay.get(dayKey(day)), totals, keteranganParts))

    return {
      employeeId: emp.employee_id,
      fullName:   emp.full_name,
      cells,
      totals,
      keterangan: keteranganParts.join("; "),
    }
  })

  return NextResponse.json({
    year,
    month,
    periodLabel: getPayrollPeriodLabel(year, month),
    daysInPeriod: dayHeaders.length,
    expectedWorkdays,
    dayHeaders,
    employees,
  })
}
