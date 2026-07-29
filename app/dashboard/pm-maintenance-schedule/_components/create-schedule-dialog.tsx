"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import type { Site } from "@/types/pm-schedule"
import { useCreateSchedule, useCreateSite } from "../_hooks/use-pm-schedules"

const NEW_SITE_VALUE = "__new_site__"
const inputCls = "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40"

export function CreateScheduleDialog({ open, onClose, sites, month }: {
  open:    boolean
  onClose: () => void
  sites:   Site[]
  month:   string
}) {
  const createSchedule = useCreateSchedule(month)
  const createSite = useCreateSite()
  const [siteId, setSiteId] = React.useState("")
  const [date, setDate]     = React.useState("")
  const [addingSite, setAddingSite] = React.useState(false)
  const [newSiteName, setNewSiteName] = React.useState("")

  React.useEffect(() => {
    if (open) { setSiteId(""); setDate(""); setAddingSite(false); setNewSiteName("") }
  }, [open])

  const handleSiteSelect = (value: string) => {
    if (value === NEW_SITE_VALUE) {
      setAddingSite(true)
      return
    }
    setSiteId(value)
  }

  const handleCreateSite = () => {
    const name = newSiteName.trim()
    if (!name) {
      toast.error("Nama site tidak boleh kosong.")
      return
    }
    createSite.mutate(name, {
      onSuccess: (site) => {
        setSiteId(site.id)
        setAddingSite(false)
        setNewSiteName("")
        toast.success(`Site "${site.name}" ditambahkan.`)
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menambahkan site."),
    })
  }

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

  const selectedSiteName = sites.find(s => s.id === siteId)?.name

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        <DialogHeader className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <DialogTitle>Jadwalkan Kunjungan PM</DialogTitle>
          <DialogDescription>Site bisa dijadwalkan lebih dari sekali dalam bulan yang sama.</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Site</Label>

            {!addingSite ? (
              <Select value={siteId} onValueChange={handleSiteSelect}>
                <SelectTrigger className={`w-full text-sm h-10 ${inputCls}`}>
                  <SelectValue placeholder="Pilih site">{selectedSiteName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_SITE_VALUE} className="text-sm font-medium text-primary">
                    <Plus className="h-3.5 w-3.5" /> Tambah Site Baru
                  </SelectItem>
                  {sites.length > 0 && <SelectSeparator />}
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-sm">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newSiteName}
                  onChange={e => setNewSiteName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCreateSite() }}
                  placeholder="Nama site baru..."
                  className={inputCls}
                />
                <Button type="button" size="sm" onClick={handleCreateSite} disabled={createSite.isPending}>
                  Simpan
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setAddingSite(false); setNewSiteName("") }}>
                  Batal
                </Button>
              </div>
            )}

            {!addingSite && sites.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">Belum ada site — pilih &quot;Tambah Site Baru&quot; di atas.</p>
            )}
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tanggal Kunjungan</Label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 bg-muted/30 px-6 py-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Batal</Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={createSchedule.isPending}>
            Buat Jadwal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
