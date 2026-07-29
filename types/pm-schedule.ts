export type PmScheduleStatus = "PLANNED" | "ANNOUNCED" | "IN_PROGRESS" | "COMPLETED" | "RESCHEDULED"

export interface Site {
  id:         string
  name:       string
  is_active:  boolean
  // Master total units/equipment at this site — editable anytime (e.g.
  // Sales upsells more units). Falls through as the default for any visit
  // that has no per-visit override (see PmSchedule.unit_count).
  unit_count: number
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
  notes:           string | null
  report_submitted: boolean
  completed_at:    string | null
  created_at:      string
  updated_at:      string
  // Embedded via PostgREST select=*,sites(*) on the list endpoint.
  sites?:          Site
}
