import type { PmScheduleStatus } from "@/types/pm-schedule"

// Deliberately NOT the pale bg-{c}-50/text-{c}-700 convention used
// elsewhere in the app (purchasing-request, maintenance-assets) — this page
// specifically wants the Monday.com "solid pill" look: saturated background,
// white text, high contrast against a plain grid. Planned stays a softer
// neutral tone on purpose (it's the "nothing's happened yet" state).
export const STATUS_CFG: Record<PmScheduleStatus, { label: string; badge: string }> = {
  PLANNED:     { label: "Planned",       badge: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100" },
  ANNOUNCED:   { label: "Announced",     badge: "bg-cyan-500 text-white dark:bg-cyan-600" },
  IN_PROGRESS: { label: "Working on it", badge: "bg-blue-500 text-white dark:bg-blue-600" },
  COMPLETED:   { label: "Done",          badge: "bg-green-500 text-white dark:bg-green-600" },
  RESCHEDULED: { label: "Rescheduled",   badge: "bg-orange-500 text-white dark:bg-orange-600" },
}

export const STATUS_OPTIONS: PmScheduleStatus[] = ["PLANNED", "ANNOUNCED", "IN_PROGRESS", "COMPLETED", "RESCHEDULED"]

export function StatusBadge({ status }: { status: PmScheduleStatus }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-md font-semibold whitespace-nowrap shadow-sm ${cfg.badge}`}>
      {cfg.label}
    </span>
  )
}
