// Shared business-day (Mon–Fri) date math — used anywhere an aging/SLA/due
// date must not count weekends against the elapsed time (e.g. the PR
// Dashboard's sourcing SLA). All functions operate on local calendar days,
// midnight-normalized, to avoid time-of-day drift.

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6 // Sun, Sat
}

// Adds `days` business days to `start` (skips Sat/Sun entirely) — e.g.
// Friday + 2 business days = Tuesday, not Sunday.
export function addBusinessDays(start: Date, days: number): Date {
  const result = atMidnight(start)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    if (!isWeekend(result)) added++
  }
  return result
}

// Business-day difference between two dates: how many Mon–Fri days separate
// them, walking day-by-day and skipping weekends — e.g. Friday -> Monday is
// 1 business day, not 3 calendar days. Positive when endDate is after
// startDate, negative when it's before (mirrors endDate.getTime() -
// startDate.getTime() in sign, just weekend-aware).
export function getBusinessDaysDifference(startDate: Date, endDate: Date): number {
  const start = atMidnight(startDate)
  const end   = atMidnight(endDate)
  if (start.getTime() === end.getTime()) return 0

  const sign = end > start ? 1 : -1
  const [from, to] = sign === 1 ? [start, end] : [end, start]

  let count = 0
  const cursor = new Date(from)
  while (cursor.getTime() < to.getTime()) {
    cursor.setDate(cursor.getDate() + 1)
    if (!isWeekend(cursor)) count++
  }
  return sign * count
}
