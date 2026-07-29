"use client"

import * as React from "react"
import { Progress } from "@/components/ui/progress"
import type { PmSchedule, Site } from "@/types/pm-schedule"
import { isCompleted } from "@/lib/pm-schedule/status-rules"

export function SitesOverviewView({ sites, schedules, monthLabel }: {
  sites:       Site[]
  schedules:   PmSchedule[]
  monthLabel:  string
}) {
  const bySite = React.useMemo(() => {
    const map = new Map<string, PmSchedule[]>()
    for (const s of schedules) {
      if (!map.has(s.site_id)) map.set(s.site_id, [])
      map.get(s.site_id)!.push(s)
    }
    return map
  }, [schedules])

  const rows = sites
    .map(site => {
      const visits = bySite.get(site.id) ?? []
      const done = visits.filter(isCompleted).length
      return { site, visits, done, progress: visits.length > 0 ? Math.round((done / visits.length) * 100) : 0 }
    })
    .filter(r => r.visits.length > 0 || r.site.is_active)

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Belum ada site aktif.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {rows.map(({ site, visits, done, progress }) => (
        <div key={site.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{site.name}</p>
            {!site.is_active && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">Nonaktif</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {visits.length} kunjungan terjadwal · {monthLabel}
          </p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
              <span>Selesai</span>
              <span>{done}/{visits.length}</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>
      ))}
    </div>
  )
}
