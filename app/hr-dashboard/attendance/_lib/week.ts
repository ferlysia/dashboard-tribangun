// Mon–Sun week helpers for the HR Attendance Dashboard. Field workers'
// "day" is their Jakarta wall-clock day, not UTC or the viewer's local
// timezone, so day boundaries are computed against a fixed +07:00 offset
// (Asia/Jakarta has no DST) rather than server/browser local time. Shared
// between the client (week navigator, query keys) and the summary/feed API
// routes so both sides agree on exactly what "today" means.

const JAKARTA_OFFSET = "+07:00"

// "Today" as HR's Jakarta wall-clock day sees it, expressed as a Date
// whose *local* (browser) year/month/day components already read as the
// correct Jakarta calendar date — matching how toDateKey/getWeekDays
// below read Date objects (via getFullYear/getMonth/getDate), regardless
// of what timezone the viewer's own device is actually in.
export function getJakartaToday(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year:     "numeric",
    month:    "2-digit",
    day:      "2-digit",
  }).formatToParts(new Date())
  const y = Number(parts.find(p => p.type === "year")?.value)
  const m = Number(parts.find(p => p.type === "month")?.value)
  const d = Number(parts.find(p => p.type === "day")?.value)
  return new Date(y, m - 1, d)
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function getWeekDays(anchor: Date): Date[] {
  const dow = anchor.getDay() // 0 = Sun .. 6 = Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + mondayOffset)
  return Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
  )
}

export function addWeeks(anchor: Date, weeks: number): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + weeks * 7)
}

// [gte, lt) UTC range for a Jakarta calendar day — for attendance_logs.recorded_at filters.
export function jakartaDayRangeUTC(dateKey: string): { gte: string; lt: string } {
  const start = new Date(`${dateKey}T00:00:00${JAKARTA_OFFSET}`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { gte: start.toISOString(), lt: end.toISOString() }
}

// [gte, lt) UTC range for a full Jakarta calendar month (month is 1-12) —
// same fixed-offset approach as jakartaDayRangeUTC, generalized to a
// month for the Monthly Recap aggregation.
export function jakartaMonthRangeUTC(year: number, month: number): { gte: string; lt: string; daysInMonth: number } {
  const daysInMonth = new Date(year, month, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, "0")
  const start = new Date(`${year}-${pad(month)}-01T00:00:00${JAKARTA_OFFSET}`)
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const end = new Date(`${nextYear}-${pad(nextMonth)}-01T00:00:00${JAKARTA_OFFSET}`)
  return { gte: start.toISOString(), lt: end.toISOString(), daysInMonth }
}
