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

const DAY_ABBR = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] // JS Date#getDay(): 0 = Sunday
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"]

function daysInCalendarMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Payroll runs on a 26th-to-25th cut-off, not the calendar month — books
// close on the 25th, salaries go out ~27th-28th. A "period" is named by
// the month containing its closing 25th (e.g. period (2026, 8) = "August"
// = Jul 26 through Aug 25 inclusive), matching how HR already talks about
// payroll months. This resolves that period to the *previous* calendar
// month's 26th (where it actually starts) plus its length in days.
export function getPayrollPeriodRange(year: number, month: number): { prevYear: number; prevMonth: number; length: number } {
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const tailDays = daysInCalendarMonth(prevYear, prevMonth) - 26 + 1 // 26..end-of-prevMonth
  return { prevYear, prevMonth, length: tailDays + 25 } // + 1..25 of month
}

// [gte, lt) UTC range for one payroll period — same fixed-offset approach
// as jakartaDayRangeUTC, anchored to the 26th instead of the 1st.
export function jakartaPayrollPeriodRangeUTC(year: number, month: number): { gte: string; lt: string } {
  const { prevYear, prevMonth } = getPayrollPeriodRange(year, month)
  const pad = (n: number) => String(n).padStart(2, "0")
  const start = new Date(`${prevYear}-${pad(prevMonth)}-26T00:00:00${JAKARTA_OFFSET}`)
  const end = new Date(`${year}-${pad(month)}-26T00:00:00${JAKARTA_OFFSET}`)
  return { gte: start.toISOString(), lt: end.toISOString() }
}

export interface PayrollPeriodDay {
  year:      number
  month:     number
  day:       number
  dateLabel: string // "26/7" — needed because a period spans two calendar months, so a bare day number repeats (e.g. both months have a "1")
  dowLabel:  string // "Sen"
  isWeekend: boolean
}

// Every calendar date in the period, in order, each tagged with which
// actual month it falls in (since day-of-month alone is ambiguous once
// the range crosses a month boundary) — this is what both the on-screen
// grid and the Excel export's date columns are built from.
export function getPayrollPeriodDays(year: number, month: number): PayrollPeriodDay[] {
  const { prevYear, prevMonth, length } = getPayrollPeriodRange(year, month)
  const start = new Date(prevYear, prevMonth - 1, 26)
  return Array.from({ length }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const dow = d.getDay()
    return {
      year:      d.getFullYear(),
      month:     d.getMonth() + 1,
      day:       d.getDate(),
      dateLabel: `${d.getDate()}/${d.getMonth() + 1}`,
      dowLabel:  DAY_ABBR[dow],
      isWeekend: dow === 0 || dow === 6,
    }
  })
}

// Human-readable period label, e.g. "26 Jul - 25 Ags 2026".
export function getPayrollPeriodLabel(year: number, month: number): string {
  const { prevYear, prevMonth } = getPayrollPeriodRange(year, month)
  const startLabel = `26 ${MONTH_ABBR[prevMonth - 1]}${prevYear !== year ? ` ${prevYear}` : ""}`
  const endLabel = `25 ${MONTH_ABBR[month - 1]} ${year}`
  return `${startLabel} - ${endLabel}`
}

// The latest payroll period that has actually started as of "today" —
// caps the month/year pickers so HR can't select a period that hasn't
// opened yet. Today's day-of-month decides which period it belongs to:
// the 26th rolls into next month's period (mirrors getPayrollPeriodRange).
export function getCurrentPayrollPeriod(today: Date): { year: number; month: number } {
  const y = today.getFullYear()
  const m = today.getMonth() + 1
  if (today.getDate() <= 25) return { year: y, month: m }
  return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 }
}
