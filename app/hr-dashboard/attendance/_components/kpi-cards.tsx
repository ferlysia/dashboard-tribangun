"use client"

import { UserCheck, UserX, Thermometer, Plane, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AttendanceSummary } from "../_hooks/use-attendance-summary"

export type StatusFilter = "all" | "present" | "alpha" | "sick" | "leave"

const CARDS: Array<{ key: Exclude<StatusFilter, "all">; label: string; icon: LucideIcon; tone: string }> = [
  { key: "present", label: "Total Hadir", icon: UserCheck,   tone: "bg-hr-brand" },
  { key: "alpha",   label: "Alpha",       icon: UserX,       tone: "bg-hr-danger-grad" },
  { key: "sick",    label: "Sakit",       icon: Thermometer, tone: "bg-hr-warning-grad" },
  { key: "leave",   label: "Cuti",        icon: Plane,       tone: "bg-hr-info-grad" },
]

// The KPI cards double as table filters: clicking one narrows the table
// below to that status, clicking the active one again clears the filter.
export function KpiCards({
  summary,
  isLoading,
  filter,
  onFilterChange,
}: {
  summary:        AttendanceSummary | undefined
  isLoading:      boolean
  filter:         StatusFilter
  onFilterChange: (next: StatusFilter) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {CARDS.map(card => {
        const active = filter === card.key
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onFilterChange(active ? "all" : card.key)}
            className={cn(
              "rounded-hr-xl border bg-white p-4 text-left shadow-hr-card transition-all hover:-translate-y-0.5",
              active ? "border-hr-rose ring-2 ring-hr-rose/30" : "border-hr-hairline"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-hr-sans text-xs font-semibold uppercase tracking-hr-eyebrow text-hr-text-2">
                {card.label}
              </span>
              <span className={cn("grid h-8 w-8 place-items-center rounded-full text-white", card.tone)}>
                <card.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 font-hr-display text-3xl font-black text-hr-ink">
              {isLoading || !summary ? "–" : summary[card.key]}
            </p>
          </button>
        )
      })}
    </div>
  )
}
