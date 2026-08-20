"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useCreateInspection, useCatalog, useProjects } from "../_hooks/use-tool-inspection"
import { ProjectPicker } from "./project-picker"

const inputCls = "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function CreateInspectionDialog({ open, onClose, defaultProjectId }: {
  open:              boolean
  onClose:           () => void
  defaultProjectId?: string | null
}) {
  const router = useRouter()
  const createInspection = useCreateInspection()
  const { data: projects } = useProjects()

  const [projectId, setProjectId] = React.useState<string | null>(defaultProjectId ?? null)
  const { data: catalog } = useCatalog(projectId)
  const activeCatalogCount = (catalog ?? []).filter(c => c.is_active).length

  const [projectName, setProjectName] = React.useState("")
  const [projectLocation, setProjectLocation] = React.useState("")
  const [inspectionDate, setInspectionDate] = React.useState(todayISO())
  const [weekLabel, setWeekLabel] = React.useState("")
  const [responsiblePerson, setResponsiblePerson] = React.useState("")
  const [inspector, setInspector] = React.useState("")

  React.useEffect(() => {
    if (!open) return
    setProjectId(defaultProjectId ?? null)
    setProjectName(""); setProjectLocation("")
    setInspectionDate(todayISO()); setWeekLabel("")
    setResponsiblePerson(""); setInspector("")
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // project_name/project_location default from the selected project but
  // stay freely editable (a per-week override, e.g. a shortened printed
  // name) — they're a snapshot on the inspection row, not a live join.
  React.useEffect(() => {
    const project = projects?.find(p => p.id === projectId)
    if (project) {
      setProjectName(prev => prev || project.name)
      setProjectLocation(prev => prev || project.location || "")
    }
  }, [projectId, projects])

  const handleSubmit = () => {
    if (!projectId) {
      toast.error("Pilih atau tambahkan project terlebih dahulu.")
      return
    }
    if (!projectName || !inspectionDate || !weekLabel || !responsiblePerson || !inspector) {
      toast.error("Lengkapi semua field yang wajib diisi.")
      return
    }
    createInspection.mutate({
      project_id: projectId,
      project_name: projectName,
      project_location: projectLocation || undefined,
      inspection_date: inspectionDate,
      week_label: weekLabel,
      responsible_person: responsiblePerson,
      inspector,
    }, {
      onSuccess: (created) => {
        toast.success("Weekly Tool Inspection dibuat.")
        onClose()
        router.push(`/dashboard/tool-inspection/${created.id}`)
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat inspeksi."),
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        <DialogHeader className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <DialogTitle>New Weekly Tool Inspection</DialogTitle>
          <DialogDescription>
            {!projectId
              ? "Pilih project yang sudah ada atau ketik nama project baru."
              : activeCatalogCount > 0
                ? `${activeCatalogCount} tool akan disalin otomatis dari katalog project ini.`
                : "Project ini belum punya katalog tool aktif — atur katalog dulu sebelum membuat inspeksi."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Project</Label>
            <ProjectPicker value={projectId} onChange={setProjectId} triggerClassName="h-10 w-full text-sm" />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Project Name <span className="font-normal normal-case text-muted-foreground/70">(bisa diubah untuk form ini)</span></Label>
            <input className={inputCls} value={projectName} onChange={e => setProjectName(e.target.value)}
              placeholder="GAIA Data Center Project (CGK01)" />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Project Location <span className="font-normal normal-case text-muted-foreground/70">(opsional)</span></Label>
            <input className={inputCls} value={projectLocation} onChange={e => setProjectLocation(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Inspection Date</Label>
              <input type="date" className={inputCls} value={inspectionDate} onChange={e => setInspectionDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Week No.</Label>
              <input className={inputCls} value={weekLabel} onChange={e => setWeekLabel(e.target.value)} placeholder="1st Week of August" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Responsible Person</Label>
            <input className={inputCls} value={responsiblePerson} onChange={e => setResponsiblePerson(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Inspector</Label>
            <input className={inputCls} value={inspector} onChange={e => setInspector(e.target.value)} placeholder="M Dion &amp; Thalitha V Febrianni (HSE)" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 bg-muted/30 px-6 py-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Batal</Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={createInspection.isPending || !projectId || activeCatalogCount === 0}>
            {createInspection.isPending ? "Membuat…" : "Buat Inspeksi"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
