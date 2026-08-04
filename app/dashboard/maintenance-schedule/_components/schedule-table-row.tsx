"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import type { PmSchedule, PmScheduleStatus } from "@/types/pm-schedule"
import { STATUS_CFG, STATUS_OPTIONS, StatusBadge } from "./status-badge"
import { AssigneeCell } from "./assignee-cell"
import { UnitCell } from "./unit-cell"
import { NotesCell } from "./notes-cell"
import { getLegalNextStatuses } from "@/lib/pm-schedule/status-rules"
import { effectiveUnitTypes, flattenUnitSns } from "@/lib/pm-schedule/recurring"
import { useUpdateSchedule } from "../_hooks/use-pm-schedules"

function fDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
}

// Compact "original -> new" audit trail for a rescheduled visit — every
// scheduled_date change is logged server-side (see the 20260802 migration
// and app/api/pm-schedules/[id]/route.ts), so the very first entry's `from`
// is the visit's original planned date no matter how many times it's moved
// since. Renders nothing when a visit has never been rescheduled.
function DateCell({ schedule }: { schedule: PmSchedule }) {
  const history = schedule.reschedule_history
  if (!history || history.length === 0) {
    return <td className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-muted-foreground whitespace-nowrap">{fDate(schedule.scheduled_date)}</td>
  }
  const original = history[0].from
  const tooltip = history.map(h => `${fDate(h.from)} -> ${fDate(h.to)}`).join("\n")
  return (
    <td className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-muted-foreground whitespace-nowrap" title={tooltip}>
      <span className="line-through opacity-60 text-[10px] mr-1">{fDate(original)}</span>
      <span className="text-foreground font-medium">{fDate(schedule.scheduled_date)}</span>
    </td>
  )
}

export const SCHEDULE_TABLE_COLUMN_LABELS = ["Site", "Tanggal", "Status", "Assignee", "Unit", "Reports", "Catatan"]

// One inline-editable row, shared by the Matrix Grid and the All Sites view
// (both grouping modes) — status/assignee/unit/report edits go straight
// through the shared optimistic mutation hook, no popup. Memoized +
// row-local, so editing one cell never re-renders sibling rows (same
// technique as ProcurementRow in app/dashboard/purchasing-request/page.tsx).
// The leading select checkbox is optional — only passed by All Sites'
// bulk-action flow; Matrix Grid omits it and the column doesn't render.
export const ScheduleTableRow = React.memo(function ScheduleTableRow({
  schedule, assigneeOptions, onOpenDrawer, selected, onToggleSelect, showSn,
}: {
  schedule:         PmSchedule
  assigneeOptions:  string[]
  onOpenDrawer:     (id: string) => void
  selected?:        boolean
  onToggleSelect?:  (id: string, checked: boolean) => void
  // Never a separate column — only All Sites' "By Site" grouping passes
  // this, rendering SN inline next to the site name for that one context.
  showSn?:          boolean
}) {
  const updateSchedule = useUpdateSchedule()
  const legalNext = getLegalNextStatuses(schedule.status)
  const sns = showSn ? flattenUnitSns(effectiveUnitTypes(schedule, schedule.sites)) : []

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
        {sns.length > 0 && (
          <span className="block text-[10px] font-normal text-muted-foreground truncate" title={sns.join(", ")}>
            SN: {sns.join(", ")}
          </span>
        )}
      </td>
      <DateCell schedule={schedule} />
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
        <AssigneeCell
          value={schedule.assignees}
          options={assigneeOptions}
          onChange={assignees => updateSchedule.mutate({ id: schedule.id, assignees })}
        />
      </td>
      <UnitCell schedule={schedule} />
      <td className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-center bg-slate-50 dark:bg-slate-900/40">
        <Checkbox
          checked={schedule.report_submitted}
          disabled={schedule.status !== "COMPLETED"}
          onCheckedChange={checked => updateSchedule.mutate({ id: schedule.id, report_submitted: checked === true })}
          title={schedule.status !== "COMPLETED" ? "Hanya berlaku setelah status Done" : "Laporan sudah disubmit"}
          className="border-2 border-slate-500 dark:border-slate-400 bg-white dark:bg-slate-900 shadow-sm"
        />
      </td>
      <td className="px-3 py-2 border border-slate-200 dark:border-slate-800">
        <NotesCell schedule={schedule} />
      </td>
    </tr>
  )
})
