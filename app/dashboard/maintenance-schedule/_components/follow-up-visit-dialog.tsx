"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { PmSchedule } from "@/types/pm-schedule"
import { useCreateSchedule, schedulesQueryKeyPrefix } from "../_hooks/use-pm-schedules"

// Offered whenever an admin records fewer actual_unit_count than the
// target on a COMPLETED visit (e.g. a client audit cut a visit short at 4
// of 8 units) — creates a follow-up PLANNED visit at the same site for the
// remaining unit count so the rest doesn't get silently dropped.
//
// Deliberately has NO assignee field: per SOP, assigning a team requires
// Tech Lead approval and a field-availability check, so it can never
// happen on the spot here. The created row always ships with
// assignees: [] — the admin fills that in later through the normal
// Assignee cell, same as every other visit (see the "never pre-filled"
// convention in lib/pm-schedule/recurring.ts).
export function FollowUpVisitDialog({ schedule, remainder, onClose }: {
  schedule:   PmSchedule
  remainder:  number
  onClose:    () => void
}) {
  const queryClient = useQueryClient()
  const createSchedule = useCreateSchedule(schedule.scheduled_month)
  const [date, setDate] = React.useState("")

  const handleCreate = () => {
    if (!date) {
      toast.error("Pilih tanggal kunjungan susulan.")
      return
    }
    createSchedule.mutate(
      {
        site_id:        schedule.site_id,
        scheduled_date: date,
        status:         "PLANNED",
        assignees:      [],
        unit_count:     remainder,
        notes:          `Kunjungan susulan dari ${new Date(schedule.scheduled_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} (sisa ${remainder} unit).`,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: schedulesQueryKeyPrefix })
          toast.success(`Kunjungan susulan untuk ${remainder} unit dibuat.`)
          onClose()
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat kunjungan susulan."),
      }
    )
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Buat Kunjungan Susulan?</DialogTitle>
          <DialogDescription>
            {schedule.sites?.name ?? "Site"} baru menyelesaikan sebagian unit. Sisa {remainder} unit bisa dijadwalkan sebagai kunjungan terpisah.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Tanggal Kunjungan Susulan</Label>
          <input
            type="date"
            autoFocus
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Dibuat tanpa assignee — penugasan teknisi butuh persetujuan Tech Lead &amp; pengecekan ketersediaan, dilakukan terpisah.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Nanti Saja</Button>
          <Button type="button" size="sm" onClick={handleCreate} disabled={createSchedule.isPending}>
            Buat Kunjungan Susulan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
