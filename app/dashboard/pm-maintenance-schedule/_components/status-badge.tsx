import type { PmScheduleStatus } from "@/types/pm-schedule"

// Same Record<Status, {label, badge}> + Tailwind bg-{c}-50/text-{c}-700/
// dark:bg-{c}-950/40/dark:text-{c}-400 convention used across the app
// (purchasing-request, maintenance-assets) — extracted here since this is
// the 3rd near-duplicate of the pattern.
export const STATUS_CFG: Record<PmScheduleStatus, { label: string; badge: string }> = {
  PLANNED:     { label: "Planned",       badge: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300" },
  ANNOUNCED:   { label: "Announced",     badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  IN_PROGRESS: { label: "Working on it", badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  COMPLETED:   { label: "Done",          badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  RESCHEDULED: { label: "Rescheduled",   badge: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" },
}

export const STATUS_OPTIONS: PmScheduleStatus[] = ["PLANNED", "ANNOUNCED", "IN_PROGRESS", "COMPLETED", "RESCHEDULED"]

export function StatusBadge({ status }: { status: PmScheduleStatus }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${cfg.badge}`}>
      {cfg.label}
    </span>
  )
}
