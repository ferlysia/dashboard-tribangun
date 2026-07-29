"use client"

import * as React from "react"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { PmSchedule } from "@/types/pm-schedule"
import { STATUS_CFG, STATUS_OPTIONS } from "./status-badge"
import { ScheduleTableRow } from "./schedule-table-row"
import { weekOfMonth } from "@/lib/pm-schedule/status-rules"

// Columns are declared as TanStack Table ColumnDefs (headless — no
// sorting/filtering wired up yet, kept lean for V1) so the header row is
// driven by the same model the cells eventually render through, and
// sorting/pinning/column-resize are drop-in additions later without a
// rewrite.
const columns: ColumnDef<PmSchedule>[] = [
  { id: "site",     header: "Site" },
  { id: "date",     header: "Tanggal" },
  { id: "status",   header: "Status" },
  { id: "assignee", header: "Assignee" },
  { id: "unit",     header: "Unit" },
  { id: "report",   header: "Laporan" },
  { id: "notes",    header: "Catatan" },
]

export function MatrixGridView({ schedules, assigneeOptions, onOpenDrawer }: {
  schedules:        PmSchedule[]
  assigneeOptions:  string[]
  onOpenDrawer:     (id: string) => void
}) {
  const table = useReactTable({
    data: schedules,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const [collapsedWeeks, setCollapsedWeeks] = React.useState<Set<number>>(new Set())
  const toggleWeek = (week: number) =>
    setCollapsedWeeks(prev => {
      const next = new Set(prev)
      if (next.has(week)) next.delete(week)
      else next.add(week)
      return next
    })

  const weeks = React.useMemo(() => {
    const groups = new Map<number, PmSchedule[]>()
    for (const s of schedules) {
      const w = weekOfMonth(s.scheduled_date)
      if (!groups.has(w)) groups.set(w, [])
      groups.get(w)!.push(s)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b)
  }, [schedules])

  if (schedules.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Belum ada jadwal kunjungan di bulan ini.
      </div>
    )
  }

  return (
    <div className="rounded-lg border-2 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <table className="w-full text-xs border-collapse">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="bg-slate-100 dark:bg-slate-800/70">
              {headerGroup.headers.map(header => (
                <th key={header.id} className="text-left px-3 py-2.5 border border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {weeks.map(([week, items]) => {
            const collapsed = collapsedWeeks.has(week)
            return (
              <React.Fragment key={week}>
                <tr className="bg-slate-200/70 dark:bg-slate-800">
                  <td colSpan={columns.length} className="px-3 py-1.5 border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => toggleWeek(week)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider"
                    >
                      {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      Week {week}
                      <span className="text-muted-foreground font-normal normal-case">({items.length} kunjungan)</span>
                    </button>
                  </td>
                </tr>
                {!collapsed && items.map(schedule => (
                  <ScheduleTableRow
                    key={schedule.id}
                    schedule={schedule}
                    assigneeOptions={assigneeOptions}
                    onOpenDrawer={onOpenDrawer}
                  />
                ))}
              </React.Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 dark:bg-slate-800/70">
            <td colSpan={columns.length} className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              {schedules.length} total kunjungan ·{" "}
              {STATUS_OPTIONS.map(s => {
                const count = schedules.filter(item => item.status === s).length
                return count > 0 ? `${STATUS_CFG[s].label}: ${count}` : null
              }).filter(Boolean).join(" · ")}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
