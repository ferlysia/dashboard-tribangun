"use client"

import * as React from "react"
import type { PmSchedule } from "@/types/pm-schedule"
import { STATUS_CFG } from "./status-badge"

const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function CalendarView({ schedules, month, onOpenDrawer }: {
  schedules:     PmSchedule[]
  month:         string   // "YYYY-MM-01"
  onOpenDrawer:  (id: string) => void
}) {
  const byDay = React.useMemo(() => {
    const map = new Map<string, PmSchedule[]>()
    for (const s of schedules) {
      const day = s.scheduled_date.slice(0, 10)
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(s)
    }
    return map
  }, [schedules])

  const cells = React.useMemo(() => {
    const [year, monthIdx] = month.split("-").map(Number)
    const firstOfMonth = new Date(Date.UTC(year, monthIdx - 1, 1))
    const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7 // 0 = Monday
    const gridStart = new Date(firstOfMonth)
    gridStart.setUTCDate(gridStart.getUTCDate() - firstWeekday)

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart)
      date.setUTCDate(date.getUTCDate() + i)
      return { date, inMonth: date.getUTCMonth() === monthIdx - 1 }
    })
  }, [month])

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAY_LABELS.map(label => (
          <div key={label} className="px-2 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map(({ date, inMonth }) => {
          const day = isoDay(date)
          const items = byDay.get(day) ?? []
          return (
            <div
              key={day}
              className={`min-h-[100px] border-b border-r border-border p-1.5 last:border-r-0 ${inMonth ? "" : "bg-muted/10"}`}
            >
              <p className={`text-[11px] mb-1 ${inMonth ? "text-foreground" : "text-muted-foreground/50"}`}>
                {date.getUTCDate()}
              </p>
              <div className="flex flex-col gap-1">
                {items.slice(0, 3).map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onOpenDrawer(s.id)}
                    title={s.sites?.name ?? ""}
                    className={`text-[10px] px-1.5 py-0.5 rounded truncate text-left ${STATUS_CFG[s.status].badge}`}
                  >
                    {s.sites?.name ?? "—"}
                  </button>
                ))}
                {items.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1.5">+{items.length - 3} lagi</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
