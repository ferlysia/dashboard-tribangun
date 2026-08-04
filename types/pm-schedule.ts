export type PmScheduleStatus = "PLANNED" | "ANNOUNCED" | "IN_PROGRESS" | "COMPLETED" | "RESCHEDULED"

export type Region = "JABO" | "CIKARANG"

// Freeform breakdown of equipment at a site/visit, e.g. [{type:"PAC",qty:2},
// {type:"UPS",qty:1}] — `type` is user-typed, not an enum. See
// lib/pm-schedule/recurring.ts#effectiveUnitTypes for the site/visit
// fallback resolution, mirroring unit_count's inherit pattern.
export interface UnitTypeEntry {
  type: string
  qty:  number
}

export interface Site {
  id:         string
  name:       string
  is_active:  boolean
  // Master total units/equipment at this site — editable anytime (e.g.
  // Sales upsells more units). Falls through as the default for any visit
  // that has no per-visit override (see PmSchedule.unit_count).
  unit_count: number
  // Master type/qty breakdown — takes precedence over unit_count wherever
  // it's non-empty. Empty (the default for legacy sites) falls back to the
  // plain unit_count display until an admin fills it in via the drawer.
  unit_types: UnitTypeEntry[]
  region:     Region
  created_at: string
}

export interface PmSchedule {
  id:              string
  site_id:         string
  scheduled_date:  string   // ISO date
  scheduled_month: string   // ISO date, truncated to the 1st of the month
  status:          PmScheduleStatus
  // Always optional/empty by default, including on recurring/batch-created
  // visits — technicians are assigned dynamically ~1 week before the visit,
  // never at scheduling time. See lib/pm-schedule/recurring.ts.
  assignees:       string[]
  // Per-visit override of sites.unit_count. null = inherit the site's
  // current total. See lib/pm-schedule/recurring.ts#effectiveUnitCount.
  unit_count:      number | null
  // Per-visit override of sites.unit_types. null/empty = inherit the site's
  // breakdown (or fall back to unit_count if that's also empty).
  unit_types:      UnitTypeEntry[] | null
  // Units actually completed. null until the visit is marked COMPLETED, at
  // which point the API auto-fills it to the target unless the client
  // explicitly supplies a value in the same request — admin can edit it
  // afterward for partial completion (e.g. 4 of 8 done).
  actual_unit_count: number | null
  notes:           string | null
  report_submitted: boolean
  completed_at:    string | null
  // Append-only log of every scheduled_date change, oldest first. Logged on
  // any date edit, not just ones made via the RESCHEDULED status — see the
  // 20260802 migration.
  reschedule_history: { from: string; to: string; at: string }[]
  created_at:      string
  updated_at:      string
  // Embedded via PostgREST select=*,sites(*) on the list endpoint.
  sites?:          Site
}
