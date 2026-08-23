"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { WeekNavigator } from "./week-navigator"
import { KpiCards } from "./kpi-cards"
import { LiveFeed } from "./live-feed"
import { useAttendanceSummary } from "../_hooks/use-attendance-summary"
import { useAttendanceFeed } from "../_hooks/use-attendance-feed"
import { useAttendanceRealtime } from "../_hooks/use-attendance-realtime"
import { toDateKey } from "../_lib/week"

// Default active view: week of August 24, 2026.
const DEFAULT_DATE = new Date(2026, 7, 24)

// Polling fallback interval — only kicks in if the SSE stream is down
// (e.g. a host that doesn't support long-lived streaming responses). While
// the stream is healthy, the push from useAttendanceRealtime is the sole
// update path, so there's no redundant network chatter.
const FALLBACK_POLL_MS = 5_000

export function AttendanceShell() {
  const [selected, setSelected] = React.useState(DEFAULT_DATE)
  const dateKey = toDateKey(selected)
  const queryClient = useQueryClient()

  const { streamHealthy } = useAttendanceRealtime(() => {
    queryClient.invalidateQueries({ queryKey: ["hr-attendance-summary", dateKey] })
    queryClient.invalidateQueries({ queryKey: ["hr-attendance-feed", dateKey] })
  })

  const summaryQuery = useAttendanceSummary(dateKey, { refetchInterval: streamHealthy ? false : FALLBACK_POLL_MS })
  const feedQuery = useAttendanceFeed(dateKey, { refetchInterval: streamHealthy ? false : FALLBACK_POLL_MS })

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <span className="hr-eyebrow w-fit">Attendance Dashboard</span>
        <h1 className="hr-display-title text-3xl sm:text-4xl">
          Kehadiran <em>Tim Lapangan</em>
        </h1>
        <p className="font-hr-sans text-sm text-hr-text-2">
          Pantau clock-in tim lapangan secara real-time, per hari.
          {!streamHealthy && (
            <span className="ml-2 font-semibold text-hr-warning-deep">
              (mode polling — koneksi live terputus)
            </span>
          )}
        </p>
      </header>

      <WeekNavigator selected={selected} onSelect={setSelected} />
      <KpiCards summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />
      <LiveFeed items={feedQuery.data?.data} isLoading={feedQuery.isLoading} />
    </div>
  )
}
