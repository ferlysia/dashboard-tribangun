import type { PmSchedule, PmScheduleStatus } from "@/types/pm-schedule"

// Main lifecycle is strictly forward. RESCHEDULED is a side-branch, not a
// step in it — reachable from any in-flight status when a visit gets pushed
// to a new date, and re-enters the flow at PLANNED/ANNOUNCED once the new
// date is set, rather than ever being a completion state.
const STATUS_ADJACENCY: Record<PmScheduleStatus, PmScheduleStatus[]> = {
  PLANNED:     ["ANNOUNCED", "RESCHEDULED"],
  ANNOUNCED:   ["PLANNED", "IN_PROGRESS", "RESCHEDULED"],
  IN_PROGRESS: ["ANNOUNCED", "COMPLETED", "RESCHEDULED"],
  COMPLETED:   ["IN_PROGRESS"],
  RESCHEDULED: ["PLANNED", "ANNOUNCED"],
}

export function isLegalStatusChange(from: PmScheduleStatus, to: PmScheduleStatus): boolean {
  return from === to || (STATUS_ADJACENCY[from]?.includes(to) ?? false)
}

export function getLegalNextStatuses(status: PmScheduleStatus): PmScheduleStatus[] {
  return STATUS_ADJACENCY[status] ?? []
}

export function isCompleted(schedule: Pick<PmSchedule, "status">): boolean {
  return schedule.status === "COMPLETED"
}

// "Pending Reports" KPI — a completed visit whose report hasn't been
// logged as submitted yet (report_submitted is a toggle, not a file upload
// — see the 20260731 migration).
export function isPendingReport(schedule: Pick<PmSchedule, "status" | "report_submitted">): boolean {
  return schedule.status === "COMPLETED" && !schedule.report_submitted
}

export interface ScheduleKpis {
  activeSites:      number
  targetVisits:     number
  pendingReports:   number
  completedVisits:  number
}

// All 4 KPI-bar numbers derived from one already-fetched month's worth of
// schedules — no separate query, matching the "one shared query powers
// everything" data-fetching strategy.
export function deriveKpis(schedules: PmSchedule[]): ScheduleKpis {
  const siteIds = new Set(schedules.map(s => s.site_id))
  return {
    activeSites:     siteIds.size,
    targetVisits:    schedules.length,
    pendingReports:  schedules.filter(isPendingReport).length,
    completedVisits: schedules.filter(isCompleted).length,
  }
}
