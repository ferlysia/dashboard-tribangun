"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { PmSchedule, PmScheduleStatus } from "@/types/pm-schedule"
import { STATUS_CFG, STATUS_OPTIONS, StatusBadge } from "./status-badge"
import { AssigneeInput } from "./assignee-input"
import { getLegalNextStatuses } from "@/lib/pm-schedule/status-rules"
import { useDeleteSchedule, useUpdateSchedule } from "../_hooks/use-pm-schedules"

// Linear-style side-peek: inspect/edit a single visit without leaving the
// current view. Every edit goes through the same useUpdateSchedule mutation
// the grid and board use, so status changes made here show up there
// immediately (shared query cache).
export function ScheduleDrawer({ schedule, month, assigneeOptions, onClose }: {
  schedule:         PmSchedule | null
  month:            string
  assigneeOptions:  string[]
  onClose:          () => void
}) {
  const updateSchedule = useUpdateSchedule(month)
  const deleteSchedule = useDeleteSchedule(month)
  const [notesDraft, setNotesDraft] = React.useState<string | null>(null)

  React.useEffect(() => { setNotesDraft(null) }, [schedule?.id])

  if (!schedule) return null

  const legalNext = getLegalNextStatuses(schedule.status)
  const notesValue = notesDraft ?? schedule.notes ?? ""

  const commitStatus = (status: PmScheduleStatus) => {
    updateSchedule.mutate({ id: schedule.id, status })
  }

  const commitNotesBlur = () => {
    const next = notesValue.trim() || null
    if (next === (schedule.notes ?? null)) return
    updateSchedule.mutate({ id: schedule.id, notes: next })
  }

  const handleDelete = () => {
    if (!window.confirm(`Hapus jadwal kunjungan ${schedule.sites?.name ?? ""}?`)) return
    deleteSchedule.mutate(schedule.id, {
      onSuccess: () => { toast.success("Jadwal dihapus."); onClose() },
      onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus jadwal."),
    })
  }

  return (
    <Sheet open={!!schedule} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{schedule.sites?.name ?? "Site"}</SheetTitle>
          <SheetDescription>
            Kunjungan PM terjadwal {new Date(schedule.scheduled_date).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={schedule.status} />
            </div>
            <Select value={schedule.status} onValueChange={v => commitStatus(v as PmScheduleStatus)}>
              <SelectTrigger size="sm" className="w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.filter(s => s === schedule.status || legalNext.includes(s)).map(s => (
                  <SelectItem key={s} value={s} className="text-xs">{STATUS_CFG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Assignee</Label>
            <AssigneeInput
              value={schedule.assignee}
              options={assigneeOptions}
              onCommit={assignee => updateSchedule.mutate({ id: schedule.id, assignee })}
              placeholder="Nama teknisi/tim"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Catatan</Label>
            <textarea
              value={notesValue}
              onChange={e => setNotesDraft(e.target.value)}
              onBlur={commitNotesBlur}
              rows={4}
              placeholder="Catatan kunjungan..."
              className="w-full rounded-md border border-border bg-background text-xs text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
            />
          </div>

          {schedule.status === "COMPLETED" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={schedule.report_submitted}
                onCheckedChange={checked => updateSchedule.mutate({ id: schedule.id, report_submitted: checked === true })}
              />
              <span className="text-xs text-foreground">Laporan sudah disubmit</span>
            </label>
          )}
        </div>

        <SheetFooter>
          <Button
            type="button" variant="outline" size="sm"
            className="gap-1.5 text-xs text-red-600 hover:text-red-700"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" /> Hapus Jadwal
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
