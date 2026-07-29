export type PmScheduleStatus = "PLANNED" | "ANNOUNCED" | "IN_PROGRESS" | "COMPLETED" | "RESCHEDULED"

export interface Site {
  id:         string
  name:       string
  is_active:  boolean
  created_at: string
}

export interface PmSchedule {
  id:              string
  site_id:         string
  scheduled_date:  string   // ISO date
  scheduled_month: string   // ISO date, truncated to the 1st of the month
  status:          PmScheduleStatus
  assignee:        string | null
  notes:           string | null
  report_submitted: boolean
  completed_at:    string | null
  created_at:      string
  updated_at:      string
  // Embedded via PostgREST select=*,sites(*) on the list endpoint.
  sites?:          Site
}
