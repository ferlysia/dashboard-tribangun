// Jakarta wall-clock day helpers, scoped to the clock-in module. A field
// tech's "today" is their Jakarta calendar day regardless of their
// phone's own timezone or clock — deliberately duplicated here rather
// than imported from the HR dashboard's own copy (app/hr-dashboard/
// attendance/_lib/week.ts) so this public, unauthenticated module stays
// fully decoupled from the internal HR route tree.

const JAKARTA_OFFSET = "+07:00"

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

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

// [gte, lt) UTC range for a Jakarta calendar day — for attendance_logs.recorded_at filters.
export function jakartaDayRangeUTC(dateKey: string): { gte: string; lt: string } {
  const start = new Date(`${dateKey}T00:00:00${JAKARTA_OFFSET}`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { gte: start.toISOString(), lt: end.toISOString() }
}
