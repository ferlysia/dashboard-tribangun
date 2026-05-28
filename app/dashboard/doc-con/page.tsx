"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  Search, Plus, Bell, CheckCheck, Trash2, Pencil,
  X, Save, Camera, RefreshCw, FolderOpen, BarChart3,
  CheckCircle2, Lock, ExternalLink, ChevronLeft,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type TerminEntry = {
  id: string
  nama: string
  target_progres: number
  persen_tagihan: number
}

type VOEntry = {
  id: string
  po_number: string
  description: string
  nilai_po: number
}

type ProjectSummary = {
  project_key: string
  display_name: string
  po_number: string | null
  customer_name: string | null
  physical_progress: number
  project_status: string
  termin_schedule: TerminEntry[]
  site_location: string | null
  description: string | null
  notes: string | null
  po_value_manual: number
  onedrive_folder_url: string | null
  pic_name: string | null
  vo_entries: VOEntry[]
  op_budget_vo: number
}

type Phase = {
  id: string
  project_key: string
  task_description: string
  week_number: number
  end_week: number
  progress_weight: number
  is_done: boolean
  completed_at: string | null
  created_at: string
}

type WeekLog = {
  id: string
  project_key: string
  phase_id: string | null
  week_number: number
  description: string
  photo_url: string
  created_by: string
  created_at: string
  progress_pct: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GANTT_YEAR = 2026
const MONTHS_ID  = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]
const PILL = [
  { bg: "#dbeafe", text: "#1e40af", done: "#3b82f6", border: "#bfdbfe" },
  { bg: "#d1fae5", text: "#065f46", done: "#10b981", border: "#a7f3d0" },
  { bg: "#fce7f3", text: "#831843", done: "#ec4899", border: "#fbcfe8" },
  { bg: "#ede9fe", text: "#4c1d95", done: "#8b5cf6", border: "#ddd6fe" },
  { bg: "#fef3c7", text: "#78350f", done: "#f59e0b", border: "#fde68a" },
  { bg: "#fee2e2", text: "#7f1d1d", done: "#ef4444", border: "#fecaca" },
]
const COL_W     = 60
const INPUT_CLS = "w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = React.useState<T>(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDv(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return dv
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekToMonthIdx(weekNum: number): number {
  return Math.floor((weekNum - 1) / 4)
}

function weekToLabel(weekNum: number): string {
  const totalMo = Math.floor((weekNum - 1) / 4)
  const wInMo   = ((weekNum - 1) % 4) + 1
  const year    = GANTT_YEAR + Math.floor(totalMo / 12)
  const mo      = totalMo % 12
  return `${MONTHS_ID[mo]} '${String(year).slice(2)} W${wInMo}`
}

function monthIdxToLabel(moIdx: number): string {
  const year = GANTT_YEAR + Math.floor(moIdx / 12)
  return `${MONTHS_ID[moIdx % 12]} ${year}`
}

function computeProgress(phases: Phase[]): number {
  const total = phases.reduce((s, p) => s + p.progress_weight, 0) || 1
  const done  = phases.filter(p => p.is_done).reduce((s, p) => s + p.progress_weight, 0)
  return Math.round((done / total) * 100)
}

function hasTerminBell(phaseId: string, phases: Phase[], termins: TerminEntry[]): boolean {
  return termins.some(t => {
    let cum = 0
    for (const p of phases) {
      const prev = cum; cum += p.progress_weight
      if (p.id === phaseId) return t.target_progres > prev && t.target_progres <= cum
    }
    return false
  })
}

function fmtRp(n: number): string {
  return n ? "Rp " + n.toLocaleString("id-ID") : "—"
}

// ─── FormField ────────────────────────────────────────────────────────────────

function FormField({ label, icon, note, required, children }: {
  label: string; icon?: string; note?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5">
        {icon && <span className="text-sm">{icon}</span>}
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {note && <p className="flex items-center gap-1 text-[10px] text-amber-600 mt-1">{note}</p>}
    </div>
  )
}

// ─── Edit Project Modal ───────────────────────────────────────────────────────

