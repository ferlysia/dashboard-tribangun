"use client"

import * as React from "react"
import { FileText } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import type { PmSchedule, PmScheduleStatus } from "@/types/pm-schedule"
import { STATUS_CFG, STATUS_OPTIONS, StatusBadge } from "./status-badge"
import { AssigneesInput } from "./assignees-input"
import { getLegalNextStatuses } from "@/lib/pm-schedule/status-rules"
import { effectiveUnitCount } from "@/lib/pm-schedule/recurring"
import { useUpdateSchedule } from "../_hooks/use-pm-schedules"

function fDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
}

export const SCHEDULE_TABLE_COLUMN_LABELS = ["Site", "Tanggal", "Status", "Assignee", "Unit", "Laporan", "Catatan"]

// One inline-editable row, shared by the Matrix Grid and the All Sites view
// (both grouping modes) — status/assignee/unit/report edits go straight
// through the shared optimistic mutation hook, no popup. Memoized +
// row-local, so editing one cell never re-renders sibling rows (same
// technique as ProcurementRow in app/dashboard/purchasing-request/page.tsx).
// The leading select checkbox is optional — only passed by All Sites'
// bulk-action flow; Matrix Grid omits it and the column doesn't render.
export const ScheduleTableRow = React.memo(function ScheduleTableRow({
  schedule, assigneeOptions, onOpenDrawer, selected, onToggleSelect,
}: {
  schedule:         PmSchedule
  assigneeOptions:  string[]
  onOpenDrawer:     (id: string) => void
  selected?:        boolean
  onToggleSelect?:  (id: string, checked: boolean) => void
}) {
  const updateSchedule = useUpdateSchedule()
  const legalNext = getLegalNextStatuses(schedule.status)
  const unitCount = effectiveUnitCount(schedule, schedule.sites)
  const isOverridden = schedule.unit_count != null

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      {onToggleSelect && (
        <td className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-center">
          <Checkbox
            checked={selected ?? false}
            onCheckedChange={checked => onToggleSelect(schedule.id, checked === true)}
          />
        </td>
      )}
      <td className="px-3 py-2 border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onOpenDrawer(schedule.id)}
          className="text-left text-foreground font-semibold hover:underline underline-offset-2"
        >
          {schedule.sites?.name ?? "—"}
        </button>
      </td>
      <td className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-muted-foreground whitespace-nowrap">{fDate(schedule.scheduled_date)}</td>
      <td className="px-2 py-2 border border-slate-200 dark:border-slate-800">
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
      <td className="px-2 py-2 border border-slate-200 dark:border-slate-800">
        <AssigneesInput
          value={schedule.assignees}
          options={assigneeOptions}
          onChange={assignees => updateSchedule.mutate({ id: schedule.id, assignees })}
        />
      </td>
      <td className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-muted-foreground whitespace-nowrap" title={isOverridden ? `Override: ${schedule.unit_count} (default site: ${schedule.sites?.unit_count ?? 0})` : "Mengikuti default site"}>
        {isOverridden ? `${schedule.unit_count}/${schedule.sites?.unit_count ?? 0}` : unitCount}
      </td>
      <td className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-center">
        <Checkbox
          checked={schedule.report_submitted}
          disabled={schedule.status !== "COMPLETED"}
          onCheckedChange={checked => updateSchedule.mutate({ id: schedule.id, report_submitted: checked === true })}
          title={schedule.status !== "COMPLETED" ? "Hanya berlaku setelah status Done" : "Laporan sudah disubmit"}
        />
      </td>
      <td className="px-3 py-2 border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onOpenDrawer(schedule.id)}
          title={schedule.notes ?? "Tambah catatan"}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors truncate max-w-[200px]"
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{schedule.notes || "Catatan"}</span>
        </button>
      </td>
    </tr>
  )
})
