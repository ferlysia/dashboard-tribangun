import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { jakartaMonthRangeUTC, getJakartaToday } from "@/app/hr-dashboard/attendance/_lib/week"

const STATUS_LABEL: Record<string, string> = { alpha: "Alpha", sakit: "Sakit", izin: "Izin", cuti: "Cuti" }
const DAY_ABBR = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] // JS Date#getDay(): 0 = Sunday

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
  }
}

// Payroll's monthly aggregation. Scheduling reality (per explicit HR
// confirmation, not guessed): Mon-Fri are normal working days — a
// weekday with no clock-in and no HR-set status is Alpha. Sat/Sun are
// off by default and NEVER auto-penalized as Alpha, but field techs
// regularly pull weekend shifts (data center troubleshooting), so a
// weekend clock-in is tracked as its own "weekend shift" metric rather
// than being blended into the regular weekday attendance count.
//
// Aggregated server-side in one pass over one month's attendance_logs
// (a few thousand rows at most for this company's headcount) — plenty
// fast without needing a SQL view; the per-day detail this produces is
// also exactly what the Excel export needs, so the client never has to
// re-derive it or make a second request.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get("year"))
  const month = Number(searchParams.get("month")) // 1-12

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Parameter year dan month (1-12) wajib diisi" }, { status: 400 })
  }

  const { gte, lt, daysInMonth } = jakartaMonthRangeUTC(year, month)
  const today = getJakartaToday()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  const todayDay = today.getDate()

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
    return NextResponse.json({ error: "Gagal memuat rekap bulanan" }, { status: 500 })
  }

  const logRows = await logsRes.json() as {
    employee_id: string
    recorded_at: string
    status:      string
    remarks:     string | null
  }[]
  const employeeRows = await employeesRes.json() as { employee_id: string; full_name: string }[]

  const jakartaDayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", day: "2-digit" })
  const jakartaTimeFormatter = new Intl.DateTimeFormat("id-ID", {
    hour:     "2-digit",
    minute:   "2-digit",
    timeZone: "Asia/Jakarta",
  })

  const byEmployee = new Map<string, Map<number, typeof logRows[number]>>()
  for (const row of logRows) {
    const day = Number(jakartaDayFormatter.format(new Date(row.recorded_at)))
    if (!byEmployee.has(row.employee_id)) byEmployee.set(row.employee_id, new Map())
    byEmployee.get(row.employee_id)!.set(day, row)
  }

  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const dow = new Date(year, month - 1, day).getDay()
    return { day, label: DAY_ABBR[dow], isWeekend: dow === 0 || dow === 6 }
  })

  const employees = employeeRows.map(emp => {
    const logsByDay = byEmployee.get(emp.employee_id) ?? new Map()
    const cells: string[] = []
    const totals = { weekdayMasuk: 0, weekendShifts: 0, cuti: 0, sakit: 0, izin: 0, alpha: 0 }
    const keteranganParts: string[] = []

    for (const { day, isWeekend } of dayHeaders) {
      const isFuture = isCurrentMonth && day > todayDay
      const log = logsByDay.get(day)

      if (isFuture) {
        cells.push("")
        continue
      }

      if (!log) {
        // No row: a weekday no-show is Alpha; a weekend with nothing
        // logged is just a day off, never penalized.
        if (isWeekend) {
          cells.push("Libur")
        } else {
          cells.push("Alpha")
          totals.alpha++
        }
        continue
      }

      if (log.remarks) keteranganParts.push(`${day}: ${log.remarks}`)

      if (log.status === "masuk") {
        cells.push(jakartaTimeFormatter.format(new Date(log.recorded_at)))
        if (isWeekend) totals.weekendShifts++
        else totals.weekdayMasuk++
        continue
      }

      cells.push(STATUS_LABEL[log.status] ?? log.status)
      // Weekends never count toward Alpha even if a status row somehow
      // says so — only an explicit weekday no-show produces that bucket.
      if (log.status === "alpha") {
        if (!isWeekend) totals.alpha++
      } else if (log.status === "cuti" || log.status === "sakit" || log.status === "izin") {
        totals[log.status as "cuti" | "sakit" | "izin"]++
      }
    }

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
    daysInMonth,
    monthLabel: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1)),
    dayHeaders,
    employees,
  })
}
