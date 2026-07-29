"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { Site } from "@/types/pm-schedule"
import { useCreateSchedule } from "../_hooks/use-pm-schedules"

export function CreateScheduleDialog({ open, onClose, sites, month }: {
  open:    boolean
  onClose: () => void
  sites:   Site[]
  month:   string
}) {
  const createSchedule = useCreateSchedule(month)
  const [siteId, setSiteId] = React.useState("")
  const [date, setDate]     = React.useState("")

  React.useEffect(() => {
    if (open) { setSiteId(""); setDate("") }
  }, [open])

  const handleSubmit = () => {
    if (!siteId || !date) {
      toast.error("Pilih site dan tanggal kunjungan.")
      return
    }
    createSchedule.mutate(
      { site_id: siteId, scheduled_date: date },
      {
        onSuccess: () => { toast.success("Jadwal kunjungan dibuat."); onClose() },
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat jadwal."),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Jadwalkan Kunjungan PM</DialogTitle>
          <DialogDescription>Site bisa dijadwalkan lebih dari sekali dalam bulan yang sama.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Site</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger size="sm" className="w-full text-xs">
                <SelectValue placeholder="Pilih site" />
              </SelectTrigger>
              <SelectContent>
                {sites.map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Tanggal Kunjungan</Label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background text-xs text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Batal</Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={createSchedule.isPending}>
            Buat Jadwal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
