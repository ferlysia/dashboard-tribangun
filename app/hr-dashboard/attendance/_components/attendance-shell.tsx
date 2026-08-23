"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { WeekNavigator } from "./week-navigator"
import { KpiCards, type StatusFilter } from "./kpi-cards"
import { AttendanceTable } from "./attendance-table"
import { useAttendanceSummary } from "../_hooks/use-attendance-summary"
import { useAttendanceTable } from "../_hooks/use-attendance-table"
import { useAttendanceRealtime } from "../_hooks/use-attendance-realtime"
import { toDateKey } from "../_lib/week"
import { cn } from "@/lib/utils"

// Default active view: week of August 24, 2026.
const DEFAULT_DATE = new Date(2026, 7, 24)

// Polling fallback interval — only kicks in if the SSE stream is down
// (e.g. a host that doesn't support long-lived streaming responses). While
// the stream is healthy, the push from useAttendanceRealtime is the sole
// update path, so there's no redundant network chatter.
const FALLBACK_POLL_MS = 5_000

export function AttendanceShell() {
  const [selected, setSelected] = React.useState(DEFAULT_DATE)
  const [filter, setFilter] = React.useState<StatusFilter>("all")
  const dateKey = toDateKey(selected)
  const queryClient = useQueryClient()

  const { streamHealthy } = useAttendanceRealtime(() => {
    queryClient.invalidateQueries({ queryKey: ["hr-attendance-summary", dateKey] })
    queryClient.invalidateQueries({ queryKey: ["hr-attendance-table", dateKey] })
  })

  const summaryQuery = useAttendanceSummary(dateKey, { refetchInterval: streamHealthy ? false : FALLBACK_POLL_MS })
  const tableQuery = useAttendanceTable(dateKey, { refetchInterval: streamHealthy ? false : FALLBACK_POLL_MS })

  React.useEffect(() => {
    setFilter("all")
  }, [dateKey])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="hr-eyebrow w-fit">Attendance Dashboard</span>
          <span
            className="flex items-center gap-1.5 font-hr-sans text-[11px] font-semibold text-hr-text-2"
            title={streamHealthy ? "Terhubung real-time" : "Mode polling — pembaruan setiap 5 detik"}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", streamHealthy ? "animate-pulse bg-hr-success" : "bg-hr-warning")} />
            {streamHealthy ? "Live" : "Polling"}
          </span>
        </div>
        <h1 className="hr-display-title pr-1 text-3xl sm:text-4xl">
          Employee <em>Attendance</em>
        </h1>
        <p className="font-hr-sans text-sm text-hr-text-2">Pantau clock-in tim lapangan secara real-time, per hari.</p>
      </header>

      <WeekNavigator selected={selected} onSelect={setSelected} />
      <KpiCards summary={summaryQuery.data} isLoading={summaryQuery.isLoading} filter={filter} onFilterChange={setFilter} />
      <AttendanceTable rows={tableQuery.data?.data} isLoading={tableQuery.isLoading} date={dateKey} filter={filter} />
    </div>
  )
}
