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
import { AssigneesInput } from "./assignees-input"
import { FollowUpVisitDialog } from "./follow-up-visit-dialog"
import { getLegalNextStatuses } from "@/lib/pm-schedule/status-rules"
import { effectiveUnitCount } from "@/lib/pm-schedule/recurring"
import { useDeleteSchedule, useUpdateSchedule } from "../_hooks/use-pm-schedules"

function fDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

// Linear-style side-peek: inspect/edit a single visit without leaving the
// current view. Every edit goes through the same useUpdateSchedule mutation
// the grid and board use, so status changes made here show up there
// immediately (shared query cache).
export function ScheduleDrawer({ schedule, assigneeOptions, onClose }: {
  schedule:         PmSchedule | null
  assigneeOptions:  string[]
  onClose:          () => void
}) {
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const [notesDraft, setNotesDraft] = React.useState<string | null>(null)
  const [unitDraft, setUnitDraft] = React.useState<string | null>(null)
  const [actualDraft, setActualDraft] = React.useState<string | null>(null)
  const [dateDraft, setDateDraft] = React.useState<string | null>(null)
  const [followUpRemainder, setFollowUpRemainder] = React.useState<number | null>(null)

  React.useEffect(() => { setNotesDraft(null); setUnitDraft(null); setActualDraft(null); setDateDraft(null) }, [schedule?.id])

  if (!schedule) return null

  const legalNext = getLegalNextStatuses(schedule.status)
  const notesValue = notesDraft ?? schedule.notes ?? ""
  const unitValue = unitDraft ?? (schedule.unit_count != null ? String(schedule.unit_count) : "")
  const target = effectiveUnitCount(schedule, schedule.sites)
  const actualValue = actualDraft ?? (schedule.actual_unit_count != null ? String(schedule.actual_unit_count) : String(target))
  const dateValue = dateDraft ?? schedule.scheduled_date
  const dateChanged = dateValue !== "" && dateValue !== schedule.scheduled_date

  const commitStatus = (status: PmScheduleStatus) => {
    updateSchedule.mutate({ id: schedule.id, status })
  }

  const commitNotesBlur = () => {
    const next = notesValue.trim() || null
    if (next === (schedule.notes ?? null)) return
    updateSchedule.mutate({ id: schedule.id, notes: next })
  }

  const handleSaveNotes = () => {
    const next = notesValue.trim() || null
    if (next === (schedule.notes ?? null)) {
      toast.success("Catatan disimpan.")
      return
    }
    updateSchedule.mutate(
      { id: schedule.id, notes: next },
      {
        onSuccess: () => toast.success("Catatan disimpan."),
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan catatan."),
      }
    )
  }

  const commitUnitBlur = () => {
    const trimmed = unitValue.trim()
    const next = trimmed === "" ? null : Number(trimmed)
    if (next === schedule.unit_count) return
    if (next !== null && (!Number.isInteger(next) || next < 0)) {
      toast.error("Unit count harus bilangan bulat >= 0")
      setUnitDraft(schedule.unit_count != null ? String(schedule.unit_count) : "")
      return
    }
    updateSchedule.mutate({ id: schedule.id, unit_count: next })
  }

  const commitActualBlur = () => {
    const trimmed = actualValue.trim()
    if (trimmed === "") return
    const n = Number(trimmed)
    if (!Number.isInteger(n) || n < 0) {
      toast.error("Unit selesai harus bilangan bulat >= 0")
      setActualDraft(schedule.actual_unit_count != null ? String(schedule.actual_unit_count) : String(target))
      return
    }
    if (n === schedule.actual_unit_count) return
    updateSchedule.mutate(
      { id: schedule.id, actual_unit_count: n },
      { onSuccess: () => { if (n < target) setFollowUpRemainder(target - n) } }
    )
  }

  // Internal re-routing — the Lead Tech re-clustering sites by
  // distance/efficiency ~1 week out. Just moves the visit on the
  // Calendar/Matrix; no audit trail, no status change, since the client
  // never asked for this.
  const handleInternalDateChange = () => {
    if (!dateChanged) return
    updateSchedule.mutate(
      { id: schedule.id, scheduled_date: dateValue },
      {
        onSuccess: () => { toast.success("Tanggal diperbarui."); setDateDraft(null) },
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal mengubah tanggal."),
      }
    )
  }

  // Formal reschedule — only when the client/customer requested the move.
  // Logs to reschedule_history and forces status to RESCHEDULED (see
  // app/api/pm-schedules/[id]/route.ts), producing the visible audit trail.
  const handleCustomerReschedule = () => {
    if (!dateChanged) return
    if (!window.confirm(`Reschedule kunjungan ini dari ${fDateLong(schedule.scheduled_date)} ke ${fDateLong(dateValue)} atas permintaan customer? Status akan berubah ke Rescheduled dan tercatat di riwayat.`)) return
    updateSchedule.mutate(
      { id: schedule.id, scheduled_date: dateValue, formal_reschedule: true },
      {
        onSuccess: () => { toast.success("Jadwal di-reschedule dan tercatat di riwayat."); setDateDraft(null) },
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal me-reschedule jadwal."),
      }
    )
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
          <SheetDescription>Kunjungan PM</SheetDescription>
          {schedule.reschedule_history.length > 0 && (
            <div className="mt-1 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 mb-1">Riwayat Reschedule</p>
              <ul className="space-y-0.5">
                {schedule.reschedule_history.map((h, i) => (
                  <li key={i} className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                    <span className="line-through opacity-60">{fDateLong(h.from)}</span>
                    {" -> "}
                    <span className="font-medium">{fDateLong(h.to)}</span>
                    <span className="text-muted-foreground"> ({fDateLong(h.at)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Tanggal Kunjungan</Label>
            <input
              type="date"
              value={dateValue}
              onChange={e => setDateDraft(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-xs text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            {dateChanged && (
              <div className="flex flex-col gap-1.5 mt-2">
                <Button type="button" size="sm" variant="outline" className="text-xs justify-start h-auto py-1.5" onClick={handleInternalDateChange}>
                  <span className="flex flex-col items-start">
                    <span>Ubah Tanggal Aktual</span>
                    <span className="font-normal text-[10px] text-muted-foreground">Re-routing internal — tanpa reschedule, tanpa riwayat</span>
                  </span>
                </Button>
                <Button
                  type="button" size="sm" variant="outline"
                  className="text-xs justify-start h-auto py-1.5 border-amber-400 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                  onClick={handleCustomerReschedule}
                >
                  <span className="flex flex-col items-start">
                    <span>Reschedule via Customer</span>
                    <span className="font-normal text-[10px] opacity-80">Ubah status ke Rescheduled &amp; catat ke riwayat</span>
                  </span>
                </Button>
              </div>
            )}
          </div>

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
            <AssigneesInput
              value={schedule.assignees}
              options={assigneeOptions}
              onChange={assignees => updateSchedule.mutate({ id: schedule.id, assignees })}
              placeholder="Belum ditugaskan — ditugaskan ~1 minggu sebelum kunjungan"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              Unit Count Override
              <span className="font-normal normal-case text-muted-foreground/70"> (default site: {schedule.sites?.unit_count ?? 0})</span>
            </Label>
            <input
              type="number"
              min={0}
              value={unitValue}
              onChange={e => setUnitDraft(e.target.value)}
              onBlur={commitUnitBlur}
              placeholder={String(schedule.sites?.unit_count ?? 0)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-xs text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {schedule.status === "COMPLETED" && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Unit Selesai <span className="font-normal normal-case text-muted-foreground/70">(target: {target})</span>
              </Label>
              <input
                type="number"
                min={0}
                value={actualValue}
                onChange={e => setActualDraft(e.target.value)}
                onBlur={commitActualBlur}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-xs text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              {schedule.actual_unit_count != null && schedule.actual_unit_count < target && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  {schedule.actual_unit_count} dari {target} unit selesai — sisanya bisa dijadwalkan sebagai kunjungan susulan.
                </p>
              )}
            </div>
          )}

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
            <div className="flex justify-end mt-1.5">
              <Button type="button" size="sm" variant="outline" className="text-xs" onClick={handleSaveNotes}>
                Simpan Catatan
              </Button>
            </div>
          </div>

          {schedule.status === "COMPLETED" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={schedule.report_submitted}
                onCheckedChange={checked => updateSchedule.mutate({ id: schedule.id, report_submitted: checked === true })}
                className="border-2 border-slate-500 dark:border-slate-400 bg-white dark:bg-slate-900 shadow-sm"
              />
              <span className="text-xs text-foreground">Laporan sudah disubmit</span>
            </label>
          )}
        </div>

        {followUpRemainder != null && (
          <FollowUpVisitDialog
            schedule={schedule}
            remainder={followUpRemainder}
            onClose={() => setFollowUpRemainder(null)}
          />
        )}

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
