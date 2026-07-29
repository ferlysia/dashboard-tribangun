import type { PmSchedule, Site } from "@/types/pm-schedule"

// Hybrid unit_count resolution: a visit's own override wins if set,
// otherwise fall back to the site's current master total. See the
// 20260801_pm_schedules_recurring.sql migration for the full rationale.
export function effectiveUnitCount(
  schedule: Pick<PmSchedule, "unit_count">,
  site: Pick<Site, "unit_count"> | null | undefined
): number {
  return schedule.unit_count ?? site?.unit_count ?? 0
}

// Pure date math for the recurring generator's smart defaults — spreads
// `totalVisits` evenly across `durationMonths` starting at `startDate`.
// Only ever used to *pre-fill* the per-visit date inputs; every row stays
// individually editable afterward, and this never overwrites a date the
// user already hand-picked (the caller only applies it to rows that don't
// have a user-set date yet). Note: relies on JS Date's own month/day
// rollover, so an edge case like "31st + interval landing in a shorter
// month" can shift a day or two — acceptable for a starting suggestion
// the user is expected to review row-by-row.
export function computeEvenlySpacedDates(startDate: string, durationMonths: number, totalVisits: number): string[] {
  if (totalVisits <= 0 || durationMonths <= 0 || !startDate) return []
  const [year, month, day] = startDate.split("-").map(Number)
  const interval = durationMonths / totalVisits

  return Array.from({ length: totalVisits }, (_, i) => {
    const monthsToAdd = Math.round(i * interval)
    const date = new Date(Date.UTC(year, month - 1 + monthsToAdd, day))
    return date.toISOString().slice(0, 10)
  })
}
