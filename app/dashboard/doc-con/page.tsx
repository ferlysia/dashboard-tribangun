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
import { AdminDeleteProject } from "@/components/admin-delete-project"
import { useCurrentUser }     from "@/components/providers/current-user-provider"

// ─── Types ────────────────────────────────────────────────────────────────────

type TerminEntry  = { id: string; nama: string; target_progres: number; persen_tagihan: number }
type VOEntry      = { id: string; po_number: string; description: string; nilai_po: number }

type ProjectSummary = {
  project_key: string; display_name: string; po_number: string | null
  customer_name: string | null; physical_progress: number; project_status: string
  termin_schedule: TerminEntry[]; site_location: string | null; description: string | null
  notes: string | null; po_value_manual: number; onedrive_folder_url: string | null
  pic_name: string | null; vo_entries: VOEntry[]; op_budget_vo: number
  due_date:    string | null   // target selesai (YYYY-MM-DD)
  updated_at:  string | null   // auto-bumped by DB trigger on any child mutation
}

type Phase = {
  id: string; project_key: string; task_description: string; week_number: number
  end_week: number; progress_weight: number; is_done: boolean
  completed_at: string | null; created_at: string
}

type WeekLog = {
  id: string; project_key: string; phase_id: string | null; week_number: number
  description: string; photo_url: string; created_by: string; created_at: string; progress_pct: number
}

type PendingPhase = {
  tempId: string; task_description: string; week_number: number
  end_week: number; progress_weight: number
}

type PendingTermin = {
  tempId: string; termin_name: string; required_progress_trigger: number; billing_percentage: number
}

type DocConTerminInvoice = {
  id: string; termin_id: string
  status: "TERKUNCI" | "SIAP_TAGIH" | "PROSES_COLLECT" | "LUNAS"
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
  React.useEffect(() => { const t = setTimeout(() => setDv(value), ms); return () => clearTimeout(t) }, [value, ms])
  return dv
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekToMonthIdx(w: number): number { return Math.floor((w - 1) / 4) }

function weekToLabel(w: number): string {
  const totalMo = Math.floor((w - 1) / 4)
  const wInMo   = ((w - 1) % 4) + 1
  const year    = GANTT_YEAR + Math.floor(totalMo / 12)
  return `${MONTHS_ID[totalMo % 12]} '${String(year).slice(2)} W${wInMo}`
}

function monthIdxToLabel(m: number): string {
  return `${MONTHS_ID[m % 12]} ${GANTT_YEAR + Math.floor(m / 12)}`
}

function computeProgress(phases: Phase[]): number {
  const total = phases.reduce((s, p) => s + p.progress_weight, 0) || 1
  return Math.round(phases.filter(p => p.is_done).reduce((s, p) => s + p.progress_weight, 0) / total * 100)
}

function hasTerminBell(phaseId: string, phases: Phase[], termins: TerminEntry[]): boolean {
  return termins.some(t => {
    let cum = 0
    for (const p of phases) { const prev = cum; cum += p.progress_weight; if (p.id === phaseId) return t.target_progres > prev && t.target_progres <= cum }
    return false
  })
}

function fmtRp(n: number): string { return n ? "Rp " + n.toLocaleString("id-ID") : "—" }

/** Format a raw string into Indonesian thousands-separated display (10000 → "10.000") */
function fmtRpInput(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""
  return parseInt(digits, 10).toLocaleString("id-ID")
}
/** Strip formatting dots and parse back to integer for DB payload */
function parseRpInput(str: string): number {
  return parseInt(str.replace(/[^0-9]/g, ""), 10) || 0
}

/** Relative timestamp: "Baru saja" / "5m lalu" / "2j lalu" / "3h lalu" */
function relTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000)           return "Baru saja"
  if (ms < 3_600_000)        return `${Math.floor(ms / 60_000)}m lalu`
  if (ms < 86_400_000)       return `${Math.floor(ms / 3_600_000)}j lalu`
  if (ms < 7 * 86_400_000)   return `${Math.floor(ms / 86_400_000)}h lalu`
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
}

// ─── Hybrid Progress Input ────────────────────────────────────────────────────
// Keeps the existing quick-pick preset pattern + adds free-form number typing.

const PROG_PRESETS = [0, 10, 25, 50, 75, 80, 90, 95, 100]

function ProgressInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = React.useState(String(value))
  React.useEffect(() => { setRaw(String(value)) }, [value])

  const clamp = (n: number) => Math.min(100, Math.max(0, n))
  const color  = value >= 80 ? "#10b981" : value >= 40 ? "#6366f1" : "#f59e0b"

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <input
          type="number" min={0} max={100}
          value={raw}
          title="Persentase progres"
          aria-label="Persentase progres lapangan"
          className="w-20 text-center font-black text-lg rounded-lg border border-neutral-200 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          style={{ color }}
          onChange={e => {
            setRaw(e.target.value)
            const n = parseInt(e.target.value, 10)
            if (!isNaN(n)) onChange(clamp(n))
          }}
          onBlur={() => {
            const n = parseInt(raw, 10)
            const c = isNaN(n) ? 0 : clamp(n)
            onChange(c); setRaw(String(c))
          }}
        />
        <div className="flex-1 h-2 rounded-full bg-neutral-200 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${value}%`, background: color }} />
        </div>
        <span className="text-xs font-black tabular-nums w-8 text-right flex-shrink-0"
          style={{ color }}>{value}%</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {PROG_PRESETS.map(p => (
          <button key={p} type="button"
            onClick={() => { onChange(p); setRaw(String(p)) }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
              value === p ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}>
            {p}%
          </button>
        ))}
      </div>
      {value >= 90 && (
        <p className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold">
          <CheckCircle2 className="h-3 w-3" /> Milestone ≥90% — termin terbuka otomatis saat disimpan.
        </p>
      )}
    </div>
  )
}

function genKey(name: string): string {
  const base = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 28)
  return `${base}-${Date.now()}`
}

// ─── FormField ────────────────────────────────────────────────────────────────

