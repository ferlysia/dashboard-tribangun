"use client"

import * as React from "react"
import { FileText } from "lucide-react"
import { toast } from "sonner"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import type { PmSchedule } from "@/types/pm-schedule"
import { useUpdateSchedule } from "../_hooks/use-pm-schedules"

// Fast inline note-taking without leaving the row — the drawer used to be
// the only way to read/edit a note, which meant a side-panel round trip per
// site, and it only ever saved silently on blur. This popover opens right
// at the cell and has explicit Save/Cancel so there's no ambiguity about
// whether the note actually got recorded.
export function NotesCell({ schedule }: { schedule: PmSchedule }) {
  const updateSchedule = useUpdateSchedule()
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState(schedule.notes ?? "")

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(schedule.notes ?? "")
    setOpen(next)
  }

  const handleSave = () => {
    const next = draft.trim() || null
    setOpen(false)
    if (next === (schedule.notes ?? null)) return
    updateSchedule.mutate(
      { id: schedule.id, notes: next },
      {
        onSuccess: () => toast.success("Catatan disimpan."),
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan catatan."),
      }
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={schedule.notes ?? "Tambah catatan"}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors truncate max-w-[200px]"
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{schedule.notes || "Catatan"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" onClick={e => e.stopPropagation()}>
        <p className="text-xs font-semibold text-foreground mb-2">Catatan</p>
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={4}
          placeholder="Catatan kunjungan..."
          className="w-full rounded-md border border-border bg-background text-xs text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
        />
        <div className="flex items-center justify-end gap-2 mt-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          <Button type="button" size="sm" onClick={handleSave}>Simpan</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
