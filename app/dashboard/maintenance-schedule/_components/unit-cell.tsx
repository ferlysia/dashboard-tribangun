"use client"

import * as React from "react"
import type { PmSchedule } from "@/types/pm-schedule"
import { effectiveUnitCount, effectiveUnitTypes, formatUnitTypes } from "@/lib/pm-schedule/recurring"
import { useUpdateSchedule } from "../_hooks/use-pm-schedules"
import { FollowUpVisitDialog } from "./follow-up-visit-dialog"

// Target vs. actual completed units. Before a visit is marked Done there is
// no "actual" yet, so only the target renders (no more fake "8/0"). The
// moment status flips to COMPLETED, the API auto-fills actual_unit_count to
// the target — this cell then shows "8/8", editable by clicking, so the
// admin can override it down for a partial completion (e.g. "4/8" when a
// client audit cut the visit short). Editing down below target offers a
// follow-up/split visit for the remainder.
export function UnitCell({ schedule }: { schedule: PmSchedule }) {
  const updateSchedule = useUpdateSchedule()
  const target = effectiveUnitCount(schedule, schedule.sites)
  const types = effectiveUnitTypes(schedule, schedule.sites)
  const isOverridden = schedule.unit_count != null || (schedule.unit_types?.length ?? 0) > 0
  const isDone = schedule.status === "COMPLETED"

  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [followUpRemainder, setFollowUpRemainder] = React.useState<number | null>(null)

  const title = isOverridden
    ? `Override: ${formatUnitTypes(types, target)} (default site: ${target})`
    : "Mengikuti default site"

  if (!isDone) {
    return (
      <td className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-muted-foreground whitespace-nowrap" title={title}>
        {formatUnitTypes(types, target)}
      </td>
    )
  }

  const startEdit = () => {
    setDraft(schedule.actual_unit_count != null ? String(schedule.actual_unit_count) : String(target))
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed === "") return
    const n = Number(trimmed)
    if (!Number.isInteger(n) || n < 0 || n === schedule.actual_unit_count) return
    updateSchedule.mutate(
      { id: schedule.id, actual_unit_count: n },
      { onSuccess: () => { if (n < target) setFollowUpRemainder(target - n) } }
    )
  }

  if (editing) {
    return (
      <td className="px-2 py-2 border border-slate-200 dark:border-slate-800 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false) }}
            className="w-14 rounded-md border border-slate-300 dark:border-slate-700 bg-background text-xs text-foreground px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <span className="text-muted-foreground text-xs">/{target}</span>
        </div>
      </td>
    )
  }

  const actual = schedule.actual_unit_count ?? target
  const partial = schedule.actual_unit_count != null && schedule.actual_unit_count < target

  return (
    <>
      <td
        className={`px-3 py-2 border border-slate-200 dark:border-slate-800 whitespace-nowrap cursor-pointer hover:underline underline-offset-2 ${partial ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-foreground"}`}
        title={`${title} — klik untuk ubah unit selesai`}
        onClick={startEdit}
      >
        {actual}/{target}
      </td>
      {followUpRemainder != null && (
        <FollowUpVisitDialog
          schedule={schedule}
          remainder={followUpRemainder}
          onClose={() => setFollowUpRemainder(null)}
        />
      )}
    </>
  )
}
