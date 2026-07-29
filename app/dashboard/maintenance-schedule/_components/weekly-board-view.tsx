"use client"

import * as React from "react"
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"
import type { PmSchedule } from "@/types/pm-schedule"
import { STATUS_CFG, STATUS_OPTIONS, StatusBadge } from "./status-badge"
import { isLegalStatusChange } from "@/lib/pm-schedule/status-rules"
import { useUpdateSchedule } from "../_hooks/use-pm-schedules"

function fDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short" })
}

function Card({ schedule }: { schedule: PmSchedule }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: schedule.id })
  const updateSchedule = useUpdateSchedule()
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

function Column({ status, schedules }: { status: PmSchedule["status"]; schedules: PmSchedule[] }) {
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
        {schedules.map(s => <Card key={s.id} schedule={s} />)}
      </div>
    </div>
  )
}

// "Status" board (formerly "Rekap Senin") — every visit in the active
// month, grouped into Kanban columns by status. Scoped to the whole month
// (not just the current calendar week) so it stays populated regardless of
// which month is selected, e.g. navigating to November 2026 still shows
// that month's visits instead of an empty board.
export function WeeklyBoardView({ schedules }: { schedules: PmSchedule[] }) {
  const updateSchedule = useUpdateSchedule()

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const schedule = schedules.find(s => s.id === active.id)
    const targetStatus = over.id as PmSchedule["status"]
    if (!schedule || schedule.status === targetStatus) return
    if (!isLegalStatusChange(schedule.status, targetStatus)) {
      toast.error(`Tidak dapat memindahkan dari ${STATUS_CFG[schedule.status].label} ke ${STATUS_CFG[targetStatus].label}`)
      return
    }
    updateSchedule.mutate({ id: schedule.id, status: targetStatus })
  }

  if (schedules.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Tidak ada kunjungan di bulan yang dipilih.
      </div>
    )
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {STATUS_OPTIONS.map(status => (
          <Column key={status} status={status} schedules={schedules.filter(s => s.status === status)} />
        ))}
      </div>
    </DndContext>
  )
}
