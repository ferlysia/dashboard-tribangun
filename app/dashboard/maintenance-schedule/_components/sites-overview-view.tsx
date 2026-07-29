"use client"

import * as React from "react"
import { Pencil } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { PmSchedule, Site } from "@/types/pm-schedule"
import { isCompleted } from "@/lib/pm-schedule/status-rules"
import { useUpdateSite } from "../_hooks/use-pm-schedules"

// Click-to-edit unit_count — this is the "master total, editable anytime"
// surface (e.g. when Sales upsells more units at a site). Per-visit
// overrides live on the schedule itself (see schedule-drawer.tsx), not here.
function UnitCountEditor({ site }: { site: Site }) {
  const updateSite = useUpdateSite()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(String(site.unit_count))

  const commit = () => {
    setEditing(false)
    const n = Number(draft)
    if (!Number.isInteger(n) || n < 0 || n === site.unit_count) {
      setDraft(String(site.unit_count))
      return
    }
    updateSite.mutate({ id: site.id, unit_count: n })
  }

  if (editing) {
    return (
      <input
        type="number"
        min={0}
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit() }}
        className="w-16 rounded-md border border-slate-300 dark:border-slate-700 bg-background text-xs text-foreground px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(String(site.unit_count)); setEditing(true) }}
      className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary transition-colors"
      title="Klik untuk ubah total unit"
    >
      {site.unit_count} unit <Pencil className="h-2.5 w-2.5 opacity-50" />
    </button>
  )
}

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
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-xs text-muted-foreground">
              {visits.length} kunjungan terjadwal · {monthLabel}
            </p>
            <UnitCountEditor site={site} />
          </div>
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
