"use client"

import { UserCheck, UserX, Thermometer, Plane, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AttendanceSummary } from "../_hooks/use-attendance-summary"

type CardKey = "present" | "alpha" | "sick" | "leave"

const CARDS: Array<{ key: CardKey; label: string; icon: LucideIcon; tone: string; note?: string }> = [
  { key: "present", label: "Total Hadir", icon: UserCheck,   tone: "bg-hr-brand" },
  { key: "alpha",   label: "Alpha",       icon: UserX,       tone: "bg-hr-danger-grad" },
  { key: "sick",    label: "Sakit",       icon: Thermometer, tone: "bg-hr-warning-grad", note: "Modul Leave Management — segera hadir" },
  { key: "leave",   label: "Cuti",        icon: Plane,       tone: "bg-hr-info-grad",    note: "Modul Leave Management — segera hadir" },
]

export function KpiCards({ summary, isLoading }: { summary: AttendanceSummary | undefined; isLoading: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {CARDS.map(card => (
        <div key={card.key} className="rounded-hr-xl border border-hr-hairline bg-white p-4 shadow-hr-card">
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
          {card.note && <p className="mt-1 font-hr-sans text-[11px] text-hr-text-3">{card.note}</p>}
        </div>
      ))}
    </div>
  )
}
