import type { PmSchedule, Site, UnitTypeEntry } from "@/types/pm-schedule"

// Hybrid unit_types resolution: a visit's own breakdown wins if non-empty,
// otherwise fall back to the site's master breakdown. Both empty means the
// site/visit hasn't been migrated to the type breakdown yet — callers fall
// back to the plain unit_count in that case (see effectiveUnitCount/
// formatUnitTypes below).
export function effectiveUnitTypes(
  schedule: Pick<PmSchedule, "unit_types">,
  site: Pick<Site, "unit_types"> | null | undefined
): UnitTypeEntry[] {
  if (schedule.unit_types && schedule.unit_types.length > 0) return schedule.unit_types
  if (site?.unit_types && site.unit_types.length > 0) return site.unit_types
  return []
}

// Hybrid unit_count resolution: a visit's own override wins if set,
// otherwise fall back to the site's current master total. See the
// 20260801_pm_schedules_recurring.sql migration for the full rationale.
// Prefers summing the type breakdown when one is set, so the target used
// for actual-completion math stays consistent with whatever the drawer
// shows.
export function effectiveUnitCount(
  schedule: Pick<PmSchedule, "unit_count" | "unit_types">,
  site: Pick<Site, "unit_count" | "unit_types"> | null | undefined
): number {
  const types = effectiveUnitTypes(schedule, site)
  if (types.length > 0) return types.reduce((sum, t) => sum + t.qty, 0)
  return schedule.unit_count ?? site?.unit_count ?? 0
}

// "5 PAC, 3 UPS" — falls back to a plain number for sites/visits that
// haven't been given a type breakdown yet.
export function formatUnitTypes(types: UnitTypeEntry[], fallbackCount: number): string {
  if (types.length === 0) return `${fallbackCount} unit`
  return types.map(t => `${t.qty} ${t.type}`).join(", ")
}

export function isValidUnitTypes(value: unknown): value is UnitTypeEntry[] {
  return Array.isArray(value) && value.every(t => {
    if (!t || typeof t !== "object") return false
    const entry = t as UnitTypeEntry
    if (typeof entry.type !== "string" || entry.type.trim() === "") return false
    if (!Number.isInteger(entry.qty) || entry.qty < 0) return false
    // sns is optional and intentionally not length-locked to qty — partial
    // capture is normal (a unit's SN may not be known yet when scheduling).
    if (entry.sns !== undefined && !(Array.isArray(entry.sns) && entry.sns.every(s => s === null || typeof s === "string"))) return false
    return true
  })
}

// Every non-empty SN across every type entry, flattened — used to display
// a visit's serials in All Sites' "By Site" view and to power the SN
// search filter, without callers needing to know the nested shape.
export function flattenUnitSns(types: UnitTypeEntry[]): string[] {
  return types.flatMap(t => (t.sns ?? []).filter((s): s is string => !!s && s.trim() !== ""))
}

// Pure date math for the recurring generator's smart defaults — spreads
// `totalVisits` evenly across `durationMonths` starting at `startDate`.
// Visit i (1-indexed) lands at +i*(durationMonths/totalVisits) months from
// startDate, so the *last* visit lands exactly at contract end (e.g. 1
// year / 4 visits starting 2026-07-30 -> +3/+6/+9/+12 months, landing on
// 2027-07-30) rather than one interval short of it. Only ever used to
// *pre-fill* the per-visit date inputs; every row stays individually
// editable afterward, and this never overwrites a date the user already
// hand-picked (the caller only applies it to rows that don't have a
// user-set date yet). Note: relies on JS Date's own month/day rollover, so
// an edge case like "31st + interval landing in a shorter month" can shift
// a day or two — acceptable for a starting suggestion the user is expected
// to review row-by-row.
export function computeEvenlySpacedDates(startDate: string, durationMonths: number, totalVisits: number): string[] {
  if (totalVisits <= 0 || durationMonths <= 0 || !startDate) return []
  const [year, month, day] = startDate.split("-").map(Number)
  const interval = durationMonths / totalVisits

  return Array.from({ length: totalVisits }, (_, i) => {
    const monthsToAdd = Math.round((i + 1) * interval)
    const date = new Date(Date.UTC(year, month - 1 + monthsToAdd, day))
    return date.toISOString().slice(0, 10)
  })
}
