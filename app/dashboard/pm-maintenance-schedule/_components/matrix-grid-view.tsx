"use client"

import * as React from "react"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PmSchedule, PmScheduleStatus } from "@/types/pm-schedule"
import { STATUS_CFG, STATUS_OPTIONS, StatusBadge } from "./status-badge"
import { AssigneeInput } from "./assignee-input"
import { getLegalNextStatuses } from "@/lib/pm-schedule/status-rules"
import { useUpdateSchedule } from "../_hooks/use-pm-schedules"

function fDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
}

function weekOfMonth(iso: string) {
  const day = new Date(iso).getUTCDate()
  return Math.ceil(day / 7)
}

// One inline-editable row. Status/assignee edits go straight through the
// shared optimistic mutation hook — no popup, matches the Height-style
// Excel-like editing the spec asks for. Memoized + row-local, so editing
// one cell never re-renders sibling rows (same technique as ProcurementRow
// in app/dashboard/purchasing-request/page.tsx).
const GridRow = React.memo(function GridRow({
  schedule, month, assigneeOptions, onOpenDrawer,
}: {
  schedule:         PmSchedule
  month:            string
  assigneeOptions:  string[]
  onOpenDrawer:     (id: string) => void
}) {
  const updateSchedule = useUpdateSchedule(month)
  const legalNext = getLegalNextStatuses(schedule.status)

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={() => onOpenDrawer(schedule.id)}
          className="text-left text-foreground font-medium hover:underline underline-offset-2"
        >
          {schedule.sites?.name ?? "—"}
        </button>
      </td>
      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fDate(schedule.scheduled_date)}</td>
      <td className="px-2 py-2">
        <Select value={schedule.status} onValueChange={v => updateSchedule.mutate({ id: schedule.id, status: v as PmScheduleStatus })}>
          <SelectTrigger size="sm" className="w-full text-xs border-none bg-transparent shadow-none">
            <SelectValue>
              <StatusBadge status={schedule.status} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.filter(s => s === schedule.status || legalNext.includes(s)).map(s => (
              <SelectItem key={s} value={s} className="text-xs">{STATUS_CFG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-2">
        <AssigneeInput
          value={schedule.assignee}
          options={assigneeOptions}
          onCommit={assignee => updateSchedule.mutate({ id: schedule.id, assignee })}
        />
      </td>
      <td className="px-3 py-2 text-muted-foreground truncate max-w-[240px]" title={schedule.notes ?? ""}>
        {schedule.notes || "—"}
      </td>
    </tr>
  )
})

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
  { id: "notes",    header: "Catatan" },
]

export function MatrixGridView({ schedules, month, assigneeOptions, onOpenDrawer }: {
  schedules:        PmSchedule[]
  month:            string
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
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="border-b border-border bg-muted/30">
              {headerGroup.headers.map(header => (
                <th key={header.id} className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-border">
          {weeks.map(([week, items]) => {
            const collapsed = collapsedWeeks.has(week)
            return (
              <React.Fragment key={week}>
                <tr className="bg-muted/50">
                  <td colSpan={columns.length} className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => toggleWeek(week)}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground uppercase tracking-wider"
                    >
                      {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      Week {week}
                      <span className="text-muted-foreground font-normal normal-case">({items.length} kunjungan)</span>
                    </button>
                  </td>
                </tr>
                {!collapsed && items.map(schedule => (
                  <GridRow
                    key={schedule.id}
                    schedule={schedule}
                    month={month}
                    assigneeOptions={assigneeOptions}
                    onOpenDrawer={onOpenDrawer}
                  />
                ))}
              </React.Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted/30">
            <td colSpan={columns.length} className="px-3 py-2 text-[11px] text-muted-foreground">
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