function EditProjectModal({
  project, onSave, onClose,
}: {
  project: ProjectSummary
  onSave: (updated: ProjectSummary) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = React.useState({
    display_name:        project.display_name,
    customer_name:       project.customer_name ?? "",
    site_location:       project.site_location ?? "",
    description:         project.description ?? "",
    notes:               project.notes ?? "",
    po_number:           project.po_number ?? "",
    po_value_manual:     String(project.po_value_manual || ""),
    physical_progress:   project.physical_progress,
    project_status:      project.project_status,
    onedrive_folder_url: project.onedrive_folder_url ?? "",
    pic_name:            project.pic_name ?? "",
    op_budget_vo:        String(project.op_budget_vo || ""),
  })
  const [voEntries,      setVoEntries]      = React.useState<VOEntry[]>(project.vo_entries ?? [])
  const [poLocked,       setPoLocked]       = React.useState(false)
  const [loadingPoCheck, setLoadingPoCheck] = React.useState(true)
  const [saving,         setSaving]         = React.useState(false)
  const [saveError,      setSaveError]      = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch(`/api/termin-invoices?key=${encodeURIComponent(project.project_key)}`)
      .then(r => r.json())
      .then(d => setPoLocked(((d.data ?? []) as { status: string }[]).some(r => r.status !== "TERKUNCI")))
      .catch(() => {})
      .finally(() => setLoadingPoCheck(false))
  }, [project.project_key])

  const totalVoBudget = voEntries.reduce((s, v) => s + (Number(v.nilai_po) || 0), 0)
  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveError(null)
    try {
      const voBudget = totalVoBudget || Number(form.op_budget_vo) || 0
      const payload = {
        display_name: form.display_name, customer_name: form.customer_name,
        site_location: form.site_location, description: form.description,
        notes: form.notes, po_value_manual: Number(form.po_value_manual) || 0,
        physical_progress: form.physical_progress, project_status: form.project_status,
        onedrive_folder_url: form.onedrive_folder_url || null,
        pic_name: form.pic_name || null, op_budget_vo: voBudget, vo_entries: voEntries,
        ...(poLocked ? {} : { po_number: form.po_number || null }),
      }
      const res = await fetch(`/api/project-details/${encodeURIComponent(project.project_key)}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan")
      await onSave({ ...project, ...payload, po_number: poLocked ? project.po_number : (form.po_number || null), vo_entries: voEntries, op_budget_vo: voBudget, termin_schedule: project.termin_schedule })
    } catch (err) { setSaveError(String(err)) }
    finally { setSaving(false) }
  }

  const progressOpts = [0,10,20,30,40,50,60,70,75,80,85,90,95,100]

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <Pencil className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-neutral-900">Edit Proyek</p>
              <p className="text-[10px] font-mono text-neutral-400 truncate">{project.project_key}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex-shrink-0 p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form id="edit-proj-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 flex flex-col gap-5">

            <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 flex flex-col gap-4">
              <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Identitas Proyek</p>
              <FormField label="Nama Proyek" required>
                <input className={INPUT_CLS} value={form.display_name} required onChange={e => setField("display_name", e.target.value)} />
              </FormField>
              <FormField label="Nama Klien">
                <input className={INPUT_CLS} value={form.customer_name} onChange={e => setField("customer_name", e.target.value)} placeholder="Nama perusahaan / klien" />
              </FormField>
              <FormField label="Site / Lokasi Pekerjaan" icon="📍">
                <input className={INPUT_CLS} value={form.site_location} onChange={e => setField("site_location", e.target.value)} placeholder="Contoh: Banjarmasin Centrum 30kW" />
              </FormField>
              <FormField label="Penanggung Jawab Lapangan" icon="🧑‍💼">
                <input className={INPUT_CLS} value={form.pic_name} onChange={e => setField("pic_name", e.target.value)} placeholder="Nama PIC lapangan" />
              </FormField>
            </div>

            <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 flex flex-col gap-4">
              <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Kontrak &amp; Keuangan</p>
              <FormField label="Nomor PO Utama (Anchor ID)" icon="📜"
                note={loadingPoCheck ? "Memeriksa status invoice…" : poLocked ? "🔒 PO terkunci — ada invoice aktif di Finance" : undefined}>
                <div className="relative">
                  <input className={`${INPUT_CLS} ${poLocked || loadingPoCheck ? "bg-neutral-50 text-neutral-400 cursor-not-allowed pr-9" : ""}`}
                    value={poLocked ? (project.po_number ?? "") : form.po_number}
                    onChange={e => !poLocked && setField("po_number", e.target.value)}
                    disabled={poLocked || loadingPoCheck} readOnly={poLocked} placeholder="Contoh: 12345/TB-CENTRUM" />
                  {(poLocked || loadingPoCheck) && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {loadingPoCheck ? <RefreshCw className="h-3.5 w-3.5 text-neutral-300 animate-spin" /> : <Lock className="h-3.5 w-3.5 text-neutral-400" />}
                    </div>
                  )}
                </div>
              </FormField>
              <FormField label="Nilai PO / Kontrak (Rp)">
                <input type="number" min={0} className={INPUT_CLS} value={form.po_value_manual} onChange={e => setField("po_value_manual", e.target.value)} placeholder="0" />
              </FormField>
              <FormField label="Link Folder OneDrive">
                <div className="relative">
                  <input type="url" className={INPUT_CLS} value={form.onedrive_folder_url} onChange={e => setField("onedrive_folder_url", e.target.value)} placeholder="https://onedrive.live.com/…" />
                  {form.onedrive_folder_url && (
                    <a href={form.onedrive_folder_url} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-700">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </FormField>
            </div>

            <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 flex flex-col gap-4">
              <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Progres &amp; Status</p>
              <FormField label="Progres Fisik (%)">
                <div className="flex items-center gap-3">
                  <select className={`${INPUT_CLS} w-28 flex-shrink-0`} value={form.physical_progress} onChange={e => setField("physical_progress", Number(e.target.value))}>
                    {progressOpts.map(p => <option key={p} value={p}>{p}%</option>)}
                  </select>
                  <div className="flex-1 h-2 rounded-full bg-neutral-200 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${form.physical_progress}%`, background: form.physical_progress >= 80 ? "#10b981" : form.physical_progress >= 40 ? "#6366f1" : "#f59e0b" }} />
                  </div>
                  <span className="text-xs font-black tabular-nums w-10 text-right flex-shrink-0" style={{ color: form.physical_progress >= 80 ? "#10b981" : form.physical_progress >= 40 ? "#6366f1" : "#f59e0b" }}>{form.physical_progress}%</span>
                </div>
                {form.physical_progress >= 90 && (
                  <p className="flex items-center gap-1.5 mt-1.5 text-[10px] text-emerald-600 font-semibold">
                    <CheckCircle2 className="h-3 w-3" /> Milestone ≥90% — termin invoice terbuka otomatis saat disimpan.
                  </p>
                )}
              </FormField>
              <FormField label="Status Proyek">
                <select className={INPUT_CLS} value={form.project_status} onChange={e => setField("project_status", e.target.value)}>
                  <option value="BERJALAN">BERJALAN</option>
                  <option value="SELESAI">SELESAI</option>
                  <option value="DITUNDA">DITUNDA</option>
                </select>
              </FormField>
            </div>

            <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 flex flex-col gap-4">
              <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Deskripsi &amp; Catatan</p>
              <FormField label="Deskripsi Pekerjaan">
                <textarea className={`${INPUT_CLS} resize-none`} style={{ minHeight: 80 }} value={form.description} onChange={e => setField("description", e.target.value)} placeholder="Lingkup pekerjaan secara singkat…" />
              </FormField>
              <FormField label="Catatan Internal">
                <textarea className={`${INPUT_CLS} resize-none`} style={{ minHeight: 64 }} value={form.notes} onChange={e => setField("notes", e.target.value)} placeholder="Catatan khusus tim internal…" />
              </FormField>
            </div>

            <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Kerja Tambah / Variation Order</p>
                  {voEntries.length > 0 && <p className="text-[10px] text-neutral-500 mt-0.5">Total: <span className="font-bold text-indigo-600">{fmtRp(totalVoBudget)}</span></p>}
                </div>
                <button type="button" onClick={() => setVoEntries(p => [...p, { id: `vo_${Date.now()}`, po_number: "", description: "", nilai_po: 0 }])}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-bold hover:bg-indigo-100 transition-colors">
                  <Plus className="h-3 w-3" /> Tambah VO
                </button>
              </div>
              {voEntries.length === 0 ? (
                <div className="text-center py-4 rounded-xl border border-dashed border-neutral-200">
                  <p className="text-xs text-neutral-300 italic">Belum ada VO / Kerja Tambah</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {voEntries.map((vo, idx) => (
                    <div key={vo.id} className="p-3 rounded-xl border border-neutral-200 bg-white flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">No. PO VO</p>
                          <input className={INPUT_CLS} value={vo.po_number} onChange={e => setVoEntries(p => p.map((v, i) => i === idx ? { ...v, po_number: e.target.value } : v))} placeholder="PO Kerja Tambah" />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Nilai PO (Rp)</p>
                          <input type="number" min={0} className={INPUT_CLS} value={vo.nilai_po || ""} onChange={e => setVoEntries(p => p.map((v, i) => i === idx ? { ...v, nilai_po: Number(e.target.value) } : v))} placeholder="0" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input className={`${INPUT_CLS} flex-1`} value={vo.description} onChange={e => setVoEntries(p => p.map((v, i) => i === idx ? { ...v, description: e.target.value } : v))} placeholder="Deskripsi singkat pekerjaan VO…" />
                        <button type="button" onClick={() => setVoEntries(p => p.filter((_, i) => i !== idx))} className="flex-shrink-0 p-2 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {saveError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-xs text-red-700 font-semibold">Gagal menyimpan</p>
                <p className="text-[11px] text-red-600 mt-0.5">{saveError}</p>
              </div>
            )}
          </div>
        </form>

        <div className="flex gap-2.5 px-6 py-4 border-t border-neutral-200 flex-shrink-0 bg-white">
          <button type="submit" form="edit-proj-form" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Menyimpan…" : "Simpan Perubahan"}
          </button>
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Compact Project Card (5-col density) ────────────────────────────────────

function ProjectCard({ project, isActive, onSelect, onEdit }: {
  project: ProjectSummary; isActive: boolean; onSelect: () => void; onEdit: () => void
}) {
  const prog      = project.physical_progress
  const progColor = prog >= 80 ? "#10b981" : prog >= 40 ? "#6366f1" : "#f59e0b"

  return (
    <div onClick={onSelect}
      className={`group relative flex flex-col rounded-xl bg-white border cursor-pointer transition-all duration-200 overflow-hidden ${
        isActive ? "border-indigo-400 shadow-md ring-1 ring-indigo-400/20" : "border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
      }`}>
      {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500" />}

      {/* Header */}
      <div className={`flex items-center gap-2 px-3 pt-3.5 pb-2.5 border-b ${isActive ? "bg-indigo-50/40 border-indigo-100" : "bg-white border-neutral-100"}`}>
        <div className={`flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${isActive ? "bg-indigo-600" : "bg-neutral-100 group-hover:bg-neutral-200"}`}>
          <FolderOpen className={`h-3.5 w-3.5 transition-colors ${isActive ? "text-white" : "text-neutral-400"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-neutral-900 truncate leading-tight">{project.display_name}</p>
          {project.customer_name && <p className="text-[10px] text-neutral-400 truncate">{project.customer_name}</p>}
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 flex flex-col gap-2 flex-1">
        {project.po_number
          ? <p className="text-[10px] font-mono text-neutral-500 truncate">📜 {project.po_number}</p>
          : <p className="text-[10px] text-neutral-300 italic">No PO</p>}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Progres</p>
            <p className="text-[10px] font-black tabular-nums" style={{ color: progColor }}>{prog}%</p>
          </div>
          <div className="h-1 w-full rounded-full bg-neutral-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${prog}%`, background: progColor }} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 pb-3 pt-1.5">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
          project.project_status === "SELESAI" ? "bg-emerald-100 text-emerald-700" :
          project.project_status === "DITUNDA" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
        }`}>{project.project_status}</span>
        <button type="button" onClick={e => { e.stopPropagation(); onEdit() }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-indigo-50 text-neutral-300 hover:text-indigo-600 transition-all">
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ─── Log Edit Popover ─────────────────────────────────────────────────────────

function LogEditPopover({ log, onSave, onClose }: {
  log: WeekLog
  onSave: (id: string, desc: string, photo: File | null) => Promise<void>
  onClose: () => void
}) {
  const [desc,   setDesc]   = React.useState(log.description)
  const [photo,  setPhoto]  = React.useState<File | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function handleSave() {
    setSaving(true)
    try { await onSave(log.id, desc, photo); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">Edit Log — {weekToLabel(log.week_number)}</span>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-neutral-100 text-neutral-400 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea className="w-full text-xs rounded-lg border border-neutral-200 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all mb-3"
        style={{ minHeight: 80 }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Apa yang sudah dikerjakan…" />
      <div className="mb-4">
        <label className="text-[11px] font-semibold text-neutral-500 mb-1.5 flex items-center gap-1 uppercase tracking-wide">
          <Camera className="h-3 w-3" /> Foto Lapangan
        </label>
        <input type="file" accept="image/*" title="Upload foto"
          className="w-full text-xs text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
        {log.photo_url && !photo && (
          <a href={log.photo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-indigo-500 hover:underline">
            <Camera className="h-2.5 w-2.5" /> Lihat foto saat ini →
          </a>
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Batal</button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocConPage() {
  const [allProjects,  setAllProjects]  = React.useState<ProjectSummary[]>([])
  const [poSearch,     setPoSearch]     = React.useState("")
  const [activeKey,    setActiveKey]    = React.useState<string | null>(null)
  const [loadingProj,  setLoadingProj]  = React.useState(true)
  const [editProject,  setEditProject]  = React.useState<ProjectSummary | null>(null)

  const [phases,      setPhases]      = React.useState<Phase[]>([])
  const [weekLogs,    setWeekLogs]    = React.useState<WeekLog[]>([])
  const [loadingData, setLoadingData] = React.useState(false)

  const [showAddPhase, setShowAddPhase] = React.useState(false)
  const [phaseTask,    setPhaseTask]    = React.useState("")
  const [phaseStartW,  setPhaseStartW]  = React.useState(1)
  const [phaseEndW,    setPhaseEndW]    = React.useState(1)
  const [phaseWeight,  setPhaseWeight]  = React.useState("10")
  const [addingPhase,  setAddingPhase]  = React.useState(false)

  // Manual log add
  const [addLogPhaseId, setAddLogPhaseId] = React.useState<string | null>(null)
  const [addLogWeek,    setAddLogWeek]    = React.useState(1)
  const [addLogDesc,    setAddLogDesc]    = React.useState("")
  const [addLogPhoto,   setAddLogPhoto]   = React.useState<File | null>(null)
  const [addingLog,     setAddingLog]     = React.useState(false)

  const [editingLogId, setEditingLogId] = React.useState<string | null>(null)
  const [billingAlert, setBillingAlert] = React.useState<string[] | null>(null)
  const [billingFired, setBillingFired] = React.useState(false)

  const debouncedSearch = useDebounce(poSearch, 280)

  React.useEffect(() => {
    setLoadingProj(true)
    fetch("/api/project-details", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        const rows = (d.data ?? []) as Array<{
          project_key: string; display_name: string; customer_name?: string | null
          po_number?: string | null; physical_progress?: number; project_status?: string
          termin_schedule?: TerminEntry[] | null; site_location?: string | null
          description?: string | null; notes?: string | null; po_value_manual?: number | null
          onedrive_folder_url?: string | null; pic_name?: string | null
          vo_entries?: VOEntry[] | null; op_budget_vo?: number | null
        }>
        setAllProjects(rows.map(r => ({
          project_key: r.project_key, display_name: r.display_name || r.project_key,
          customer_name: r.customer_name ?? null, po_number: r.po_number ?? null,
          physical_progress: r.physical_progress ?? 0, project_status: r.project_status ?? "BERJALAN",
          termin_schedule: Array.isArray(r.termin_schedule) ? r.termin_schedule : [],
          site_location: r.site_location ?? null, description: r.description ?? null,
          notes: r.notes ?? null, po_value_manual: r.po_value_manual ?? 0,
          onedrive_folder_url: r.onedrive_folder_url ?? null, pic_name: r.pic_name ?? null,
          vo_entries: Array.isArray(r.vo_entries) ? r.vo_entries : [], op_budget_vo: r.op_budget_vo ?? 0,
        })))
      })
      .catch(() => {})
      .finally(() => setLoadingProj(false))
  }, [])

  React.useEffect(() => {
    if (!activeKey) { setPhases([]); setWeekLogs([]); return }
    setLoadingData(true); setBillingFired(false); setBillingAlert(null)
    Promise.all([
      fetch(`/api/project-schedule/${encodeURIComponent(activeKey)}`).then(r => r.json()),
      fetch(`/api/project-weekly-logs/${encodeURIComponent(activeKey)}`).then(r => r.json()),
    ])
      .then(([sched, logs]) => { setPhases((sched.data ?? []) as Phase[]); setWeekLogs((logs.data ?? []) as WeekLog[]) })
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [activeKey])

  React.useEffect(() => {
    if (!activeKey || billingFired || phases.length === 0) return
    const progress = computeProgress(phases)
    if (progress < 90) { setBillingAlert(null); return }
    const project  = allProjects.find(p => p.project_key === activeKey)
    const termins  = project?.termin_schedule ?? []
    const unlocked = termins.length > 0
      ? termins.filter(t => progress >= t.target_progres)
      : [{ id: "_100", nama: "Pelunasan (100%)", target_progres: 100, persen_tagihan: 100 }]
    if (unlocked.length > 0) {
      setBillingAlert(unlocked.map(t => t.nama)); setBillingFired(true)
      fetch(`/api/project-details/${encodeURIComponent(activeKey)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ physical_progress: progress }),
      }).catch(() => {})
      setAllProjects(prev => prev.map(p => p.project_key === activeKey ? { ...p, physical_progress: progress } : p))
    }
  }, [phases, activeKey, billingFired, allProjects])

  const filteredProjects = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim()
    if (!q) return allProjects
    return allProjects.filter(p =>
      (p.po_number ?? "").toLowerCase().includes(q) ||
      p.display_name.toLowerCase().includes(q) ||
      (p.customer_name ?? "").toLowerCase().includes(q)
    )
  }, [allProjects, debouncedSearch])

  const activeProject   = allProjects.find(p => p.project_key === activeKey)
  const currentProgress = computeProgress(phases)
  const maxWeek         = phases.length > 0
    ? Math.max(...phases.map(p => Math.max(p.week_number, p.end_week || p.week_number))) : 1
  const totalWeeks = Math.max(maxWeek, 8)
  const weekArr    = Array.from({ length: totalWeeks }, (_, k) => k + 1)
  const monthGrps  = React.useMemo(() => {
    const grps: { label: string; count: number }[] = []
    let wIdx = 0, mOff = 0
    while (wIdx < totalWeeks) {
      grps.push({ label: MONTHS_ID[mOff % 12], count: Math.min(4, totalWeeks - wIdx) })
      wIdx += 4; mOff++
    }
    return grps
  }, [totalWeeks])

  async function handleSaveEdit(updated: ProjectSummary) {
    setAllProjects(prev => prev.map(p => p.project_key === updated.project_key ? updated : p))
    if (updated.physical_progress >= 90) {
      for (const t of updated.termin_schedule ?? []) {
        if (updated.physical_progress >= t.target_progres) {
          await fetch("/api/termin-invoices", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project_key: updated.project_key, termin_id: t.id, status: "SIAP_TAGIH" }),
          }).catch(() => {})
        }
      }
    }
    setEditProject(null)
  }

  async function handleAddPhase(e: React.FormEvent) {
    e.preventDefault()
    if (!activeKey || !phaseTask.trim()) return
    setAddingPhase(true)
    try {
      const sr = await fetch(`/api/project-schedule/${encodeURIComponent(activeKey)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_number: phaseStartW, end_week: phaseEndW, task_description: phaseTask.trim(), progress_weight: Number(phaseWeight) || 10 }),
      })
      const { data: phase } = await sr.json() as { data: Phase | null }
      if (!phase) return
      setPhases(prev => [...prev, phase].sort((a, b) => a.week_number - b.week_number))
      setPhaseTask(""); setPhaseStartW(1); setPhaseEndW(1); setPhaseWeight("10"); setShowAddPhase(false)
    } finally { setAddingPhase(false) }
  }

  async function handleAddLog(phaseId: string) {
    if (!activeKey || !addLogDesc.trim()) return
    setAddingLog(true)
    try {
      let photoUrl = ""
      if (addLogPhoto) {
        const fd = new FormData()
        fd.append("file", addLogPhoto)
        fd.append("path", `doc-con/${activeKey}/${Date.now()}.${addLogPhoto.name.split(".").pop() ?? "jpg"}`)
        const up  = await fetch("/api/upload-photo", { method: "POST", body: fd })
        const upD = await up.json() as { url?: string }
        photoUrl  = upD.url || ""
      }
      const res = await fetch(`/api/project-weekly-logs/${encodeURIComponent(activeKey)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_number: addLogWeek, description: addLogDesc, photo_url: photoUrl, created_by: "user", progress_pct: currentProgress, phase_id: phaseId }),
      })
      const { data } = await res.json() as { data: WeekLog | null }
      if (data) setWeekLogs(prev => [...prev, data].sort((a, b) => a.week_number - b.week_number))
      setAddLogPhaseId(null); setAddLogWeek(1); setAddLogDesc(""); setAddLogPhoto(null)
    } finally { setAddingLog(false) }
  }

  async function togglePhase(id: string, isDone: boolean) {
    const res   = await fetch(`/api/project-schedule/item/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_done: isDone }) })
    const { data } = await res.json() as { data: Phase | null }
    if (data) setPhases(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
  }

  async function deletePhase(id: string) {
    await fetch(`/api/project-schedule/item/${id}`, { method: "DELETE" })
    const orphanIds = weekLogs.filter(l => l.phase_id === id).map(l => l.id)
    await Promise.all(orphanIds.map(lid => fetch(`/api/project-weekly-logs/item/${lid}`, { method: "DELETE" }).catch(() => {})))
    setPhases(prev => prev.filter(p => p.id !== id)); setWeekLogs(prev => prev.filter(l => l.phase_id !== id))
  }

  async function saveLog(logId: string, desc: string, photo: File | null) {
    let photoUrl = weekLogs.find(l => l.id === logId)?.photo_url ?? ""
    if (photo) {
      const fd = new FormData(); fd.append("file", photo)
      fd.append("path", `doc-con/${activeKey}/${Date.now()}.${photo.name.split(".").pop() ?? "jpg"}`)
      const up = await fetch("/api/upload-photo", { method: "POST", body: fd })
      const upD = await up.json() as { url?: string }; photoUrl = upD.url || photoUrl
    }
    const res = await fetch(`/api/project-weekly-logs/item/${logId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: desc, photo_url: photoUrl, progress_pct: currentProgress }) })
    const { data } = await res.json() as { data: WeekLog | null }
    if (data) setWeekLogs(prev => prev.map(l => l.id === logId ? { ...l, ...data } : l))
    setEditingLogId(null)
  }

  async function deleteLog(logId: string) {
    await fetch(`/api/project-weekly-logs/item/${logId}`, { method: "DELETE" })
    setWeekLogs(prev => prev.filter(l => l.id !== logId))
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col min-h-0">

          {/* Search bar */}
          <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur-sm px-6 py-3.5">
            <div className="relative max-w-xl">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
              <input type="search" value={poSearch} onChange={e => setPoSearch(e.target.value)}
                placeholder="Cari Berdasarkan Nomor PO Utama..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-neutral-200 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400 focus:bg-white transition-all" />
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-6 p-6">

            {/* ── Gallery OR Focus Mode ── */}
            {!activeKey ? (
              <section>
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4">
                  {loadingProj ? "Memuat proyek…" : `${filteredProjects.length} Proyek Tersedia`}
                </p>
                {loadingProj ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="rounded-xl border border-neutral-100 bg-white overflow-hidden animate-pulse">
                        <div className="h-14 bg-neutral-50" />
                        <div className="p-3 flex flex-col gap-2">
                          <div className="h-2.5 bg-neutral-100 rounded-full w-3/4" />
                          <div className="h-2 bg-neutral-100 rounded-full w-full mt-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/40">
                    <div className="h-12 w-12 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center mb-4 shadow-sm">
                      <FolderOpen className="h-5 w-5 text-neutral-300" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-500 mb-1">
                      {debouncedSearch ? `Tidak ada proyek untuk "${debouncedSearch}"` : "Belum ada proyek"}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {debouncedSearch ? "Coba kata kunci lain." : "Proyek akan muncul di sini setelah ditambahkan."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredProjects.map(p => (
                      <ProjectCard key={p.project_key} project={p} isActive={false}
                        onSelect={() => setActiveKey(p.project_key)}
                        onEdit={() => setEditProject(p)} />
                    ))}
                  </div>
                )}
              </section>
            ) : (
              /* ── Focus Mode ── */
              <div className="flex flex-col gap-6">

                {/* Back button + focused card */}
                <div>
                  <button type="button" onClick={() => { setActiveKey(null); setBillingAlert(null) }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-indigo-600 transition-colors mb-4">
                    <ChevronLeft className="h-4 w-4" /> Semua Proyek
                  </button>
                  {activeProject && (
                    <div className="max-w-xs">
                      <ProjectCard project={activeProject} isActive={true}
                        onSelect={() => {}}
                        onEdit={() => setEditProject(activeProject)} />
                    </div>
                  )}
                </div>

                {/* Project info bar */}
                <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-white border border-neutral-200 shadow-sm">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                      <BarChart3 style={{ width: 18, height: 18 }} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-neutral-800 truncate">{activeProject?.display_name}</p>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {activeProject?.customer_name ?? "—"}
                        {activeProject?.po_number && <span className="ml-2 font-mono text-neutral-500">· {activeProject.po_number}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">Progres Fase</p>
                      <p className={`text-2xl font-black tabular-nums leading-none ${currentProgress >= 80 ? "text-emerald-600" : currentProgress >= 40 ? "text-indigo-600" : "text-amber-500"}`}>{currentProgress}%</p>
                    </div>
                    <div className="w-28 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${currentProgress}%`, background: currentProgress >= 80 ? "#10b981" : currentProgress >= 40 ? "#6366f1" : "#f59e0b" }} />
                    </div>
                  </div>
                </div>

                {/* Billing alert */}
                {billingAlert && billingAlert.length > 0 && (
                  <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-emerald-700">Finance Terbuka — Siap Ditagih</p>
                      <p className="text-xs text-emerald-600 mt-0.5">Progress {currentProgress}% memenuhi syarat termin: <span className="font-semibold">{billingAlert.join(", ")}</span>.</p>
                    </div>
                    <button type="button" onClick={() => setBillingAlert(null)} className="p-1 rounded hover:bg-emerald-100 text-emerald-400 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {!billingAlert && phases.length > 0 && currentProgress < 90 && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200">
                    <Lock className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                    <p className="text-xs text-neutral-500">Finance terkunci. Termin terbuka otomatis saat progress ≥ threshold.</p>
                  </div>
                )}

                {loadingData && (
                  <div className="flex items-center justify-center py-16 gap-2 text-neutral-400 text-sm">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Memuat data…
                  </div>
                )}

                {!loadingData && (
                  <>
                    {/* ═══ BLOCK A — JADWAL & RENCANA ═══════════════════════ */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-sm font-bold text-neutral-900">Jadwal &amp; Rencana — {GANTT_YEAR}</h2>
                          <p className="text-[11px] text-neutral-400 mt-0.5">Timeline baseline sinkron ke kalender {GANTT_YEAR}.</p>
                        </div>
                        <button type="button" onClick={() => setShowAddPhase(v => !v)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
                          <Plus className="h-3.5 w-3.5" /> Tambah Fase
                        </button>
                      </div>

                      {showAddPhase && (
                        <form onSubmit={handleAddPhase} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5 mb-5">
                          <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-4">Fase Baru</p>
                          <div className="grid gap-3 sm:grid-cols-4 mb-4">
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Nama Fase</label>
                              <input className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                value={phaseTask} onChange={e => setPhaseTask(e.target.value)} placeholder="Contoh: Pondasi, Instalasi Unit…" required />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Mulai (W)</label>
                              <select title="Pilih minggu mulai"
                                className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                value={phaseStartW}
                                onChange={e => { const v = Number(e.target.value); setPhaseStartW(v); if (phaseEndW < v) setPhaseEndW(v) }}>
                                {Array.from({ length: 48 }, (_, i) => i + 1).map(w => (
                                  <option key={w} value={w}>{weekToLabel(w)}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Selesai (W)</label>
                              <select title="Pilih minggu selesai"
                                className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                value={phaseEndW} onChange={e => setPhaseEndW(Number(e.target.value))}>
                                {Array.from({ length: 48 }, (_, i) => i + 1).filter(w => w >= phaseStartW).map(w => (
                                  <option key={w} value={w}>{weekToLabel(w)}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mb-4">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Bobot Progress (%)</label>
                            <input
                              type="text" inputMode="numeric" pattern="[0-9]*"
                              className="w-20 text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                              value={phaseWeight}
                              onChange={e => setPhaseWeight(e.target.value.replace(/\D/g, ""))} />
                            <p className="text-[10px] text-neutral-400">Total semua fase idealnya = 100%</p>
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" disabled={addingPhase || !phaseTask.trim()}
                              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                              {addingPhase ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Menyimpan…</> : <><Plus className="h-3.5 w-3.5" /> Tambah Fase</>}
                            </button>
                            <button type="button" onClick={() => { setShowAddPhase(false); setPhaseTask(""); setPhaseStartW(1); setPhaseEndW(1); setPhaseWeight("10") }}
                              className="px-5 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
                              Batal
                            </button>
                          </div>
                        </form>
                      )}

                      {phases.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50">
                          <p className="text-sm text-neutral-400 mb-1 font-medium">Belum ada fase dijadwalkan</p>
                          <p className="text-xs text-neutral-300">Klik &ldquo;Tambah Fase&rdquo; untuk mulai membangun timeline {GANTT_YEAR}.</p>
                        </div>
                      ) : (
                        <div className="rounded-xl overflow-hidden border border-neutral-200 bg-white shadow-sm">
                          <div className="flex">
                            <div className="w-52 flex-shrink-0 border-r border-neutral-200">
                              <div className="px-4 bg-neutral-50 border-b border-neutral-200" style={{ height: 58 }}>
                                <div className="flex items-center h-full">
                                  <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Fase Proyek</span>
                                </div>
                              </div>
                              {phases.map((ph, i) => {
                                const c = PILL[i % PILL.length]
                                const hasBell = hasTerminBell(ph.id, phases, activeProject?.termin_schedule ?? [])
                                return (
                                  <div key={ph.id} className="group/row flex items-center gap-2 px-3 border-b border-neutral-100 hover:bg-neutral-50 transition-colors" style={{ minHeight: 48 }}>
                                    <button type="button" title={ph.is_done ? "Tandai belum selesai" : "Tandai selesai"} aria-label={ph.is_done ? "Tandai belum selesai" : "Tandai selesai"}
                                      onClick={() => togglePhase(ph.id, !ph.is_done)}
                                      className="flex-shrink-0 h-4 w-4 rounded flex items-center justify-center transition-all"
                                      style={{ background: ph.is_done ? c.done : "transparent", border: `1.5px solid ${ph.is_done ? c.done : "#d1d5db"}` }}>
                                      {ph.is_done && <CheckCheck className="h-2.5 w-2.5 text-white" />}
                                    </button>
                                    <div className="flex-shrink-0 h-2 w-2 rounded-full" style={{ background: c.done }} />
                                    <span className="text-xs min-w-0 flex-1 truncate font-medium" title={ph.task_description}
                                      style={{ color: ph.is_done ? "#9ca3af" : "#374151", textDecoration: ph.is_done ? "line-through" : "none" }}>
                                      {ph.task_description}
                                    </span>
                                    <div className="flex-shrink-0 flex items-center gap-1">
                                      {hasBell && <span title="Milestone termin"><Bell className="h-3 w-3 text-amber-400" /></span>}
                                      <button type="button" title="Hapus fase" aria-label="Hapus fase" onClick={() => deletePhase(ph.id)}
                                        className="opacity-0 group-hover/row:opacity-100 transition-opacity text-neutral-300 hover:text-red-400">
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                              <div style={{ minWidth: totalWeeks * COL_W }}>
                                <div className="flex border-b border-neutral-200 bg-neutral-50">
                                  {monthGrps.map((mg, mi) => (
                                    <div key={mi} className="flex-shrink-0 flex items-center justify-center border-r border-neutral-100 py-1.5" style={{ width: COL_W * mg.count }}>
                                      <span className="text-[9px] font-black text-neutral-500 tracking-widest uppercase">{mg.label}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex border-b border-neutral-200 bg-neutral-50">
                                  {weekArr.map(w => (
                                    <div key={w} className="flex-shrink-0 flex items-center justify-center py-2 border-r border-neutral-100" style={{ width: COL_W }}>
                                      <span className="text-[9px] font-bold text-neutral-400">W{((w - 1) % 4) + 1}</span>
                                    </div>
                                  ))}
                                </div>
                                {phases.map((ph, i) => {
                                  const c       = PILL[i % PILL.length]
                                  const startW  = Math.max(1, ph.week_number)
                                  const endW    = Math.max(startW, ph.end_week || ph.week_number)
                                  const spanW   = endW - startW + 1
                                  const hasBell = hasTerminBell(ph.id, phases, activeProject?.termin_schedule ?? [])
                                  const barLeft  = (startW - 1) * COL_W + 4
                                  const barWidth = spanW * COL_W - 8
                                  const lblLeft  = barLeft + barWidth + 6
                                  return (
                                    <div key={ph.id} className="relative border-b border-neutral-100" style={{ minHeight: 48, width: totalWeeks * COL_W }}>
                                      <div className="absolute inset-0 flex pointer-events-none">
                                        {weekArr.map(w => <div key={w} className="flex-shrink-0 h-full border-r border-neutral-50" style={{ width: COL_W }} />)}
                                      </div>
                                      <div className="absolute flex items-center gap-1.5 rounded-full px-3 shadow-sm overflow-hidden transition-all duration-300"
                                        style={{ left: barLeft, width: barWidth, height: 28, top: "50%", transform: "translateY(-50%)", background: ph.is_done ? c.done : c.bg, color: c.text, zIndex: 1, border: `1px solid ${ph.is_done ? "transparent" : c.border}` }}>
                                        {hasBell && <Bell className="h-3 w-3 text-amber-400 flex-shrink-0" />}
                                        {ph.is_done && <CheckCheck className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "#fff" }} />}
                                        <span className="text-[10px] font-bold tabular-nums whitespace-nowrap" style={{ color: ph.is_done ? "#fff" : c.text }}>{ph.progress_weight}%</span>
                                      </div>
                                      {lblLeft < totalWeeks * COL_W - 24 && (
                                        <div className="absolute text-[10px] font-medium text-neutral-400 whitespace-nowrap overflow-hidden"
                                          style={{ left: lblLeft, top: "50%", transform: "translateY(-50%)", maxWidth: totalWeeks * COL_W - lblLeft - 4 }}>
                                          {ph.task_description}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ═══ BLOCK B — LOG MINGGUAN (MONTHLY AGGREGATION) ════ */}
                    <div>
                      <div className="mb-4">
                        <h2 className="text-sm font-bold text-neutral-900">Log Mingguan Aktual</h2>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Dikelompokkan per bulan. Tambah entri secara manual saat ada pekerjaan yang perlu dicatat.</p>
                      </div>

                      {phases.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50">
                          <p className="text-xs text-neutral-400">Tambahkan fase untuk mulai mencatat log lapangan.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-8">
                          {phases.map((ph, i) => {
                            const c         = PILL[i % PILL.length]
                            const phaseLogs = weekLogs.filter(l => l.phase_id === ph.id).sort((a, b) => a.week_number - b.week_number)
                            const startMo   = weekToMonthIdx(ph.week_number)
                            const endMo     = weekToMonthIdx(ph.end_week || ph.week_number)
                            const monthSlots = Array.from({ length: endMo - startMo + 1 }, (_, k) => startMo + k)

                            return (
                              <div key={ph.id}>
                                {/* Phase group header */}
                                <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-neutral-100">
                                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: c.done }} />
                                  <span className="text-xs font-bold text-neutral-800">{ph.task_description}</span>
                                  <span className="text-[10px] text-neutral-400">{weekToLabel(ph.week_number)} → {weekToLabel(ph.end_week || ph.week_number)}</span>
                                  <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full ${ph.is_done ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-neutral-100 text-neutral-500 border border-neutral-200"}`}>
                                    {ph.is_done ? "✓ Selesai" : `${ph.progress_weight}% bobot`}
                                  </span>
                                  <button type="button"
                                    onClick={() => { setAddLogPhaseId(addLogPhaseId === ph.id ? null : ph.id); setAddLogWeek(ph.week_number); setAddLogDesc(""); setAddLogPhoto(null) }}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-bold hover:bg-indigo-100 transition-colors flex-shrink-0">
                                    <Plus className="h-3 w-3" /> Tambah Log
                                  </button>
                                </div>

                                {/* Add log inline form */}
                                {addLogPhaseId === ph.id && (
                                  <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
                                    <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-3">Entri Log Baru</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                      <div>
                                        <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Minggu ke-</label>
                                        <input type="text" inputMode="numeric" pattern="[0-9]*"
                                          className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                          value={addLogWeek}
                                          onChange={e => setAddLogWeek(Number(e.target.value.replace(/\D/g, "")) || 1)}
                                          placeholder="Nomor minggu (mis: 3)" />
                                        <p className="text-[9px] text-neutral-400 mt-1">{weekToLabel(addLogWeek)}</p>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Deskripsi Pekerjaan</label>
                                        <textarea
                                          className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                          style={{ minHeight: 68 }}
                                          value={addLogDesc}
                                          onChange={e => setAddLogDesc(e.target.value)}
                                          placeholder="Apa yang dikerjakan pada minggu ini…" />
                                      </div>
                                    </div>
                                    <div className="mb-4">
                                      <label className="text-[10px] font-bold text-neutral-500 mb-1.5 flex items-center gap-1 uppercase tracking-wider">
                                        <Camera className="h-3 w-3" /> Foto Lapangan (opsional)
                                      </label>
                                      <input type="file" accept="image/*" title="Upload foto lapangan"
                                        className="w-full text-xs text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                        onChange={e => setAddLogPhoto(e.target.files?.[0] ?? null)} />
                                    </div>
                                    <div className="flex gap-2">
                                      <button type="button" disabled={addingLog || !addLogDesc.trim()} onClick={() => handleAddLog(ph.id)}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                                        {addingLog ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Menyimpan…</> : <><Save className="h-3.5 w-3.5" /> Simpan Log</>}
                                      </button>
                                      <button type="button" onClick={() => setAddLogPhaseId(null)}
                                        className="px-4 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
                                        Batal
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Monthly grouped log cards */}
                                <div className="flex flex-col gap-4">
                                  {monthSlots.map(moIdx => {
                                    const moLogs  = phaseLogs.filter(l => weekToMonthIdx(l.week_number) === moIdx)
                                    const moFilled = moLogs.filter(l => l.description.trim() || l.photo_url).length

                                    return (
                                      <div key={moIdx}>
                                        {/* Month label bar */}
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-100 mb-2">
                                          <span className="text-xs font-bold text-neutral-700">{monthIdxToLabel(moIdx)}</span>
                                          <span className="text-[10px] text-neutral-400">
                                            {moFilled > 0 ? `${moFilled} entri terisi` : "Belum ada entri"}
                                          </span>
                                          <div className="ml-auto h-1 w-20 rounded-full bg-neutral-200 overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: moLogs.length > 0 ? `${(moFilled / moLogs.length) * 100}%` : "0%", background: c.done }} />
                                          </div>
                                        </div>

                                        {/* Log rows */}
                                        {moLogs.length === 0 ? (
                                          <p className="text-xs text-neutral-300 italic pl-3 py-1.5">
                                            Belum ada log untuk {monthIdxToLabel(moIdx)} — klik &ldquo;Tambah Log&rdquo; di atas.
                                          </p>
                                        ) : (
                                          <div className="rounded-xl border border-neutral-100 overflow-hidden">
                                            {moLogs.map(log => {
                                              const isFilled  = Boolean(log.description.trim() || log.photo_url)
                                              const isEditing = editingLogId === log.id
                                              return (
                                                <div key={log.id}>
                                                  <div className="group flex items-start gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 hover:bg-neutral-50/60 transition-colors">
                                                    <span className="text-[9px] font-black px-2 py-1 rounded-md mt-0.5 whitespace-nowrap flex-shrink-0"
                                                      style={{ background: c.bg, color: c.text }}>
                                                      {weekToLabel(log.week_number)}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                      {isFilled ? (
                                                        <>
                                                          <p className="text-xs text-neutral-700 leading-relaxed line-clamp-2">{log.description}</p>
                                                          <div className="flex items-center gap-3 mt-1.5">
                                                            {log.photo_url && (
                                                              <a href={log.photo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-indigo-500 hover:underline">
                                                                <Camera className="h-2.5 w-2.5" /> Foto
                                                              </a>
                                                            )}
                                                            <span className="text-[9px] text-neutral-400 tabular-nums">{log.progress_pct}% progres</span>
                                                          </div>
                                                        </>
                                                      ) : (
                                                        <p className="text-xs text-neutral-300 italic">Kosong — belum diisi</p>
                                                      )}
                                                    </div>
                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                      <button type="button" title="Edit log" aria-label="Edit log"
                                                        onClick={() => setEditingLogId(isEditing ? null : log.id)}
                                                        className={`p-1.5 rounded-lg transition-colors ${isEditing ? "bg-indigo-100 text-indigo-600" : "hover:bg-neutral-100 text-neutral-400 hover:text-indigo-600"}`}>
                                                        <Pencil className="h-3 w-3" />
                                                      </button>
                                                      <button type="button" title="Hapus log" aria-label="Hapus log"
                                                        onClick={() => deleteLog(log.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-300 hover:text-red-400 transition-colors">
                                                        <Trash2 className="h-3 w-3" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                  {isEditing && (
                                                    <div className="px-4 pb-4 bg-neutral-50 border-b border-neutral-100">
                                                      <LogEditPopover log={log} onSave={saveLog} onClose={() => setEditingLogId(null)} />
                                                    </div>
                                                  )}
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>

        {editProject && (
          <EditProjectModal project={editProject} onSave={handleSaveEdit} onClose={() => setEditProject(null)} />
        )}

      </SidebarInset>
    </SidebarProvider>
  )
}