function FormField({ label, icon, note, required, children }: {
  label: string; icon?: string; note?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5">
        {icon && <span className="text-sm">{icon}</span>}{label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {note && <p className="text-[10px] text-amber-600 mt-1">{note}</p>}
    </div>
  )
}

// ─── Edit Project Modal ───────────────────────────────────────────────────────

function EditProjectModal({ project, onSave, onClose }: {
  project: ProjectSummary; onSave: (u: ProjectSummary) => Promise<void>; onClose: () => void
}) {
  const [form, setForm] = React.useState({
    display_name: project.display_name, customer_name: project.customer_name ?? "",
    site_location: project.site_location ?? "", description: project.description ?? "",
    notes: project.notes ?? "", po_number: project.po_number ?? "",
    po_value_manual: fmtRpInput(String(project.po_value_manual || "")),
    physical_progress: project.physical_progress, project_status: project.project_status,
    onedrive_folder_url: project.onedrive_folder_url ?? "", pic_name: project.pic_name ?? "",
    op_budget_vo: String(project.op_budget_vo || ""),
    due_date: project.due_date ?? "",
  })
  const [voEntries, setVoEntries] = React.useState<VOEntry[]>(project.vo_entries ?? [])
  const [poLocked, setPoLocked] = React.useState(false)
  const [loadingPoCheck, setLoadingPoCheck] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch(`/api/termin-invoices?key=${encodeURIComponent(project.project_key)}`).then(r => r.json())
      .then(d => setPoLocked(((d.data ?? []) as { status: string }[]).some(r => r.status !== "TERKUNCI")))
      .catch(() => {}).finally(() => setLoadingPoCheck(false))
  }, [project.project_key])

  const totalVo = voEntries.reduce((s, v) => s + (Number(v.nilai_po) || 0), 0)
  function sf<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveError(null)
    try {
      const voBudget = totalVo || Number(form.op_budget_vo) || 0
      const payload = {
        display_name: form.display_name, customer_name: form.customer_name,
        site_location: form.site_location, description: form.description,
        notes: form.notes,
        po_value_manual: parseRpInput(form.po_value_manual),
        physical_progress: form.physical_progress, project_status: form.project_status,
        onedrive_folder_url: form.onedrive_folder_url || null, pic_name: form.pic_name || null,
        op_budget_vo: voBudget, vo_entries: voEntries,
        due_date: form.due_date || null,
        ...(poLocked ? {} : { po_number: form.po_number || null }),
      }
      const res = await fetch(`/api/project-details/${encodeURIComponent(project.project_key)}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan")
      await onSave({ ...project, ...payload, po_number: poLocked ? project.po_number : (form.po_number || null), vo_entries: voEntries, op_budget_vo: voBudget, termin_schedule: project.termin_schedule })
    } catch (err) { setSaveError(String(err)) } finally { setSaving(false) }
  }

  // progOpts removed — replaced by ProgressInput hybrid component below

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0"><Pencil className="h-3.5 w-3.5 text-white" /></div>
            <div className="min-w-0"><p className="text-sm font-bold text-neutral-900">Edit Proyek</p><p className="text-[10px] font-mono text-neutral-400 truncate">{project.project_key}</p></div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <form id="edit-proj-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 flex flex-col gap-5">
            {/* Identitas */}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 flex flex-col gap-4">
              <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Identitas Proyek</p>
              <FormField label="Nama Proyek" required><input className={INPUT_CLS} value={form.display_name} required onChange={e => sf("display_name", e.target.value)} /></FormField>
              <FormField label="Nama Klien"><input className={INPUT_CLS} value={form.customer_name} onChange={e => sf("customer_name", e.target.value)} placeholder="Nama perusahaan / klien" /></FormField>
              <FormField label="Site / Lokasi" icon="📍"><input className={INPUT_CLS} value={form.site_location} onChange={e => sf("site_location", e.target.value)} placeholder="Contoh: Banjarmasin Centrum 30kW" /></FormField>
              <FormField label="Penanggung Jawab" icon="🧑‍💼"><input className={INPUT_CLS} value={form.pic_name} onChange={e => sf("pic_name", e.target.value)} placeholder="Nama PIC lapangan" /></FormField>
            </div>
            {/* Kontrak */}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 flex flex-col gap-4">
              <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Kontrak &amp; Keuangan</p>
              <FormField label="Nomor PO Utama" icon="📜" note={loadingPoCheck ? "Memeriksa…" : poLocked ? "🔒 PO terkunci — ada invoice aktif" : undefined}>
                <div className="relative">
                  <input className={`${INPUT_CLS} ${poLocked || loadingPoCheck ? "bg-neutral-50 text-neutral-400 cursor-not-allowed pr-9" : ""}`}
                    value={poLocked ? (project.po_number ?? "") : form.po_number}
                    onChange={e => !poLocked && sf("po_number", e.target.value)}
                    disabled={poLocked || loadingPoCheck} readOnly={poLocked} placeholder="12345/TB-CENTRUM" />
                  {(poLocked || loadingPoCheck) && <div className="absolute right-3 top-1/2 -translate-y-1/2">{loadingPoCheck ? <RefreshCw className="h-3.5 w-3.5 text-neutral-300 animate-spin" /> : <Lock className="h-3.5 w-3.5 text-neutral-400" />}</div>}
                </div>
              </FormField>
              <FormField label="Nilai PO (Rp)" note="Ketik angka — format otomatis (10.000)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 pointer-events-none">Rp</span>
                  <input className={`${INPUT_CLS} pl-8`} inputMode="numeric"
                    title="Nilai PO kontrak"
                    value={form.po_value_manual}
                    onChange={e => sf("po_value_manual", fmtRpInput(e.target.value))}
                    placeholder="0" />
                </div>
              </FormField>
              <FormField label="Link Folder OneDrive">
                <div className="relative">
                  <input type="url" className={INPUT_CLS} value={form.onedrive_folder_url} onChange={e => sf("onedrive_folder_url", e.target.value)} placeholder="https://onedrive.live.com/…" />
                  {form.onedrive_folder_url && <a href={form.onedrive_folder_url} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500"><ExternalLink className="h-3.5 w-3.5" /></a>}
                </div>
              </FormField>
            </div>
            {/* Progres */}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 flex flex-col gap-4">
              <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Progres &amp; Status</p>
              <FormField label="Progres Lapangan (%)">
                <ProgressInput
                  value={form.physical_progress}
                  onChange={v => sf("physical_progress", v)}
                />
              </FormField>
              <FormField label="Status Proyek">
                <select className={INPUT_CLS} title="Status proyek" aria-label="Status proyek" value={form.project_status} onChange={e => sf("project_status", e.target.value)}>
                  <option value="BERJALAN">BERJALAN</option><option value="SELESAI">SELESAI</option><option value="DITUNDA">DITUNDA</option>
                </select>
              </FormField>
              <FormField label="Target Selesai" icon="📅">
                <input type="date" className={INPUT_CLS}
                  value={form.due_date}
                  onChange={e => sf("due_date", e.target.value)}
                  title="Target tanggal selesai proyek"
                />
              </FormField>
            </div>
            {/* Deskripsi */}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 flex flex-col gap-4">
              <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Deskripsi &amp; Catatan</p>
              <FormField label="Deskripsi Pekerjaan"><textarea className={`${INPUT_CLS} resize-none`} style={{ minHeight: 80 }} value={form.description} onChange={e => sf("description", e.target.value)} placeholder="Lingkup pekerjaan…" /></FormField>
              <FormField label="Catatan Internal"><textarea className={`${INPUT_CLS} resize-none`} style={{ minHeight: 60 }} value={form.notes} onChange={e => sf("notes", e.target.value)} placeholder="Catatan tim internal…" /></FormField>
            </div>
            {/* VO */}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div><p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Kerja Tambah / VO</p>{voEntries.length > 0 && <p className="text-[10px] text-neutral-500 mt-0.5">Total: <span className="font-bold text-indigo-600">{fmtRp(totalVo)}</span></p>}</div>
                <button type="button" onClick={() => setVoEntries(p => [...p, { id: `vo_${Date.now()}`, po_number: "", description: "", nilai_po: 0 }])} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-bold hover:bg-indigo-100"><Plus className="h-3 w-3" /> Tambah VO</button>
              </div>
              {voEntries.length === 0 ? <div className="text-center py-4 rounded-xl border border-dashed border-neutral-200"><p className="text-xs text-neutral-300 italic">Belum ada VO</p></div> : (
                <div className="flex flex-col gap-2.5">
                  {voEntries.map((vo, idx) => (
                    <div key={vo.id} className="p-3 rounded-xl border border-neutral-200 bg-white flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div><p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">No. PO VO</p><input className={INPUT_CLS} value={vo.po_number} onChange={e => setVoEntries(p => p.map((v, i) => i === idx ? { ...v, po_number: e.target.value } : v))} /></div>
                        <div><p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Nilai PO (Rp)</p><input type="number" min={0} className={INPUT_CLS} value={vo.nilai_po || ""} onChange={e => setVoEntries(p => p.map((v, i) => i === idx ? { ...v, nilai_po: Number(e.target.value) } : v))} /></div>
                      </div>
                      <div className="flex gap-2">
                        <input className={`${INPUT_CLS} flex-1`} value={vo.description} onChange={e => setVoEntries(p => p.map((v, i) => i === idx ? { ...v, description: e.target.value } : v))} placeholder="Deskripsi VO…" />
                        <button type="button" onClick={() => setVoEntries(p => p.filter((_, i) => i !== idx))} className="p-2 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {saveError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3"><p className="text-xs text-red-700 font-semibold">Gagal menyimpan</p><p className="text-[11px] text-red-600 mt-0.5">{saveError}</p></div>}
          </div>
        </form>

        <div className="flex gap-2.5 px-6 py-4 border-t border-neutral-200 flex-shrink-0 bg-white">
          <button type="submit" form="edit-proj-form" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Menyimpan…</> : <><Save className="h-4 w-4" /> Simpan Perubahan</>}
          </button>
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">Batal</button>
        </div>
      </div>
    </div>
  )
}

// ─── Full-Page Creation Canvas ────────────────────────────────────────────────

function CreateCanvas({ onBack, onCreated }: {
  onBack: () => void
  onCreated: (p: ProjectSummary) => void
}) {
  const [form, setForm] = React.useState({
    display_name: "", customer_name: "", site_location: "",
    pic_name: "", po_number: "", po_value_manual: "",
    onedrive_folder_url: "", project_status: "BERJALAN",
    physical_progress: 0, description: "", notes: "", due_date: "",
  })
  const [pendingPhases,  setPendingPhases]  = React.useState<PendingPhase[]>([])
  const [showPhaseForm,  setShowPhaseForm]  = React.useState(false)
  const [phTask,         setPhTask]         = React.useState("")
  const [phStartW,       setPhStartW]       = React.useState(1)
  const [phEndW,         setPhEndW]         = React.useState(1)
  const [phWeight,       setPhWeight]       = React.useState("10")
  // TOP (Terms of Payment)
  const [pendingTermins, setPendingTermins] = React.useState<PendingTermin[]>([])
  const [showTerminForm, setShowTerminForm] = React.useState(false)
  const [tName,          setTName]          = React.useState("")
  const [tTrigger,       setTTrigger]       = React.useState("50")
  const [tBillingPct,    setTBillingPct]    = React.useState("30")
  // VO
  const [pendingVOs,     setPendingVOs]     = React.useState<VOEntry[]>([])
  const [saving,         setSaving]         = React.useState(false)
  const [saveErr,        setSaveErr]        = React.useState<string | null>(null)

  function sf<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm(p => ({ ...p, [k]: v })) }

  function addPendingPhase() {
    if (!phTask.trim()) return
    setPendingPhases(prev => [...prev, { tempId: `tmp_${Date.now()}`, task_description: phTask.trim(), week_number: phStartW, end_week: phEndW, progress_weight: Number(phWeight) || 10 }])
    setPhTask(""); setPhStartW(1); setPhEndW(1); setPhWeight("10"); setShowPhaseForm(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.display_name.trim()) return
    setSaving(true); setSaveErr(null)
    try {
      const key = genKey(form.display_name)
      const res = await fetch(`/api/project-details/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: form.display_name, customer_name: form.customer_name,
          site_location: form.site_location, pic_name: form.pic_name || null,
          po_number: form.po_number || null, po_value_manual: parseRpInput(form.po_value_manual),
          onedrive_folder_url: form.onedrive_folder_url || null,
          project_status: form.project_status, physical_progress: form.physical_progress,
          description: form.description, notes: form.notes, created_manually: true,
          due_date: form.due_date || null,
          termin_schedule: pendingTermins.map((t, i) => ({
            id: `t_${Date.now()}_${i}`, nama: t.termin_name,
            target_progres: t.required_progress_trigger, persen_tagihan: t.billing_percentage,
          })),
          vo_entries: pendingVOs,
          op_budget_vo: pendingVOs.reduce((s, v) => s + (Number(v.nilai_po) || 0), 0),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Gagal membuat proyek")

      // Save pending phases
      for (const ph of pendingPhases) {
        await fetch(`/api/project-schedule/${encodeURIComponent(key)}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ week_number: ph.week_number, end_week: ph.end_week, task_description: ph.task_description, progress_weight: ph.progress_weight }),
        }).catch(() => {})
      }

      const voTotal = pendingVOs.reduce((s, v) => s + (Number(v.nilai_po) || 0), 0)
      onCreated({
        project_key: key, display_name: form.display_name,
        customer_name: form.customer_name || null, po_number: form.po_number || null,
        physical_progress: form.physical_progress, project_status: form.project_status,
        termin_schedule: pendingTermins.map((t, i) => ({
          id: `t_${Date.now()}_${i}`, nama: t.termin_name,
          target_progres: t.required_progress_trigger, persen_tagihan: t.billing_percentage,
        })),
        site_location: form.site_location || null,
        description: form.description || null, notes: form.notes || null,
        po_value_manual: parseRpInput(form.po_value_manual),
        onedrive_folder_url: form.onedrive_folder_url || null,
        pic_name: form.pic_name || null, vo_entries: pendingVOs, op_budget_vo: voTotal,
        due_date: form.due_date || null, updated_at: null,
      })
    } catch (err) { setSaveErr(String(err)) } finally { setSaving(false) }
  }

  const totalPendingWeight = pendingPhases.reduce((s, p) => s + p.progress_weight, 0)

  return (
    <div className="flex flex-col min-h-full">
      {/* Canvas sticky header */}
      <div className="sticky top-0 z-20 flex items-center justify-between bg-white/95 backdrop-blur-sm border-b border-neutral-200 px-6 py-3.5 flex-shrink-0">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Batal
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-neutral-900">Proyek Baru</p>
          <p className="text-[10px] text-neutral-400">Isi semua detail dalam satu sesi</p>
        </div>
        <button type="submit" form="create-proj-form" disabled={saving || !form.display_name.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-200">
          {saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Membuat…</> : <><Save className="h-4 w-4" /> Buat Proyek</>}
        </button>
      </div>

      {/* Canvas body */}
      <form id="create-proj-form" onSubmit={handleCreate} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-8">

          {/* ── SECTION 1: Identitas & Metadata ── */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <FolderOpen className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Identitas &amp; Kontrak</h2>
                <p className="text-[11px] text-neutral-400">Metadata inti proyek — semua field dapat diedit kembali setelah dibuat.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <FormField label="Nama Proyek" required>
                  <input className={`${INPUT_CLS} text-sm py-3`} value={form.display_name} required
                    onChange={e => sf("display_name", e.target.value)}
                    placeholder="Contoh: BANJARMASIN CENTRUM 30kW" />
                </FormField>
              </div>

              <FormField label="Nama Klien">
                <input className={INPUT_CLS} value={form.customer_name} onChange={e => sf("customer_name", e.target.value)} placeholder="PT. / CV. nama klien" />
              </FormField>

              <FormField label="Penanggung Jawab Lapangan" icon="🧑‍💼">
                <input className={INPUT_CLS} value={form.pic_name} onChange={e => sf("pic_name", e.target.value)} placeholder="Nama PIC lapangan" />
              </FormField>

              <FormField label="Site / Lokasi Pekerjaan" icon="📍">
                <input className={INPUT_CLS} value={form.site_location} onChange={e => sf("site_location", e.target.value)} placeholder="Contoh: Banjarmasin Centrum 30kW" />
              </FormField>

              <FormField label="Nomor PO Utama" icon="📜">
                <input className={INPUT_CLS} value={form.po_number} onChange={e => sf("po_number", e.target.value)} placeholder="Contoh: 12345/TB-CENTRUM" />
              </FormField>

              <FormField label="Nilai PO / Kontrak (Rp)" note="Ketik angka — format otomatis (10.000)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 pointer-events-none">Rp</span>
                  <input className={`${INPUT_CLS} pl-8`} inputMode="numeric"
                    title="Nilai PO kontrak"
                    value={form.po_value_manual}
                    onChange={e => sf("po_value_manual", fmtRpInput(e.target.value))}
                    placeholder="0" />
                </div>
              </FormField>

              <FormField label="Link Folder OneDrive">
                <div className="relative">
                  <input type="url" className={INPUT_CLS} value={form.onedrive_folder_url}
                    onChange={e => sf("onedrive_folder_url", e.target.value)} placeholder="https://onedrive.live.com/…" />
                  {form.onedrive_folder_url && (
                    <a href={form.onedrive_folder_url} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500"><ExternalLink className="h-3.5 w-3.5" /></a>
                  )}
                </div>
              </FormField>

              <FormField label="Status Awal">
                <select className={INPUT_CLS} title="Status awal proyek" aria-label="Status awal proyek"
                  value={form.project_status} onChange={e => sf("project_status", e.target.value)}>
                  <option value="BERJALAN">BERJALAN</option>
                  <option value="DITUNDA">DITUNDA</option>
                </select>
              </FormField>

              <FormField label="Progres Lapangan Awal (%)">
                <ProgressInput
                  value={form.physical_progress}
                  onChange={v => sf("physical_progress", v)}
                />
              </FormField>

              <FormField label="Target Selesai" icon="📅">
                <input type="date" className={INPUT_CLS}
                  title="Target tanggal selesai proyek"
                  value={form.due_date}
                  onChange={e => sf("due_date", e.target.value)} />
              </FormField>

              <div className="sm:col-span-2">
                <FormField label="Deskripsi Pekerjaan">
                  <textarea className={`${INPUT_CLS} resize-none`} style={{ minHeight: 80 }} value={form.description}
                    onChange={e => sf("description", e.target.value)} placeholder="Lingkup pekerjaan secara singkat…" />
                </FormField>
              </div>

              <div className="sm:col-span-2">
                <FormField label="Catatan Internal">
                  <textarea className={`${INPUT_CLS} resize-none`} style={{ minHeight: 60 }} value={form.notes}
                    onChange={e => sf("notes", e.target.value)} placeholder="Catatan khusus tim internal…" />
                </FormField>
              </div>
            </div>
          </section>

          {/* ── SECTION 2: Jadwal & Rencana ── */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">Jadwal &amp; Rencana — {GANTT_YEAR}</h2>
                  <p className="text-[11px] text-neutral-400">Tambah fase baseline sekarang (opsional) atau tambahkan setelah proyek dibuat.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowPhaseForm(v => !v)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-sm">
                <Plus className="h-3.5 w-3.5" /> Tambah Fase
              </button>
            </div>

            {/* Inline phase add form */}
            {showPhaseForm && (
              <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-5 mb-4">
                <p className="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-4">Fase Baru</p>
                <div className="grid gap-3 sm:grid-cols-4 mb-4">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Nama Fase</label>
                    <input className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                      value={phTask} onChange={e => setPhTask(e.target.value)} placeholder="Contoh: Pondasi, Instalasi Panel…" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Mulai (W)</label>
                    <select title="Pilih minggu mulai"
                      className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                      value={phStartW} onChange={e => { const v = Number(e.target.value); setPhStartW(v); if (phEndW < v) setPhEndW(v) }}>
                      {Array.from({ length: 48 }, (_, i) => i + 1).map(w => <option key={w} value={w}>{weekToLabel(w)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Selesai (W)</label>
                    <select title="Pilih minggu selesai"
                      className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                      value={phEndW} onChange={e => setPhEndW(Number(e.target.value))}>
                      {Array.from({ length: 48 }, (_, i) => i + 1).filter(w => w >= phStartW).map(w => <option key={w} value={w}>{weekToLabel(w)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Bobot Progress (%)</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*"
                    title="Bobot progress fase (%)" placeholder="10"
                    className="w-20 text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                    value={phWeight} onChange={e => setPhWeight(e.target.value.replace(/\D/g, ""))} />
                  {totalPendingWeight > 0 && (
                    <p className="text-[10px] text-neutral-400">Total fase saat ini: <span className={`font-bold ${totalPendingWeight + (Number(phWeight) || 0) > 100 ? "text-red-500" : "text-neutral-600"}`}>{totalPendingWeight + (Number(phWeight) || 0)}%</span></p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={!phTask.trim()} onClick={addPendingPhase}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Tambah ke Antrian
                  </button>
                  <button type="button" onClick={() => { setShowPhaseForm(false); setPhTask(""); setPhStartW(1); setPhEndW(1); setPhWeight("10") }}
                    className="px-5 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Batal</button>
                </div>
              </div>
            )}

            {pendingPhases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/40 flex flex-col items-center justify-center py-10">
                <p className="text-sm text-neutral-400 font-medium mb-1">Belum ada fase dijadwalkan</p>
                <p className="text-xs text-neutral-300">Klik &ldquo;Tambah Fase&rdquo; untuk membangun timeline proyek sekarang, atau lewati dan lakukan setelah proyek dibuat.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{pendingPhases.length} Fase Dijadwalkan</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${totalPendingWeight === 100 ? "bg-emerald-100 text-emerald-700" : totalPendingWeight > 100 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                    Total Bobot: {totalPendingWeight}%{totalPendingWeight === 100 ? " ✓" : ""}
                  </span>
                </div>
                {pendingPhases.map((ph, i) => {
                  const c = PILL[i % PILL.length]
                  return (
                    <div key={ph.tempId} className="flex items-center gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 hover:bg-neutral-50/50 transition-colors">
                      <div className="flex-shrink-0 h-2.5 w-2.5 rounded-full" style={{ background: c.done }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-neutral-800 truncate">{ph.task_description}</p>
                        <p className="text-[10px] text-neutral-400">{weekToLabel(ph.week_number)} → {weekToLabel(ph.end_week)}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: c.bg, color: c.text }}>{ph.progress_weight}%</span>
                      <button type="button" onClick={() => setPendingPhases(p => p.filter(x => x.tempId !== ph.tempId))}
                        className="flex-shrink-0 p-1.5 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── SECTION 3: Terms of Payment (TOP) ── */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-black">TOP</span>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">Terms of Payment (TOP)</h2>
                  <p className="text-[11px] text-neutral-400">Milestone tagihan fleksibel — setiap termin punya trigger progres sendiri.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowTerminForm(v => !v)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm flex-shrink-0">
                <Plus className="h-3.5 w-3.5" /> Tambah Termin
              </button>
            </div>

            {showTerminForm && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-5 mb-4">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-4">Termin Baru</p>
                <div className="grid gap-3 sm:grid-cols-3 mb-4">
                  <div className="sm:col-span-1">
                    <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Nama Termin</label>
                    <input className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 transition-all"
                      value={tName} onChange={e => setTName(e.target.value)} placeholder="Contoh: DP 30%, Progress 40%…" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Trigger Progres (%)</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*"
                      className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 transition-all"
                      value={tTrigger} onChange={e => setTTrigger(e.target.value.replace(/\D/g, ""))}
                      placeholder="50" />
                    <p className="text-[9px] text-neutral-400 mt-1">Tagihan terbuka saat progres fisik ≥ nilai ini</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Porsi Tagihan (%)</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*"
                      className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 transition-all"
                      value={tBillingPct} onChange={e => setTBillingPct(e.target.value.replace(/\D/g, ""))}
                      placeholder="30" />
                    <p className="text-[9px] text-neutral-400 mt-1">% dari total nilai kontrak</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={!tName.trim()}
                    onClick={() => {
                      if (!tName.trim()) return
                      setPendingTermins(prev => [...prev, { tempId: `pt_${Date.now()}`, termin_name: tName.trim(), required_progress_trigger: Number(tTrigger) || 50, billing_percentage: Number(tBillingPct) || 30 }])
                      setTName(""); setTTrigger("50"); setTBillingPct("30"); setShowTerminForm(false)
                    }}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-50 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Tambah ke Antrian
                  </button>
                  <button type="button" onClick={() => { setShowTerminForm(false); setTName(""); setTTrigger("50"); setTBillingPct("30") }}
                    className="px-5 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Batal</button>
                </div>
              </div>
            )}

            {pendingTermins.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/40 flex flex-col items-center justify-center py-8">
                <p className="text-sm text-neutral-400 font-medium mb-1">Belum ada termin pembayaran</p>
                <p className="text-xs text-neutral-300">TOP opsional — bisa ditambahkan setelah proyek dibuat.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{pendingTermins.length} Termin Dijadwalkan</span>
                  {(() => {
                    const total = pendingTermins.reduce((s, t) => s + t.billing_percentage, 0)
                    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${total === 100 ? "bg-emerald-100 text-emerald-700" : total > 100 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                      Total: {total}%{total === 100 ? " ✓" : ""}
                    </span>
                  })()}
                </div>
                {pendingTermins.map((t, i) => (
                  <div key={t.tempId} className="flex items-center gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 hover:bg-neutral-50/50 transition-colors">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 flex-shrink-0">T{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-neutral-800">{t.termin_name}</p>
                      <p className="text-[10px] text-neutral-400">Trigger: ≥{t.required_progress_trigger}% · Porsi: {t.billing_percentage}% kontrak</p>
                    </div>
                    <button type="button" aria-label="Hapus termin" title="Hapus termin"
                      onClick={() => setPendingTermins(p => p.filter(x => x.tempId !== t.tempId))}
                      className="p-1.5 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── SECTION 4: Variation Order (VO) ── */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-violet-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-black">VO</span>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">Variation Order / Kerja Tambah</h2>
                  <p className="text-[11px] text-neutral-400">VO menambah nilai kontrak baseline untuk kalkulasi Finance.</p>
                </div>
              </div>
              <button type="button"
                onClick={() => setPendingVOs(prev => [...prev, { id: `vo_${Date.now()}`, po_number: "", description: "", nilai_po: 0 }])}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-violet-500 text-white hover:bg-violet-600 transition-colors shadow-sm flex-shrink-0">
                <Plus className="h-3.5 w-3.5" /> Tambah VO
              </button>
            </div>

            {pendingVOs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/40 flex items-center justify-center py-8">
                <p className="text-xs text-neutral-300 italic">Belum ada VO — opsional, bisa ditambahkan setelah proyek dibuat.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {pendingVOs.map((vo, idx) => (
                  <div key={vo.id} className="p-4 rounded-xl border border-neutral-200 bg-white grid grid-cols-3 gap-3 items-start">
                    <div>
                      <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">No. PO VO</p>
                      <input className={INPUT_CLS} value={vo.po_number} placeholder="PO Kerja Tambah"
                        onChange={e => setPendingVOs(p => p.map((v, i) => i === idx ? { ...v, po_number: e.target.value } : v))} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Nilai PO (Rp)</p>
                      <input type="number" min={0} className={INPUT_CLS} value={vo.nilai_po || ""} placeholder="0"
                        onChange={e => setPendingVOs(p => p.map((v, i) => i === idx ? { ...v, nilai_po: Number(e.target.value) } : v))} />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Deskripsi</p>
                        <input className={INPUT_CLS} value={vo.description} placeholder="Deskripsi VO…"
                          onChange={e => setPendingVOs(p => p.map((v, i) => i === idx ? { ...v, description: e.target.value } : v))} />
                      </div>
                      <button type="button" onClick={() => setPendingVOs(p => p.filter((_, i) => i !== idx))}
                        className="mt-5 p-2 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-neutral-400 text-right">
                  Total VO: <span className="font-bold text-violet-600">
                    Rp {pendingVOs.reduce((s, v) => s + (Number(v.nilai_po) || 0), 0).toLocaleString("id-ID")}
                  </span>
                </p>
              </div>
            )}
          </section>

          {/* ── SECTION 5: Log Mingguan (Placeholder) ── */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-xl bg-neutral-200 flex items-center justify-center flex-shrink-0">
                <Camera className="h-4 w-4 text-neutral-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Log Mingguan Aktual</h2>
                <p className="text-[11px] text-neutral-400">Tersedia setelah proyek dibuat dan fase pertama ditambahkan.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/40 flex flex-col items-center justify-center py-12 gap-2">
              <div className="flex gap-2">
                {[1,2,3].map(i => (
                  <div key={i} className="h-20 w-32 rounded-xl bg-white border border-neutral-100 animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
                ))}
              </div>
              <p className="text-xs text-neutral-400 mt-3 font-medium">Log lapangan akan tersedia di sini</p>
              <p className="text-[11px] text-neutral-300 max-w-xs text-center">Setelah proyek disimpan, kembali ke workspace untuk menambahkan log mingguan lapangan.</p>
            </div>
          </section>

          {saveErr && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-xs text-red-700 font-semibold">Gagal membuat proyek</p>
              <p className="text-[11px] text-red-600 mt-0.5">{saveErr}</p>
            </div>
          )}

          {/* Bottom save button */}
          <div className="pb-8">
            <button type="submit" form="create-proj-form" disabled={saving || !form.display_name.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md shadow-indigo-200/60">
              {saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Membuat Proyek…</> : <><Save className="h-4 w-4" /> Buat &amp; Buka Workspace Proyek</>}
            </button>
          </div>

        </div>
      </form>
    </div>
  )
}

// ─── Project Card (4-col, full metadata) ─────────────────────────────────────

function ProjectCard({ project, isActive, onFocus, onEdit }: {
  project: ProjectSummary; isActive: boolean
  onFocus: () => void   // card click or pencil click → focus mode
  onEdit: () => void    // opens EditProjectModal (from within focus mode context only)
}) {
  const prog      = project.physical_progress
  const progColor = prog >= 80 ? "#10b981" : prog >= 40 ? "#6366f1" : "#f59e0b"

  return (
    <div onClick={onFocus}
      className={`group relative flex flex-col rounded-2xl bg-white border cursor-pointer transition-all duration-200 overflow-hidden ${
        isActive ? "border-indigo-400 shadow-lg shadow-indigo-100/60 ring-1 ring-indigo-400/20" : "border-neutral-200 hover:border-neutral-300 hover:shadow-md"
      }`}>
      {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500" />}

      {/* Header: icon + name + client + status */}
      <div className={`flex items-start gap-3 px-4 pt-4 pb-3.5 border-b ${isActive ? "bg-indigo-50/40 border-indigo-100" : "bg-white border-neutral-100"}`}>
        <div className={`flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${isActive ? "bg-indigo-600" : "bg-neutral-100 group-hover:bg-neutral-200"}`}>
          <FolderOpen className={`h-4 w-4 transition-colors ${isActive ? "text-white" : "text-neutral-400"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-neutral-900 leading-snug line-clamp-2">{project.display_name}</p>
          <p className="text-[11px] text-neutral-400 truncate mt-0.5">{project.customer_name ?? <span className="italic">Klien belum diset</span>}</p>
        </div>
        <span className={`flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide mt-0.5 ${
          project.project_status === "SELESAI" ? "bg-emerald-100 text-emerald-700" :
          project.project_status === "DITUNDA" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
        }`}>{project.project_status}</span>
      </div>

      {/* Metadata */}
      <div className="px-4 py-3.5 flex flex-col gap-3 flex-1">
        {/* 📍 Site location */}
        <div className="flex items-start gap-2">
          <span className="text-sm w-5 flex-shrink-0 leading-none mt-0.5">📍</span>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">Lokasi</p>
            <p className="text-[11px] text-neutral-700 truncate">{project.site_location ?? <span className="text-neutral-300 italic">—</span>}</p>
          </div>
        </div>
        {/* 📜 PO number */}
        <div className="flex items-start gap-2">
          <span className="text-sm w-5 flex-shrink-0 leading-none mt-0.5">📜</span>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">No. PO</p>
            <p className="text-[11px] font-mono text-neutral-700 truncate">{project.po_number ?? <span className="text-neutral-300 italic not-italic">Belum diset</span>}</p>
          </div>
        </div>
        {/* 🧑‍💼 PIC */}
        <div className="flex items-start gap-2">
          <span className="text-sm w-5 flex-shrink-0 leading-none mt-0.5">🧑‍💼</span>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">PIC</p>
            <p className="text-[11px] text-neutral-700 truncate">{project.pic_name ?? <span className="text-neutral-300 italic">Belum diset</span>}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-auto pt-1">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Progres Lapangan</p>
            <p className="text-xs font-black tabular-nums" style={{ color: progColor }}>{prog}%</p>
          </div>
          <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${prog}%`, background: progColor }} />
          </div>
        </div>
      </div>

      {/* Footer: last updated + due date */}
      <div className="px-4 pb-3.5 pt-2 border-t border-neutral-50 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-neutral-300 tabular-nums" title={project.updated_at ?? undefined}>
            {project.updated_at ? relTime(project.updated_at) : "Belum diupdate"}
          </span>
          {project.due_date && (() => {
            const days = Math.ceil((new Date(project.due_date).getTime() - Date.now()) / 86_400_000)
            return (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                days < 0 ? "bg-red-50 text-red-600 border-red-200" :
                days <= 14 ? "bg-amber-50 text-amber-600 border-amber-200" :
                "bg-neutral-50 text-neutral-400 border-neutral-200"
              }`}>
                📅 {days < 0 ? `Terlambat ${Math.abs(days)}h` : `Due ${days}h`}
              </span>
            )
          })()}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-neutral-400">{isActive ? "Workspace aktif" : "Klik untuk buka"}</span>
          <button type="button" onClick={e => { e.stopPropagation(); onFocus() }}
            title="Buka workspace proyek"
            className={`opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all ${isActive ? "opacity-100 bg-indigo-100 text-indigo-600" : "hover:bg-indigo-50 text-neutral-300 hover:text-indigo-600"}`}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
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
    try { await onSave(log.id, desc, photo); onClose() } finally { setSaving(false) }
  }

  return (
    <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">Edit Log — {weekToLabel(log.week_number)}</span>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-neutral-100 text-neutral-400"><X className="h-3.5 w-3.5" /></button>
      </div>
      <textarea className="w-full text-xs rounded-lg border border-neutral-200 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 mb-3"
        style={{ minHeight: 80 }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Apa yang sudah dikerjakan…" />
      <div className="mb-4">
        <label className="text-[11px] font-semibold text-neutral-500 mb-1.5 flex items-center gap-1 uppercase tracking-wide"><Camera className="h-3 w-3" /> Foto Lapangan</label>
        <input type="file" accept="image/*" title="Upload foto" className="w-full text-xs text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
        {log.photo_url && !photo && <a href={log.photo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-indigo-500 hover:underline"><Camera className="h-2.5 w-2.5" /> Lihat foto saat ini →</a>}
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
          {saving ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Menyimpan…</> : <><Save className="h-3.5 w-3.5" /> Simpan</>}
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Batal</button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocConPage() {
  const { user } = useCurrentUser()
  const [allProjects,  setAllProjects]  = React.useState<ProjectSummary[]>([])
  const [poSearch,     setPoSearch]     = React.useState("")
  const [activeKey,    setActiveKey]    = React.useState<string | null>(null)
  const [loadingProj,  setLoadingProj]  = React.useState(true)
  const [isCreating,   setIsCreating]   = React.useState(false)
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

  const [addLogPhaseId, setAddLogPhaseId] = React.useState<string | null>(null)
  const [addLogWeek,    setAddLogWeek]    = React.useState(1)
  const [addLogDesc,    setAddLogDesc]    = React.useState("")
  const [addLogPhoto,   setAddLogPhoto]   = React.useState<File | null>(null)
  const [addingLog,     setAddingLog]     = React.useState(false)

  const [editingLogId,   setEditingLogId]   = React.useState<string | null>(null)
  const [billingAlert,   setBillingAlert]   = React.useState<string[] | null>(null)
  const [billingFired,   setBillingFired]   = React.useState(false)
  // TOP state
  const [terminInvoices, setTerminInvoices] = React.useState<DocConTerminInvoice[]>([])
  const [sendingTermin,  setSendingTermin]  = React.useState<string | null>(null)
  const [showTopEditor,  setShowTopEditor]  = React.useState(false)
  const [editingTop,     setEditingTop]     = React.useState<TerminEntry[]>([])
  const [savingTop,      setSavingTop]      = React.useState(false)

  const debouncedSearch = useDebounce(poSearch, 280)

  React.useEffect(() => {
    setLoadingProj(true)
    fetch("/api/project-details", { cache: "no-store" }).then(r => r.json()).then(d => {
      const rows = (d.data ?? []) as Array<{
        project_key: string; display_name: string; customer_name?: string | null
        po_number?: string | null; physical_progress?: number; project_status?: string
        termin_schedule?: TerminEntry[] | null; site_location?: string | null
        description?: string | null; notes?: string | null; po_value_manual?: number | null
        onedrive_folder_url?: string | null; pic_name?: string | null
        vo_entries?: VOEntry[] | null; op_budget_vo?: number | null
        due_date?: string | null; updated_at?: string | null
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
        due_date:   r.due_date   ?? null,
        updated_at: r.updated_at ?? null,
      })))
    }).catch(() => {}).finally(() => setLoadingProj(false))
  }, [])

  React.useEffect(() => {
    if (!activeKey) { setPhases([]); setWeekLogs([]); setTerminInvoices([]); return }
    setLoadingData(true); setBillingFired(false); setBillingAlert(null)
    Promise.all([
      fetch(`/api/project-schedule/${encodeURIComponent(activeKey)}`).then(r => r.json()),
      fetch(`/api/project-weekly-logs/${encodeURIComponent(activeKey)}`).then(r => r.json()),
    ]).then(([sched, logs]) => { setPhases((sched.data ?? []) as Phase[]); setWeekLogs((logs.data ?? []) as WeekLog[]) })
      .catch(() => {}).finally(() => setLoadingData(false))
    // Load termin invoices for TOP panel
    fetch(`/api/termin-invoices?key=${encodeURIComponent(activeKey)}`)
      .then(r => r.json())
      .then(d => setTerminInvoices((d.data ?? []) as DocConTerminInvoice[]))
      .catch(() => {})
  }, [activeKey])

  React.useEffect(() => {
    if (!activeKey || billingFired || phases.length === 0) return
    const progress = computeProgress(phases)
    if (progress < 90) { setBillingAlert(null); return }
    const project  = allProjects.find(p => p.project_key === activeKey)
    const termins  = project?.termin_schedule ?? []
    const unlocked = termins.length > 0 ? termins.filter(t => progress >= t.target_progres) : [{ id: "_100", nama: "Pelunasan (100%)", target_progres: 100, persen_tagihan: 100 }]
    if (unlocked.length > 0) {
      setBillingAlert(unlocked.map(t => t.nama)); setBillingFired(true)
      fetch(`/api/project-details/${encodeURIComponent(activeKey)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ physical_progress: progress }) }).catch(() => {})
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
  const maxWeek         = phases.length > 0 ? Math.max(...phases.map(p => Math.max(p.week_number, p.end_week || p.week_number))) : 1
  const totalWeeks = Math.max(maxWeek, 8)
  const weekArr    = Array.from({ length: totalWeeks }, (_, k) => k + 1)
  const monthGrps  = React.useMemo(() => {
    const grps: { label: string; count: number }[] = []
    let wIdx = 0, mOff = 0
    while (wIdx < totalWeeks) { grps.push({ label: MONTHS_ID[mOff % 12], count: Math.min(4, totalWeeks - wIdx) }); wIdx += 4; mOff++ }
    return grps
  }, [totalWeeks])

  function handleProjectCreated(project: ProjectSummary) {
    setAllProjects(prev => [project, ...prev])
    setActiveKey(project.project_key)
    setIsCreating(false)
  }

  async function handleSaveEdit(updated: ProjectSummary) {
    setAllProjects(prev => prev.map(p => p.project_key === updated.project_key ? updated : p))
    if (updated.physical_progress >= 90) {
      for (const t of updated.termin_schedule ?? []) {
        if (updated.physical_progress >= t.target_progres) {
          await fetch("/api/termin-invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_key: updated.project_key, termin_id: t.id, status: "SIAP_TAGIH" }) }).catch(() => {})
        }
      }
    }
    setEditProject(null)
  }

  async function sendTerminToFinance(terminId: string) {
    if (!activeKey) return
    setSendingTermin(terminId)
    try {
      const res = await fetch("/api/termin-invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_key: activeKey, termin_id: terminId, status: "SIAP_TAGIH" }),
      })
      const { data } = await res.json() as { data: DocConTerminInvoice | null }
      if (data) setTerminInvoices(prev => [...prev.filter(i => i.termin_id !== terminId), data])
    } finally { setSendingTermin(null) }
  }

  async function saveTopSchedule(termins: TerminEntry[]) {
    if (!activeKey) return
    setSavingTop(true)
    try {
      const res = await fetch(`/api/project-details/${encodeURIComponent(activeKey)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termin_schedule: termins }),
      })
      if (!res.ok) throw new Error("Gagal menyimpan TOP")
      setAllProjects(prev => prev.map(p => p.project_key === activeKey ? { ...p, termin_schedule: termins } : p))
      setShowTopEditor(false)
    } finally { setSavingTop(false) }
  }

  async function handleAddPhase(e: React.FormEvent) {
    e.preventDefault()
    if (!activeKey || !phaseTask.trim()) return
    setAddingPhase(true)
    try {
      const sr = await fetch(`/api/project-schedule/${encodeURIComponent(activeKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week_number: phaseStartW, end_week: phaseEndW, task_description: phaseTask.trim(), progress_weight: Number(phaseWeight) || 10 }) })
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
        const fd = new FormData(); fd.append("file", addLogPhoto); fd.append("path", `doc-con/${activeKey}/${Date.now()}.${addLogPhoto.name.split(".").pop() ?? "jpg"}`)
        const up = await fetch("/api/upload-photo", { method: "POST", body: fd }); photoUrl = ((await up.json()) as { url?: string }).url || ""
      }
      const res = await fetch(`/api/project-weekly-logs/${encodeURIComponent(activeKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week_number: addLogWeek, description: addLogDesc, photo_url: photoUrl, created_by: "user", progress_pct: currentProgress, phase_id: phaseId }) })
      const { data } = await res.json() as { data: WeekLog | null }
      if (data) setWeekLogs(prev => [...prev, data].sort((a, b) => a.week_number - b.week_number))
      setAddLogPhaseId(null); setAddLogWeek(1); setAddLogDesc(""); setAddLogPhoto(null)
    } finally { setAddingLog(false) }
  }

  async function togglePhase(id: string, isDone: boolean) {
    const res = await fetch(`/api/project-schedule/item/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_done: isDone }) })
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
      const fd = new FormData(); fd.append("file", photo); fd.append("path", `doc-con/${activeKey}/${Date.now()}.${photo.name.split(".").pop() ?? "jpg"}`)
      const up = await fetch("/api/upload-photo", { method: "POST", body: fd }); photoUrl = ((await up.json()) as { url?: string }).url || photoUrl
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

          {/* Creation Canvas — full-page replacement */}
          {isCreating ? (
            <div className="flex-1 overflow-y-auto">
              <CreateCanvas onBack={() => setIsCreating(false)} onCreated={handleProjectCreated} />
            </div>
          ) : (
            <>
              {/* Search + New Project button */}
              <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur-sm px-6 py-3.5 flex items-center gap-4">
                <div className="relative flex-1 max-w-xl">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                  <input type="search" value={poSearch} onChange={e => setPoSearch(e.target.value)}
                    placeholder="Cari Berdasarkan Nomor PO Utama..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-neutral-200 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400 focus:bg-white transition-all" />
                </div>
                <button type="button" onClick={() => { setIsCreating(true); setActiveKey(null) }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 flex-shrink-0">
                  <Plus className="h-4 w-4" /> Proyek Baru
                </button>
              </div>

              <div className="flex flex-1 flex-col gap-6 p-6">

                {/* Gallery OR Focus Mode */}
                {!activeKey ? (
                  <section>
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4">
                      {loadingProj ? "Memuat proyek…" : `${filteredProjects.length} Proyek Tersedia`}
                    </p>
                    {loadingProj ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="rounded-2xl border border-neutral-100 bg-white overflow-hidden animate-pulse">
                            <div className="h-20 bg-neutral-50" />
                            <div className="p-4 flex flex-col gap-3">
                              <div className="h-2.5 bg-neutral-100 rounded-full w-3/4" />
                              <div className="h-2.5 bg-neutral-100 rounded-full w-1/2" />
                              <div className="h-2 bg-neutral-100 rounded-full w-full mt-1" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : filteredProjects.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/40">
                        <div className="h-14 w-14 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center mb-4 shadow-sm"><FolderOpen className="h-6 w-6 text-neutral-300" /></div>
                        <p className="text-sm font-semibold text-neutral-500 mb-1">{debouncedSearch ? `Tidak ada proyek untuk "${debouncedSearch}"` : "Belum ada proyek"}</p>
                        <p className="text-xs text-neutral-400 mb-4">{debouncedSearch ? "Coba kata kunci lain." : "Klik \"+ Proyek Baru\" untuk mulai."}</p>
                        {!debouncedSearch && (
                          <button type="button" onClick={() => setIsCreating(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors">
                            <Plus className="h-4 w-4" /> Proyek Baru
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {filteredProjects.map(p => (
                          <ProjectCard key={p.project_key} project={p} isActive={false}
                            onFocus={() => setActiveKey(p.project_key)}
                            onEdit={() => setEditProject(p)} />
                        ))}
                      </div>
                    )}
                  </section>
                ) : (
                  /* ── Focus Mode ── */
                  <div className="flex flex-col gap-6">
                    {/* Back + focused card */}
                    <div>
                      <button type="button" onClick={() => { setActiveKey(null); setBillingAlert(null) }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-indigo-600 transition-colors mb-4">
                        <ChevronLeft className="h-4 w-4" /> Semua Proyek
                      </button>
                      {activeProject && (
                        <div className="max-w-xs">
                          <ProjectCard project={activeProject} isActive={true}
                            onFocus={() => {}}
                            onEdit={() => setEditProject(activeProject)} />
                        </div>
                      )}
                    </div>

                    {/* Info bar with Edit button */}
                    <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-white border border-neutral-200 shadow-sm">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0"><BarChart3 style={{ width: 18, height: 18 }} className="text-white" /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-neutral-800 truncate">{activeProject?.display_name}</p>
                          <p className="text-[11px] text-neutral-400 truncate">
                            {activeProject?.customer_name ?? "—"}
                            {activeProject?.po_number && <span className="ml-2 font-mono text-neutral-500">· {activeProject.po_number}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button type="button" onClick={() => activeProject && setEditProject(activeProject)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                          <Pencil className="h-3.5 w-3.5" /> Edit Proyek
                        </button>
                        {user.role === "ADMIN" && activeProject && (
                          <AdminDeleteProject
                            projectKey={activeProject.project_key}
                            projectName={activeProject.display_name}
                            onDeleted={() => {
                              setAllProjects(prev => prev.filter(p => p.project_key !== activeProject.project_key))
                              setActiveKey(null)
                              setBillingAlert(null)
                            }}
                          />
                        )}
                        <div className="text-right">
                          <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">Progres Fase</p>
                          <p className={`text-2xl font-black tabular-nums leading-none ${currentProgress >= 80 ? "text-emerald-600" : currentProgress >= 40 ? "text-indigo-600" : "text-amber-500"}`}>{currentProgress}%</p>
                        </div>
                        <div className="w-24 h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${currentProgress}%`, background: currentProgress >= 80 ? "#10b981" : currentProgress >= 40 ? "#6366f1" : "#f59e0b" }} />
                        </div>
                      </div>
                    </div>

                    {/* ── TOP Panel ── */}
                    {(() => {
                      const termins = activeProject?.termin_schedule ?? []
                      const contractVal = (activeProject?.po_value_manual ?? 0) +
                        (Array.isArray(activeProject?.vo_entries) ? (activeProject?.vo_entries ?? []).reduce((s: number, v: VOEntry) => s + (Number(v.nilai_po) || 0), 0) : (activeProject?.op_budget_vo ?? 0))
                      const effProgress = Math.max(currentProgress, activeProject?.physical_progress ?? 0)
                      return (
                        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                          <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 bg-neutral-50/60">
                            <div className="flex items-center gap-2">
                              <span className="h-6 w-10 rounded-md bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">TOP</span>
                              <p className="text-sm font-bold text-neutral-900">Terms of Payment</p>
                              <span className="text-[10px] text-neutral-400">{termins.length} termin · progres {effProgress}%</span>
                            </div>
                            <button type="button"
                              onClick={() => { setShowTopEditor(v => !v); setEditingTop(termins.map(t => ({ ...t }))) }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-[11px] font-bold text-neutral-600 hover:bg-neutral-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                              <Pencil className="h-3 w-3" /> Edit TOP
                            </button>
                          </div>

                          {termins.length === 0 ? (
                            <div className="px-5 py-8 text-center">
                              <p className="text-xs text-neutral-400 mb-2">Belum ada jadwal TOP untuk proyek ini.</p>
                              <button type="button" onClick={() => { setShowTopEditor(true); setEditingTop([]) }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors mx-auto">
                                <Plus className="h-3.5 w-3.5" /> Buat TOP Schedule
                              </button>
                            </div>
                          ) : (
                            <div className="divide-y divide-neutral-50">
                              {termins.map((t, i) => {
                                const inv = terminInvoices.find(x => x.termin_id === t.id)
                                const isEligible = effProgress >= t.target_progres
                                const isSent = inv && inv.status !== "TERKUNCI"
                                const isSending = sendingTermin === t.id
                                const estAmt = contractVal > 0 && t.persen_tagihan
                                  ? Math.round(contractVal * t.persen_tagihan / 100) : 0
                                const statusBg = isSent
                                  ? inv!.status === "LUNAS" ? "bg-emerald-50 border-emerald-200" : inv!.status === "PROSES_COLLECT" ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"
                                  : isEligible ? "bg-amber-50/50 border-amber-100" : "bg-neutral-50 border-neutral-100"
                                return (
                                  <div key={t.id} className={`flex items-start gap-4 px-5 py-4 border-b last:border-0 transition-colors ${statusBg}`}>
                                    <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-black mt-0.5 ${
                                      isSent && inv!.status === "LUNAS" ? "bg-emerald-500 text-white" :
                                      isSent && inv!.status === "PROSES_COLLECT" ? "bg-blue-500 text-white" :
                                      isSent ? "bg-amber-500 text-white" :
                                      isEligible ? "bg-amber-400 text-white" : "bg-neutral-200 text-neutral-500"
                                    }`}>{i + 1}</div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-neutral-800">{t.nama}</p>
                                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                        <span className="text-[10px] text-neutral-400">Trigger: ≥<strong className="text-neutral-600">{t.target_progres}%</strong></span>
                                        {t.persen_tagihan != null && <span className="text-[10px] text-neutral-400">Porsi: <strong className="text-neutral-600">{t.persen_tagihan}%</strong></span>}
                                        {estAmt > 0 && <span className="text-[10px] font-semibold text-neutral-600">≈ Rp {estAmt.toLocaleString("id-ID")}</span>}
                                      </div>
                                      {!isEligible && (
                                        <p className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1">
                                          <Lock className="h-3 w-3" /> Butuh {t.target_progres - effProgress}% lagi
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex-shrink-0 mt-0.5">
                                      {isSent ? (
                                        <span className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full border ${
                                          inv!.status === "LUNAS" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                          inv!.status === "PROSES_COLLECT" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                          "bg-amber-100 text-amber-700 border-amber-200"
                                        }`}>
                                          {inv!.status === "LUNAS" ? "✓ LUNAS" : inv!.status === "PROSES_COLLECT" ? "⏳ DITAGIH" : "⚡ SIAP TAGIH"}
                                        </span>
                                      ) : isEligible ? (
                                        <button type="button" disabled={isSending} onClick={() => sendTerminToFinance(t.id)}
                                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-600 disabled:opacity-60 transition-colors shadow-sm">
                                          {isSending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <span>🚀</span>}
                                          {isSending ? "Mengirim…" : "Kirim ke Finance"}
                                        </button>
                                      ) : (
                                        <span className="text-[10px] font-bold px-2.5 py-1.5 rounded-full bg-neutral-100 text-neutral-400 border border-neutral-200">🔒 TERKUNCI</span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Inline TOP Editor */}
                          {showTopEditor && (
                            <div className="border-t border-indigo-100 bg-indigo-50/20 p-5">
                              <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-4">Edit TOP Schedule</p>
                              <div className="flex flex-col gap-2.5 mb-4">
                                {editingTop.map((t, i) => (
                                  <div key={t.id} className="grid grid-cols-3 gap-2 items-center bg-white rounded-lg border border-neutral-200 p-3">
                                    <input className={INPUT_CLS} value={t.nama} placeholder={`Termin ${i+1}`}
                                      onChange={e => setEditingTop(prev => prev.map((x, j) => j === i ? { ...x, nama: e.target.value } : x))} />
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] text-neutral-400 whitespace-nowrap">Trigger %</span>
                                      <input type="text" inputMode="numeric" title="Trigger progres" placeholder="50"
                                        className="flex-1 text-xs rounded-lg border border-neutral-200 bg-white px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                        value={t.target_progres}
                                        onChange={e => setEditingTop(prev => prev.map((x, j) => j === i ? { ...x, target_progres: Number(e.target.value.replace(/\D/g,"")) || 0 } : x))} />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] text-neutral-400 whitespace-nowrap">Tagihan %</span>
                                      <input type="text" inputMode="numeric" title="Porsi tagihan" placeholder="30"
                                        className="flex-1 text-xs rounded-lg border border-neutral-200 bg-white px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                        value={t.persen_tagihan}
                                        onChange={e => setEditingTop(prev => prev.map((x, j) => j === i ? { ...x, persen_tagihan: Number(e.target.value.replace(/\D/g,"")) || 0 } : x))} />
                                      <button type="button" aria-label="Hapus termin" title="Hapus termin"
                                        onClick={() => setEditingTop(prev => prev.filter((_, j) => j !== i))}
                                        className="p-1.5 rounded text-neutral-300 hover:text-red-500 hover:bg-red-50">
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                <button type="button"
                                  onClick={() => setEditingTop(prev => [...prev, { id: `t_new_${Date.now()}`, nama: "", target_progres: 50, persen_tagihan: 30 }])}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-indigo-300 text-indigo-600 text-xs font-semibold hover:bg-indigo-50 transition-colors">
                                  <Plus className="h-3.5 w-3.5" /> Tambah Termin
                                </button>
                              </div>
                              {editingTop.length > 0 && (
                                <p className="text-[10px] text-neutral-400 mb-3">
                                  Total tagihan: <span className={`font-bold ${editingTop.reduce((s,t)=>s+t.persen_tagihan,0)===100?"text-emerald-600":"text-amber-600"}`}>
                                    {editingTop.reduce((s,t)=>s+t.persen_tagihan,0)}%
                                  </span>
                                </p>
                              )}
                              <div className="flex gap-2">
                                <button type="button" disabled={savingTop} onClick={() => saveTopSchedule(editingTop)}
                                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50">
                                  {savingTop ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Menyimpan…</> : <><Save className="h-3.5 w-3.5" /> Simpan TOP</>}
                                </button>
                                <button type="button" onClick={() => setShowTopEditor(false)}
                                  className="px-5 py-2.5 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Batal</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Billing alert */}
                    {billingAlert && billingAlert.length > 0 && (
                      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-emerald-700">Finance Terbuka — Siap Ditagih</p>
                          <p className="text-xs text-emerald-600 mt-0.5">Progress {currentProgress}% memenuhi syarat: <span className="font-semibold">{billingAlert.join(", ")}</span>.</p>
                        </div>
                        <button type="button" onClick={() => setBillingAlert(null)} title="Tutup notifikasi" aria-label="Tutup notifikasi" className="p-1 rounded hover:bg-emerald-100 text-emerald-400"><X className="h-3.5 w-3.5" /></button>
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
                        {/* ═══ JADWAL & RENCANA ═══════════════════════════════ */}
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
                                    value={phaseTask} onChange={e => setPhaseTask(e.target.value)} placeholder="Contoh: Pondasi, Instalasi Panel…" required />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Mulai (W)</label>
                                  <select title="Pilih minggu mulai" className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                    value={phaseStartW} onChange={e => { const v = Number(e.target.value); setPhaseStartW(v); if (phaseEndW < v) setPhaseEndW(v) }}>
                                    {Array.from({ length: 48 }, (_, i) => i + 1).map(w => <option key={w} value={w}>{weekToLabel(w)}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Selesai (W)</label>
                                  <select title="Pilih minggu selesai" className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                    value={phaseEndW} onChange={e => setPhaseEndW(Number(e.target.value))}>
                                    {Array.from({ length: 48 }, (_, i) => i + 1).filter(w => w >= phaseStartW).map(w => <option key={w} value={w}>{weekToLabel(w)}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 mb-4">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Bobot Progress (%)</label>
                                <input type="text" inputMode="numeric" pattern="[0-9]*"
                                  title="Bobot progress fase (%)" placeholder="10"
                                  className="w-20 text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                  value={phaseWeight} onChange={e => setPhaseWeight(e.target.value.replace(/\D/g, ""))} />
                                <p className="text-[10px] text-neutral-400">Total semua fase idealnya = 100%</p>
                              </div>
                              <div className="flex gap-2">
                                <button type="submit" disabled={addingPhase || !phaseTask.trim()} className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                                  {addingPhase ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Menyimpan…</> : <><Plus className="h-3.5 w-3.5" /> Tambah Fase</>}
                                </button>
                                <button type="button" onClick={() => { setShowAddPhase(false); setPhaseTask(""); setPhaseStartW(1); setPhaseEndW(1); setPhaseWeight("10") }}
                                  className="px-5 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Batal</button>
                              </div>
                            </form>
                          )}

                          {phases.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-14 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50">
                              <p className="text-sm text-neutral-400 mb-1 font-medium">Belum ada fase dijadwalkan</p>
                              <p className="text-xs text-neutral-300">Klik &ldquo;Tambah Fase&rdquo; untuk mulai membangun timeline {GANTT_YEAR}.</p>
                            </div>
                          ) : (
                            <div className="rounded-xl overflow-hidden border border-neutral-200 bg-white shadow-sm">
                              <div className="flex">
                                <div className="w-52 flex-shrink-0 border-r border-neutral-200">
                                  <div className="px-4 bg-neutral-50 border-b border-neutral-200" style={{ height: 58 }}>
                                    <div className="flex items-center h-full"><span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Fase Proyek</span></div>
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
                                        <span className="text-xs min-w-0 flex-1 truncate font-medium" title={ph.task_description} style={{ color: ph.is_done ? "#9ca3af" : "#374151", textDecoration: ph.is_done ? "line-through" : "none" }}>{ph.task_description}</span>
                                        <div className="flex-shrink-0 flex items-center gap-1">
                                          {hasBell && <span title="Milestone termin"><Bell className="h-3 w-3 text-amber-400" /></span>}
                                          <button type="button" title="Hapus fase" aria-label="Hapus fase" onClick={() => deletePhase(ph.id)} className="opacity-0 group-hover/row:opacity-100 transition-opacity text-neutral-300 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
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
                                      const hasBell = hasTerminBell(ph.id, phases, activeProject?.termin_schedule ?? [])
                                      const barLeft  = (startW - 1) * COL_W + 4
                                      const barWidth = (endW - startW + 1) * COL_W - 8
                                      const lblLeft  = barLeft + barWidth + 6
                                      return (
                                        <div key={ph.id} className="relative border-b border-neutral-100" style={{ minHeight: 48, width: totalWeeks * COL_W }}>
                                          <div className="absolute inset-0 flex pointer-events-none">{weekArr.map(w => <div key={w} className="flex-shrink-0 h-full border-r border-neutral-50" style={{ width: COL_W }} />)}</div>
                                          <div className="absolute flex items-center gap-1.5 rounded-full px-3 shadow-sm overflow-hidden transition-all duration-300"
                                            style={{ left: barLeft, width: barWidth, height: 28, top: "50%", transform: "translateY(-50%)", background: ph.is_done ? c.done : c.bg, color: c.text, zIndex: 1, border: `1px solid ${ph.is_done ? "transparent" : c.border}` }}>
                                            {hasBell && <Bell className="h-3 w-3 text-amber-400 flex-shrink-0" />}
                                            {ph.is_done && <CheckCheck className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "#fff" }} />}
                                            <span className="text-[10px] font-bold tabular-nums whitespace-nowrap" style={{ color: ph.is_done ? "#fff" : c.text }}>{ph.progress_weight}%</span>
                                          </div>
                                          {lblLeft < totalWeeks * COL_W - 24 && (
                                            <div className="absolute text-[10px] font-medium text-neutral-400 whitespace-nowrap overflow-hidden" style={{ left: lblLeft, top: "50%", transform: "translateY(-50%)", maxWidth: totalWeeks * COL_W - lblLeft - 4 }}>{ph.task_description}</div>
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

                        {/* ═══ LOG MINGGUAN (MONTHLY AGGREGATION) ════════════ */}
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
                                    <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-neutral-100">
                                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: c.done }} />
                                      <span className="text-xs font-bold text-neutral-800">{ph.task_description}</span>
                                      <span className="text-[10px] text-neutral-400">{weekToLabel(ph.week_number)} → {weekToLabel(ph.end_week || ph.week_number)}</span>
                                      <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full ${ph.is_done ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-neutral-100 text-neutral-500 border border-neutral-200"}`}>{ph.is_done ? "✓ Selesai" : `${ph.progress_weight}% bobot`}</span>
                                      <button type="button" onClick={() => { setAddLogPhaseId(addLogPhaseId === ph.id ? null : ph.id); setAddLogWeek(ph.week_number); setAddLogDesc(""); setAddLogPhoto(null) }}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-bold hover:bg-indigo-100 transition-colors flex-shrink-0">
                                        <Plus className="h-3 w-3" /> Tambah Log
                                      </button>
                                    </div>

                                    {/* Add log form */}
                                    {addLogPhaseId === ph.id && (
                                      <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
                                        <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-3">Entri Log Baru</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                          <div>
                                            <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Minggu ke-</label>
                                            <input type="text" inputMode="numeric" pattern="[0-9]*"
                                              className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                              value={addLogWeek} onChange={e => setAddLogWeek(Number(e.target.value.replace(/\D/g, "")) || 1)} />
                                            <p className="text-[9px] text-neutral-400 mt-1">{weekToLabel(addLogWeek)}</p>
                                          </div>
                                          <div className="sm:col-span-2">
                                            <label className="text-[10px] font-bold text-neutral-500 mb-1.5 block uppercase tracking-wider">Deskripsi Pekerjaan</label>
                                            <textarea className="w-full text-xs rounded-lg border border-neutral-200 bg-white px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" style={{ minHeight: 68 }} value={addLogDesc} onChange={e => setAddLogDesc(e.target.value)} placeholder="Apa yang dikerjakan minggu ini…" />
                                          </div>
                                        </div>
                                        <div className="mb-4">
                                          <label className="text-[10px] font-bold text-neutral-500 mb-1.5 flex items-center gap-1 uppercase tracking-wider"><Camera className="h-3 w-3" /> Foto Lapangan (opsional)</label>
                                          <input type="file" accept="image/*" title="Upload foto" className="w-full text-xs text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" onChange={e => setAddLogPhoto(e.target.files?.[0] ?? null)} />
                                        </div>
                                        <div className="flex gap-2">
                                          <button type="button" disabled={addingLog || !addLogDesc.trim()} onClick={() => handleAddLog(ph.id)}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50">
                                            {addingLog ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Menyimpan…</> : <><Save className="h-3.5 w-3.5" /> Simpan Log</>}
                                          </button>
                                          <button type="button" onClick={() => setAddLogPhaseId(null)} className="px-4 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Batal</button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Monthly groups */}
                                    <div className="flex flex-col gap-4">
                                      {monthSlots.map(moIdx => {
                                        const moLogs   = phaseLogs.filter(l => weekToMonthIdx(l.week_number) === moIdx)
                                        const moFilled = moLogs.filter(l => l.description.trim() || l.photo_url).length
                                        return (
                                          <div key={moIdx}>
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-100 mb-2">
                                              <span className="text-xs font-bold text-neutral-700">{monthIdxToLabel(moIdx)}</span>
                                              <span className="text-[10px] text-neutral-400">{moFilled > 0 ? `${moFilled} entri terisi` : "Belum ada entri"}</span>
                                              <div className="ml-auto h-1 w-20 rounded-full bg-neutral-200 overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: moLogs.length > 0 ? `${(moFilled / moLogs.length) * 100}%` : "0%", background: c.done }} />
                                              </div>
                                            </div>
                                            {moLogs.length === 0 ? (
                                              <p className="text-xs text-neutral-300 italic pl-3 py-1.5">Belum ada log untuk {monthIdxToLabel(moIdx)} — klik &ldquo;Tambah Log&rdquo; di atas.</p>
                                            ) : (
                                              <div className="rounded-xl border border-neutral-100 overflow-hidden">
                                                {moLogs.map(log => {
                                                  const isFilled  = Boolean(log.description.trim() || log.photo_url)
                                                  const isEditing = editingLogId === log.id
                                                  return (
                                                    <div key={log.id}>
                                                      <div className="group flex items-start gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 hover:bg-neutral-50/60 transition-colors">
                                                        <span className="text-[9px] font-black px-2 py-1 rounded-md mt-0.5 whitespace-nowrap flex-shrink-0" style={{ background: c.bg, color: c.text }}>{weekToLabel(log.week_number)}</span>
                                                        <div className="flex-1 min-w-0">
                                                          {isFilled ? (
                                                            <>
                                                              <p className="text-xs text-neutral-700 leading-relaxed line-clamp-2">{log.description}</p>
                                                              <div className="flex items-center gap-3 mt-1.5">
                                                                {log.photo_url && <a href={log.photo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-indigo-500 hover:underline"><Camera className="h-2.5 w-2.5" /> Foto</a>}
                                                                <span className="text-[9px] text-neutral-400 tabular-nums">{log.progress_pct}% progres</span>
                                                              </div>
                                                            </>
                                                          ) : (
                                                            <p className="text-xs text-neutral-300 italic">Kosong — belum diisi</p>
                                                          )}
                                                        </div>
                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                          <button type="button" title="Edit log" aria-label="Edit log" onClick={() => setEditingLogId(isEditing ? null : log.id)} className={`p-1.5 rounded-lg transition-colors ${isEditing ? "bg-indigo-100 text-indigo-600" : "hover:bg-neutral-100 text-neutral-400 hover:text-indigo-600"}`}><Pencil className="h-3 w-3" /></button>
                                                          <button type="button" title="Hapus log" aria-label="Hapus log" onClick={() => deleteLog(log.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-300 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
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
            </>
          )}
        </div>

        {editProject && <EditProjectModal project={editProject} onSave={handleSaveEdit} onClose={() => setEditProject(null)} />}
      </SidebarInset>
    </SidebarProvider>
  )
}
