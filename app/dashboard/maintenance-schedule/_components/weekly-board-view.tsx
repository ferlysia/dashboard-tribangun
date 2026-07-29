"use client"

import * as React from "react"
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"
import type { PmSchedule } from "@/types/pm-schedule"
import { STATUS_CFG, STATUS_OPTIONS, StatusBadge } from "./status-badge"
import { isLegalStatusChange } from "@/lib/pm-schedule/status-rules"
import { useUpdateSchedule } from "../_hooks/use-pm-schedules"

function startOfWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

function fDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short" })
}

function Card({ schedule, month }: { schedule: PmSchedule; month: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: schedule.id })
  const updateSchedule = useUpdateSchedule(month)
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : {}

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-border bg-card p-3 shadow-sm ${isDragging ? "opacity-50" : ""}`}
    >
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <p className="text-xs font-medium text-foreground">{schedule.sites?.name ?? "—"}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{fDate(schedule.scheduled_date)}</p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {schedule.assignees.length > 0 ? (
            schedule.assignees.map(name => (
              <span key={name} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                {name}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-muted-foreground italic">Belum ditugaskan</span>
          )}
        </div>
      </div>
      {schedule.status === "COMPLETED" && (
        <button
          type="button"
          onClick={() => updateSchedule.mutate({ id: schedule.id, report_submitted: !schedule.report_submitted })}
          title={schedule.report_submitted ? "Laporan sudah disubmit" : "Tandai laporan sudah disubmit"}
          className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${schedule.report_submitted ? "text-green-600 dark:text-green-400" : "text-muted-foreground hover:text-foreground"}`}
        >
          <CheckCircle2 className="h-3 w-3" />
          {schedule.report_submitted ? "Laporan submitted" : "Tandai laporan"}
        </button>
      )}
    </div>
  )
}

function Column({ status, schedules, month }: { status: PmSchedule["status"]; schedules: PmSchedule[]; month: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-2.5 min-h-[200px] transition-colors ${isOver ? "bg-muted/50 ring-2 ring-ring/30" : ""}`}
    >
      <div className="flex items-center justify-between px-0.5">
        <StatusBadge status={status} />
        <span className="text-[11px] text-muted-foreground">{schedules.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {schedules.map(s => <Card key={s.id} schedule={s} month={month} />)}
      </div>
    </div>
  )
}

// "Rekap Senin" dispatch board — the current real calendar week's visits
// (Monday-Sunday), always scoped to the already-loaded active month's data
// (no separate fetch). If the selected month doesn't contain today, there's
// nothing to show here — that's a deliberate consequence of the "one shared
// query per month" strategy, not a bug: switch the month picker to the
// current month to dispatch this week's visits.
export function WeeklyBoardView({ schedules, month }: { schedules: PmSchedule[]; month: string }) {
  const updateSchedule = useUpdateSchedule(month)

  // Computed once per mount, not on every render — "the current week" only
  // needs to change if this view stays mounted across a week boundary.
  const [weekStart, weekEnd] = React.useMemo(() => {
    const start = startOfWeek(new Date())
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 7)
    return [start, end]
  }, [])

  const weekSchedules = React.useMemo(
    () => schedules.filter(s => {
      const d = new Date(s.scheduled_date)
      return d >= weekStart && d < weekEnd
    }),
    [schedules, weekStart, weekEnd]
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const schedule = weekSchedules.find(s => s.id === active.id)
    const targetStatus = over.id as PmSchedule["status"]
    if (!schedule || schedule.status === targetStatus) return
    if (!isLegalStatusChange(schedule.status, targetStatus)) {
      toast.error(`Tidak dapat memindahkan dari ${STATUS_CFG[schedule.status].label} ke ${STATUS_CFG[targetStatus].label}`)
      return
    }
    updateSchedule.mutate({ id: schedule.id, status: targetStatus })
  }

  if (weekSchedules.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Tidak ada kunjungan minggu ini di bulan yang dipilih. Pilih bulan berjalan untuk dispatch Senin pagi.
      </div>
    )
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {STATUS_OPTIONS.map(status => (
          <Column key={status} status={status} schedules={weekSchedules.filter(s => s.status === status)} month={month} />
        ))}
      </div>
    </DndContext>
  )
}
