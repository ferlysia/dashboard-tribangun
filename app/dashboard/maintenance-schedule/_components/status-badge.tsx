import type { PmScheduleStatus } from "@/types/pm-schedule"

// Deliberately NOT the pale bg-{c}-50/text-{c}-700 convention used
// elsewhere in the app (purchasing-request, maintenance-assets) — this page
// wants the exact Monday.com palette: solid, saturated hex backgrounds with
// white text, unchanged between light/dark (Monday's own status colors
// don't shift per theme either).
export const STATUS_CFG: Record<PmScheduleStatus, { label: string; badge: string }> = {
  PLANNED:     { label: "Planned",       badge: "bg-[#A25DDC] text-white" },
  ANNOUNCED:   { label: "Announced",     badge: "bg-[#579BFC] text-white" },
  IN_PROGRESS: { label: "Working on it", badge: "bg-[#FDAB3D] text-white" },
  COMPLETED:   { label: "Done",          badge: "bg-[#00C875] text-white" },
  RESCHEDULED: { label: "Rescheduled",   badge: "bg-[#E2445C] text-white" },
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
