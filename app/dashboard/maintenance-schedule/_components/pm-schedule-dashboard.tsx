"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, Plus, LayoutGrid, Kanban, Building2, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Region } from "@/types/pm-schedule"
import { deriveKpis } from "@/lib/pm-schedule/status-rules"
import { useAllSchedulesQuery, useSchedulesQuery, useSitesQuery } from "../_hooks/use-pm-schedules"
import { KpiBar } from "./kpi-bar"
import { MatrixGridView } from "./matrix-grid-view"
import { WeeklyBoardView } from "./weekly-board-view"
import { AllSitesView } from "./all-sites-view"
import { CalendarView } from "./calendar-view"
import { ScheduleDrawer } from "./schedule-drawer"
import { CreateScheduleDialog } from "./create-schedule-dialog"

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number)
  const date = new Date(Date.UTC(year, m - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`
}

function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number)
  return `${MONTH_NAMES_ID[m - 1]} ${year}`
}

// Stable references so `.data ?? EMPTY` doesn't create a new array every
// render while queries are loading — keeps the useMemo hooks below from
// recomputing on every render.
const EMPTY_SCHEDULES: never[] = []
const EMPTY_SITES: never[] = []

export function PmScheduleDashboard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  // URL is the single source of truth — so Lidya's tab choice survives a
  // refresh and the URL is shareable/bookmarkable.
  const region: Region = searchParams.get("region") === "CIKARANG" ? "CIKARANG" : "JABO"
  const setRegion = (next: Region) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("region", next)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const [month, setMonth] = React.useState(currentMonth)
  const [activeTab, setActiveTab] = React.useState("matrix")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)

  const schedulesQuery = useSchedulesQuery(month, region)
  const sitesQuery = useSitesQuery(region)
  // Shared with AllSitesView's own useAllSchedulesQuery() call (same query
  // key, deduped by React Query) — kept here too so the Drawer can resolve
  // a selected schedule opened from Calendar or All Sites, both of which
  // can show visits outside the active month that schedulesQuery alone
  // wouldn't contain.
  const allSchedulesQuery = useAllSchedulesQuery(region)

  const schedules = schedulesQuery.data ?? EMPTY_SCHEDULES
  const sites = sitesQuery.data ?? EMPTY_SITES

  const kpis = React.useMemo(() => deriveKpis(schedules), [schedules])
  const assigneeOptions = React.useMemo(
    () => Array.from(new Set(schedules.flatMap(s => s.assignees))).sort(),
    [schedules]
  )
  const selectedSchedule =
    schedules.find(s => s.id === selectedId) ??
    allSchedulesQuery.data?.find(s => s.id === selectedId) ??
    null

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Maintenance Schedule</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Perencanaan &amp; dispatch kunjungan preventive maintenance per site
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border bg-card px-1">
            <button type="button" onClick={() => setMonth(m => shiftMonth(m, -1))} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-foreground px-1 min-w-[110px] text-center">{monthLabel(month)}</span>
            <button type="button" onClick={() => setMonth(m => shiftMonth(m, 1))} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Jadwalkan Kunjungan
          </Button>
        </div>
      </div>

      <Tabs value={region} onValueChange={v => setRegion(v as Region)} className="w-full">
        <TabsList className="h-9">
          <TabsTrigger value="JABO" className="text-xs px-4">Jabo</TabsTrigger>
          <TabsTrigger value="CIKARANG" className="text-xs px-4">Cikarang</TabsTrigger>
        </TabsList>
      </Tabs>

      <KpiBar kpis={kpis} monthLabel={monthLabel(month)} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-9">
          <TabsTrigger value="matrix" className="text-xs gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Matrix Grid</TabsTrigger>
          <TabsTrigger value="board" className="text-xs gap-1.5"><Kanban className="h-3.5 w-3.5" /> Status</TabsTrigger>
          <TabsTrigger value="sites" className="text-xs gap-1.5"><Building2 className="h-3.5 w-3.5" /> All Sites</TabsTrigger>
          <TabsTrigger value="calendar" className="text-xs gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Calendar</TabsTrigger>
        </TabsList>

        {schedulesQuery.isLoading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground mt-4">
            Memuat jadwal...
          </div>
        ) : (
          <>
            <TabsContent value="matrix" className="mt-4">
              <MatrixGridView schedules={schedules} assigneeOptions={assigneeOptions} onOpenDrawer={setSelectedId} />
            </TabsContent>
            <TabsContent value="board" className="mt-4">
              <WeeklyBoardView schedules={schedules} />
            </TabsContent>
            <TabsContent value="sites" className="mt-4">
              <AllSitesView sites={sites} region={region} assigneeOptions={assigneeOptions} onOpenDrawer={setSelectedId} />
            </TabsContent>
            <TabsContent value="calendar" className="mt-4">
              <CalendarView anchorMonth={month} region={region} onOpenDrawer={setSelectedId} />
            </TabsContent>
          </>
        )}
      </Tabs>

      <ScheduleDrawer
        schedule={selectedSchedule}
        assigneeOptions={assigneeOptions}
        onClose={() => setSelectedId(null)}
      />
      <CreateScheduleDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        sites={sites}
        month={month}
        region={region}
        assigneeOptions={assigneeOptions}
      />
    </div>
  )
}
