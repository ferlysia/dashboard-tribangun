"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Plus, Wand2 } from "lucide-react"
import { toast } from "sonner"
import type { Site } from "@/types/pm-schedule"
import { computeEvenlySpacedDates } from "@/lib/pm-schedule/recurring"
import { useCreateBatchSchedules, useCreateSchedule, useCreateSite, type NewSchedule } from "../_hooks/use-pm-schedules"
import { AssigneesInput } from "./assignees-input"

const NEW_SITE_VALUE = "__new_site__"
const inputCls = "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

type Mode = "single" | "recurring"

export function CreateScheduleDialog({ open, onClose, sites, month, assigneeOptions }: {
  open:             boolean
  onClose:          () => void
  sites:            Site[]
  month:            string
  assigneeOptions:  string[]
}) {
  const createSchedule = useCreateSchedule(month)
  const createBatch = useCreateBatchSchedules(month)
  const createSite = useCreateSite()

  const [mode, setMode] = React.useState<Mode>("single")
  const [siteId, setSiteId] = React.useState("")
  const [addingSite, setAddingSite] = React.useState(false)
  const [newSiteName, setNewSiteName] = React.useState("")

  // Single-visit fields — assignees optional here too (a near-term visit
  // may already know its technician), unit override optional.
  const [date, setDate] = React.useState("")
  const [assignees, setAssignees] = React.useState<string[]>([])
  const [unitOverride, setUnitOverride] = React.useState("")

  // Recurring-generator fields. No assignees field at all in this mode —
  // every generated visit is created Unassigned (see lib/pm-schedule/recurring.ts).
  const [durationPreset, setDurationPreset] = React.useState<"12" | "24" | "custom">("12")
  const [customMonths, setCustomMonths] = React.useState("12")
  const [totalVisits, setTotalVisits] = React.useState(4)
  const [startDate, setStartDate] = React.useState(todayISO)
  const [visitDates, setVisitDates] = React.useState<string[]>(Array(4).fill(""))
  const [recurringUnitOverride, setRecurringUnitOverride] = React.useState("")

  const durationMonths = durationPreset === "custom" ? Number(customMonths) || 0 : Number(durationPreset)

  React.useEffect(() => {
    if (!open) return
    setMode("single")
    setSiteId(""); setAddingSite(false); setNewSiteName("")
    setDate(""); setAssignees([]); setUnitOverride("")
    setDurationPreset("12"); setCustomMonths("12"); setTotalVisits(4)
    setStartDate(todayISO()); setVisitDates(Array(4).fill("")); setRecurringUnitOverride("")
  }, [open])

  // Resize the visit-date rows when totalVisits changes — keeps whatever
  // dates are already there (including hand-edits), only adds/removes rows
  // at the end.
  React.useEffect(() => {
    setVisitDates(prev => {
      const next = prev.slice(0, totalVisits)
      while (next.length < totalVisits) next.push("")
      return next
    })
  }, [totalVisits])

  const applyDurationPreset = (preset: "12" | "24" | "custom") => {
    setDurationPreset(preset)
    if (preset !== "custom") setTotalVisits(Math.max(1, Math.round(Number(preset) / 3)))
  }

  const autoFillSpacing = () => {
    if (durationMonths <= 0 || totalVisits <= 0 || !startDate) {
      toast.error("Isi durasi kontrak dan tanggal mulai terlebih dahulu.")
      return
    }
    setVisitDates(computeEvenlySpacedDates(startDate, durationMonths, totalVisits))
  }

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

  const handleSubmitSingle = () => {
    if (!siteId || !date) {
      toast.error("Pilih site dan tanggal kunjungan.")
      return
    }
    const row: NewSchedule = {
      site_id: siteId,
      scheduled_date: date,
      assignees,
      unit_count: unitOverride.trim() === "" ? null : Number(unitOverride),
    }
    createSchedule.mutate(row, {
      onSuccess: () => { toast.success("Jadwal kunjungan dibuat."); onClose() },
      onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat jadwal."),
    })
  }

  const handleSubmitRecurring = () => {
    if (!siteId) {
      toast.error("Pilih site terlebih dahulu.")
      return
    }
    if (visitDates.some(d => !d)) {
      toast.error("Isi tanggal untuk setiap kunjungan, atau gunakan Auto-fill.")
      return
    }
    const rows: NewSchedule[] = visitDates.map(scheduled_date => ({
      site_id: siteId,
      scheduled_date,
      // Never pre-assigned — see the dispatch-timing note in
      // lib/pm-schedule/recurring.ts.
      assignees: [],
      unit_count: recurringUnitOverride.trim() === "" ? null : Number(recurringUnitOverride),
    }))
    createBatch.mutate(rows, {
      onSuccess: () => { toast.success(`${rows.length} jadwal kunjungan dibuat.`); onClose() },
      onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat jadwal berulang."),
    })
  }

  const selectedSiteName = sites.find(s => s.id === siteId)?.name
  const saving = createSchedule.isPending || createBatch.isPending

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0">
        <DialogHeader className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <DialogTitle>Jadwalkan Kunjungan PM</DialogTitle>
          <DialogDescription>Site bisa dijadwalkan lebih dari sekali dalam bulan yang sama.</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 p-1 w-fit">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${mode === "single" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Single Visit
            </button>
            <button
              type="button"
              onClick={() => setMode("recurring")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${mode === "recurring" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Recurring Schedule
            </button>
          </div>

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

          {mode === "single" ? (
            <>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tanggal Kunjungan</Label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Assignee <span className="font-normal normal-case text-muted-foreground/70">(opsional — bisa ditugaskan nanti)</span>
                </Label>
                <AssigneesInput value={assignees} options={assigneeOptions} onChange={setAssignees} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Unit Count Override <span className="font-normal normal-case text-muted-foreground/70">(opsional)</span>
                </Label>
                <input
                  type="number" min={0} value={unitOverride}
                  onChange={e => setUnitOverride(e.target.value)}
                  placeholder="Ikuti default site"
                  className={inputCls}
                />
              </div>
            </>
          ) : (
            <div className="bg-muted/40 p-4 rounded-lg border border-slate-300 dark:border-slate-700 space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Durasi Kontrak</Label>
                <div className="flex items-center gap-2">
                  {(["12", "24", "custom"] as const).map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyDurationPreset(preset)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                        durationPreset === preset
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-slate-300 dark:border-slate-700 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {preset === "12" ? "1 Tahun" : preset === "24" ? "2 Tahun" : "Custom"}
                    </button>
                  ))}
                  {durationPreset === "custom" && (
                    <input
                      type="number" min={1} value={customMonths}
                      onChange={e => setCustomMonths(e.target.value)}
                      placeholder="Bulan"
                      className={`${inputCls} w-24`}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Total Kunjungan</Label>
                  <input
                    type="number" min={1} value={totalVisits}
                    onChange={e => setTotalVisits(Math.max(1, Number(e.target.value) || 1))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tanggal Mulai</Label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Unit Count Override <span className="font-normal normal-case text-muted-foreground/70">(opsional, berlaku untuk semua kunjungan)</span>
                </Label>
                <input
                  type="number" min={0} value={recurringUnitOverride}
                  onChange={e => setRecurringUnitOverride(e.target.value)}
                  placeholder="Ikuti default site"
                  className={inputCls}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">Tanggal per Kunjungan</Label>
                <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs" onClick={autoFillSpacing}>
                  <Wand2 className="h-3.5 w-3.5" /> Auto-fill even spacing
                </Button>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {visitDates.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">Visit {i + 1}</span>
                    <input
                      type="date"
                      value={d}
                      onChange={e => setVisitDates(prev => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                Semua kunjungan dibuat tanpa assignee — teknisi ditugaskan ~1 minggu sebelum tanggal kunjungan lewat Matrix Grid / Board / Drawer.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 bg-muted/30 px-6 py-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Batal</Button>
          {mode === "single" ? (
            <Button type="button" size="sm" onClick={handleSubmitSingle} disabled={saving}>
              Buat Jadwal
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={handleSubmitRecurring} disabled={saving}>
              Buat {totalVisits} Jadwal
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
