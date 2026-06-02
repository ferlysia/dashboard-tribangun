"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar }  from "@/components/app-sidebar"
import { SiteHeader }  from "@/components/site-header"
import { Toaster }     from "@/components/ui/sonner"
import { toast }       from "sonner"
import {
  Save, Plus, Trash2, RefreshCw, FolderOpen, BarChart3,
  ExternalLink, CheckCircle2, TrendingUp, TrendingDown,
  Minus, Lock, Bell, ChevronLeft, ChevronDown, ChevronRight,
  Camera, CheckCheck,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingPhase = {
  tempId: string; task_description: string
  week_number: number; end_week: number; progress_weight: number
}

type PendingTermin = {
  tempId: string; termin_name: string
  required_progress_trigger: number; billing_percentage: number
}

type VOEntry = { id: string; po_number: string; description: string; nilai_po: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const GANTT_YEAR = 2026
const MONTHS_ID  = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]
const PILL       = [
  { bg: "#dbeafe", text: "#1e40af", done: "#3b82f6", border: "#bfdbfe" },
  { bg: "#d1fae5", text: "#065f46", done: "#10b981", border: "#a7f3d0" },
  { bg: "#fce7f3", text: "#831843", done: "#ec4899", border: "#fbcfe8" },
  { bg: "#ede9fe", text: "#4c1d95", done: "#8b5cf6", border: "#ddd6fe" },
  { bg: "#fef3c7", text: "#78350f", done: "#f59e0b", border: "#fde68a" },
]

const BUDGET_STREAMS: { key: string; label: string; voKey: string }[] = [
  { key: "gaji",        label: "Gaji & Tunjangan",    voKey: "vo_gaji"        },
  { key: "material",    label: "Material / Bahan",     voKey: "vo_material"    },
  { key: "transport",   label: "Transport & Logistik", voKey: "vo_transport"   },
  { key: "operasional", label: "Biaya Operasional",    voKey: "vo_operasional" },
  { key: "sewa",        label: "Sewa & Utilitas",      voKey: "vo_sewa"        },
  { key: "lainnya",     label: "Biaya Lainnya",        voKey: "vo_lainnya"     },
]

const INPUT_CLS = "w-full text-xs rounded-lg border border-border bg-background text-foreground px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekToLabel(w: number): string {
  const totalMo = Math.floor((w - 1) / 4)
  const wInMo   = ((w - 1) % 4) + 1
  const year    = GANTT_YEAR + Math.floor(totalMo / 12)
  return `${MONTHS_ID[totalMo % 12]} '${String(year).slice(2)} W${wInMo}`
}

function fmtRpInput(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""
  return parseInt(digits, 10).toLocaleString("id-ID")
}

function parseRpInput(str: string): number {
  return parseInt(str.replace(/[^0-9]/g, ""), 10) || 0
}

function fShort(n: number): string {
  const abs  = Math.abs(n)
  const sign = n < 0 ? "−" : ""
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000)     return `${sign}${(abs / 1_000_000).toFixed(1)}Jt`
  if (abs >= 1_000)         return `${sign}${(abs / 1_000).toFixed(0)}Rb`
  return `${sign}${Math.round(abs)}`
}

function genKey(name: string): string {
  const base = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 28)
  return `${base}-${Date.now()}`
}

function marginTier(m: number): { label: string; accent: string; bg: string; text: string; ring: string } {
  if (m >= 15) return { label: "AMAN",    accent: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/40",  text: "text-emerald-700 dark:text-emerald-400", ring: "ring-emerald-200 dark:ring-emerald-800" }
  if (m >= 5)  return { label: "WASPADA", accent: "bg-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/40",      text: "text-amber-700 dark:text-amber-400",     ring: "ring-amber-200 dark:ring-amber-800"     }
  if (m >= 0)  return { label: "KRITIS",  accent: "bg-orange-400",  bg: "bg-orange-50 dark:bg-orange-950/40",    text: "text-orange-700 dark:text-orange-400",   ring: "ring-orange-200 dark:ring-orange-800"   }
  return              { label: "RUGI",    accent: "bg-red-500",     bg: "bg-red-50 dark:bg-red-950/40",          text: "text-red-700 dark:text-red-400",         ring: "ring-red-200 dark:ring-red-800"         }
}

// ─── Bos View Live Preview Card ───────────────────────────────────────────────

interface BosViewPreviewProps {
  displayName:  string
  customerName: string
  status:       string
  progress:     number
  contractVal:  number
  totalBudget:  number
  terminCount:  number
  phaseCount:   number
  dueDate:      string
}

function BosViewPreviewCard(p: BosViewPreviewProps) {
  const mt         = marginTier(p.contractVal > 0 ? ((p.contractVal - p.totalBudget) / p.contractVal) * 100 : 0)
  const netProfit  = p.contractVal - p.totalBudget
  const netMargin  = p.contractVal > 0 ? ((p.contractVal - p.totalBudget) / p.contractVal) * 100 : 0
  const progAccent = p.progress >= 80 ? "bg-emerald-500" : p.progress >= 40 ? "bg-indigo-500" : "bg-amber-400"
  const progText   = p.progress >= 80 ? "text-emerald-600 dark:text-emerald-400" : p.progress >= 40 ? "text-indigo-600 dark:text-indigo-400" : "text-amber-500"
  const ProfitIcon = netProfit > 0 ? TrendingUp : netProfit < 0 ? TrendingDown : Minus
  const profitText = netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"

  const daysLeft = p.dueDate
    ? Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / 86_400_000)
    : null

  const isEmpty = !p.displayName.trim()

  return (
    <div className={`
      relative flex flex-col bg-card rounded-2xl border border-border
      overflow-hidden shadow-md transition-all duration-300
      ring-1 ${mt.ring}
    `}>
      {/* Left margin safety accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${mt.accent} transition-all duration-500`} />

      {/* Live badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted border border-border text-[9px] font-bold text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        LIVE PREVIEW
      </div>

      {/* Header */}
      <div className="pl-5 pr-14 pt-4 pb-3 border-b border-border">
        <div className="flex items-start gap-2 mb-1.5">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
            p.status === "SELESAI" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
            p.status === "DITUNDA" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
            "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
          }`}>
            {p.status || "BERJALAN"}
          </span>
          {daysLeft !== null && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
              daysLeft < 0  ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800" :
              daysLeft <= 14 ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" :
              "bg-neutral-50 text-neutral-400 border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700"
            }`}>
              📅 {daysLeft < 0 ? `Terlambat ${Math.abs(daysLeft)}h` : `Due ${daysLeft}h`}
            </span>
          )}
        </div>
        <h3 className={`text-sm font-bold leading-snug mb-0.5 ${isEmpty ? "text-muted-foreground italic" : "text-foreground"}`}>
          {isEmpty ? "Nama proyek akan tampil di sini…" : p.displayName}
        </h3>
        <p className="text-[11px] text-muted-foreground truncate">{p.customerName || "—"}</p>
      </div>

      {/* Three Pillars */}
      <div className="pl-5 pr-4 pt-3.5 pb-4 flex flex-col gap-3.5 flex-1">

        {/* Pillar 1 — Progress (Doc Con) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Progres Fisik</span>
            <span className={`text-xs font-black tabular-nums ${progText}`}>{p.progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${progAccent}`} style={{ width: `${Math.min(100, p.progress)}%` }} />
          </div>
          {p.phaseCount > 0 && (
            <p className="text-[9px] text-muted-foreground mt-1">{p.phaseCount} fase dijadwalkan</p>
          )}
        </div>

        {/* Pillar 2 — Profitability (Cost Control) */}
        <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${mt.bg}`}>
          <div>
            <p className={`text-[9px] font-black uppercase tracking-widest ${mt.text} opacity-70`}>Net Margin</p>
            {p.contractVal > 0 && (
              <p className={`text-[9px] ${mt.text} opacity-60 tabular-nums`}>
                {fShort(p.contractVal)} → {fShort(p.totalBudget)}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className={`text-xl font-black tabular-nums leading-none ${mt.text}`}>
              {netMargin >= 0 ? "+" : ""}{netMargin.toFixed(1)}%
            </p>
            {p.contractVal > 0 && (
              <p className={`text-[10px] tabular-nums font-semibold ${profitText} flex items-center justify-end gap-0.5 mt-0.5`}>
                <ProfitIcon className="h-2.5 w-2.5" />
                {fShort(netProfit)}
              </p>
            )}
          </div>
        </div>

        {/* Pillar 3 — Finance (termin) */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Status Tagihan</span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400">
            <Lock className="h-3 w-3" /> TERKUNCI
          </span>
        </div>

        {p.terminCount > 0 && (
          <p className="text-[10px] text-muted-foreground font-medium -mt-1">
            ↳ {p.terminCount} termin pembayaran dijadwalkan
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="pl-5 pr-4 pb-3 flex items-center justify-between border-t border-border pt-2.5">
        <span className="text-[9px] text-muted-foreground">Preview — belum disimpan</span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${mt.bg} ${mt.text}`}>{mt.label}</span>
      </div>
    </div>
  )
}

// ─── FormField ────────────────────────────────────────────────────────────────

function FormField({ label, icon, note, required, children }: {
  label: string; icon?: string; note?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">
        {icon && <span className="text-sm">{icon}</span>}{label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {note && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">{note}</p>}
    </div>
  )
}

// ─── Section Accordion ────────────────────────────────────────────────────────

function SectionHeader({
  title, subtitle, accent, open, onToggle, badge,
}: {
  title: string; subtitle: string; accent: string; open: boolean; onToggle: () => void; badge?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${open ? "rounded-t-2xl" : "rounded-2xl"} border border-border bg-card hover:bg-muted/60`}
    >
      <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        {open ? <ChevronDown className="h-4 w-4 text-white" /> : <ChevronRight className="h-4 w-4 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {badge}
    </button>
  )
}

// ─── Progress Quick-Pick ──────────────────────────────────────────────────────

const PROG_PRESETS = [0, 10, 25, 50, 75, 90, 100]

function ProgressInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = React.useState(String(value))
  React.useEffect(() => { setRaw(String(value)) }, [value])
  const clamp = (n: number) => Math.min(100, Math.max(0, n))
  const color  = value >= 80 ? "#10b981" : value >= 40 ? "#6366f1" : "#f59e0b"
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <input type="number" min={0} max={100} value={raw}
          title="Persentase progres" aria-label="Persentase progres"
          className="w-20 text-center font-black text-lg rounded-lg border border-border bg-background py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          style={{ color }}
          onChange={e => { setRaw(e.target.value); const n = parseInt(e.target.value, 10); if (!isNaN(n)) onChange(clamp(n)) }}
          onBlur={() => { const n = parseInt(raw, 10); const c = isNaN(n) ? 0 : clamp(n); onChange(c); setRaw(String(c)) }}
        />
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
        </div>
        <span className="text-xs font-black tabular-nums w-8 text-right flex-shrink-0" style={{ color }}>{value}%</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {PROG_PRESETS.map(preset => (
          <button key={preset} type="button" onClick={() => { onChange(preset); setRaw(String(preset)) }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${value === preset ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {preset}%
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Currency Budget Input ────────────────────────────────────────────────────

function BudgetInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">Rp</span>
        <input
          inputMode="numeric"
          title={label}
          className={`${INPUT_CLS} pl-8`}
          value={value}
          onChange={e => onChange(fmtRpInput(e.target.value))}
          placeholder="0"
        />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const router = useRouter()

  // ── Doc Con form fields ────────────────────────────────────────────────────
  const [form, setForm] = React.useState({
    display_name: "", customer_name: "", site_location: "", pic_name: "",
    po_number: "", po_value_manual: "", onedrive_folder_url: "",
    project_status: "BERJALAN", physical_progress: 0,
    description: "", notes: "", due_date: "",
  })
  function sf<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm(p => ({ ...p, [k]: v })) }

  // ── Phases ─────────────────────────────────────────────────────────────────
  const [pendingPhases,  setPendingPhases]  = React.useState<PendingPhase[]>([])
  const [showPhaseForm,  setShowPhaseForm]  = React.useState(false)
  const [phTask,         setPhTask]         = React.useState("")
  const [phStartW,       setPhStartW]       = React.useState(1)
  const [phEndW,         setPhEndW]         = React.useState(1)
  const [phWeight,       setPhWeight]       = React.useState("10")

  // ── Terms of Payment ───────────────────────────────────────────────────────
  const [pendingTermins, setPendingTermins] = React.useState<PendingTermin[]>([])
  const [showTerminForm, setShowTerminForm] = React.useState(false)
  const [tName,          setTName]          = React.useState("")
  const [tTrigger,       setTTrigger]       = React.useState("50")
  const [tBillingPct,    setTBillingPct]    = React.useState("30")

  // ── VO Entries ─────────────────────────────────────────────────────────────
  const [pendingVOs, setPendingVOs] = React.useState<VOEntry[]>([])

  // ── Cost Control budget fields ─────────────────────────────────────────────
  const [budget, setBudget] = React.useState<Record<string, string>>({
    gaji: "", material: "", transport: "", operasional: "", sewa: "", lainnya: "",
    vo_gaji: "", vo_material: "", vo_transport: "", vo_operasional: "", vo_sewa: "", vo_lainnya: "",
  })
  function sb(k: string, v: string) { setBudget(p => ({ ...p, [k]: v })) }

  // ── Section open/close ─────────────────────────────────────────────────────
  const [openSection, setOpenSection] = React.useState<"doccon" | "cc" | "finance" | null>("doccon")
  function toggleSection(s: "doccon" | "cc" | "finance") {
    setOpenSection(prev => prev === s ? null : s)
  }

  const [saving, setSaving] = React.useState(false)

  // ── Derived preview values ─────────────────────────────────────────────────
  const poValue    = parseRpInput(form.po_value_manual)
  const voTotal    = pendingVOs.reduce((s, v) => s + (Number(v.nilai_po) || 0), 0)
  const contractVal = poValue + voTotal
  const totalBudget = Object.values(budget).reduce((s, v) => s + parseRpInput(v), 0)
  const totalPendingWeight = pendingPhases.reduce((s, p) => s + p.progress_weight, 0)
  const totalTerminPct     = pendingTermins.reduce((s, t) => s + t.billing_percentage, 0)

  // ── Phase helpers ──────────────────────────────────────────────────────────
  function addPendingPhase() {
    if (!phTask.trim()) return
    setPendingPhases(prev => [...prev, {
      tempId: `tmp_${Date.now()}`, task_description: phTask.trim(),
      week_number: phStartW, end_week: phEndW, progress_weight: Number(phWeight) || 10,
    }])
    setPhTask(""); setPhStartW(1); setPhEndW(1); setPhWeight("10"); setShowPhaseForm(false)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.display_name.trim()) { toast.error("Nama proyek wajib diisi"); return }
    setSaving(true)
    try {
      const key = genKey(form.display_name)
      const payload = {
        display_name:       form.display_name,
        customer_name:      form.customer_name  || null,
        site_location:      form.site_location  || null,
        pic_name:           form.pic_name       || null,
        po_number:          form.po_number      || null,
        po_value_manual:    parseRpInput(form.po_value_manual),
        onedrive_folder_url: form.onedrive_folder_url || null,
        project_status:     form.project_status,
        physical_progress:  form.physical_progress,
        description:        form.description    || null,
        notes:              form.notes          || null,
        due_date:           form.due_date       || null,
        created_manually:   true,
        // Cost Control budget
        op_gaji:        parseRpInput(budget.gaji),
        op_material:    parseRpInput(budget.material),
        op_transport:   parseRpInput(budget.transport),
        op_operasional: parseRpInput(budget.operasional),
        op_sewa:        parseRpInput(budget.sewa),
        op_lainnya:     parseRpInput(budget.lainnya),
        op_vo_gaji:        parseRpInput(budget.vo_gaji),
        op_vo_material:    parseRpInput(budget.vo_material),
        op_vo_transport:   parseRpInput(budget.vo_transport),
        op_vo_operasional: parseRpInput(budget.vo_operasional),
        op_vo_sewa:        parseRpInput(budget.vo_sewa),
        op_vo_lainnya:     parseRpInput(budget.vo_lainnya),
        // Finance
        termin_schedule: pendingTermins.map((t, i) => ({
          id: `t_${Date.now()}_${i}`, nama: t.termin_name,
          target_progres: t.required_progress_trigger, persen_tagihan: t.billing_percentage,
        })),
        vo_entries:  pendingVOs,
        op_budget_vo: voTotal,
      }

      const res = await fetch(`/api/project-details/${encodeURIComponent(key)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Gagal membuat proyek")

      for (const ph of pendingPhases) {
        await fetch(`/api/project-schedule/${encodeURIComponent(key)}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ week_number: ph.week_number, end_week: ph.end_week, task_description: ph.task_description, progress_weight: ph.progress_weight }),
        }).catch(() => {})
      }

      toast.success("Proyek berhasil dibuat! Mengalihkan ke workspace…")
      setTimeout(() => router.push("/dashboard/doc-con"), 1800)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full px-6 py-8 flex flex-col gap-8">

            {/* Page header */}
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => router.back()}
                className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" /> Kembali
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-black text-foreground tracking-tight">Buat Proyek Baru</h1>
                <p className="text-[11px] text-muted-foreground mt-0.5">Preview terupdate langsung — 3 divisi dalam satu sesi.</p>
              </div>
              <button type="submit" form="new-proj-form" disabled={saving || !form.display_name.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-200 dark:shadow-none flex-shrink-0">
                {saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Membuat…</> : <><Save className="h-4 w-4" /> Buat Proyek</>}
              </button>
            </div>

            {/* ─── BOS VIEW LIVE PREVIEW ─── */}
            <section>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                Bos View — Live Preview
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BosViewPreviewCard
                  displayName={form.display_name}
                  customerName={form.customer_name}
                  status={form.project_status}
                  progress={form.physical_progress}
                  contractVal={contractVal}
                  totalBudget={totalBudget}
                  terminCount={pendingTermins.length}
                  phaseCount={pendingPhases.length}
                  dueDate={form.due_date}
                />
                {/* KPI strip alongside */}
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ringkasan Kontrak</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Nilai PO</p>
                        <p className="text-sm font-black text-foreground tabular-nums">{contractVal > 0 ? `Rp ${contractVal.toLocaleString("id-ID")}` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Total Budget</p>
                        <p className="text-sm font-black text-foreground tabular-nums">{totalBudget > 0 ? `Rp ${totalBudget.toLocaleString("id-ID")}` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Net Profit</p>
                        <p className={`text-sm font-black tabular-nums ${contractVal - totalBudget >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                          {contractVal > 0 ? `${contractVal - totalBudget >= 0 ? "+" : ""}Rp ${(contractVal - totalBudget).toLocaleString("id-ID")}` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Net Margin</p>
                        <p className={`text-sm font-black tabular-nums ${contractVal > 0 && ((contractVal - totalBudget) / contractVal) * 100 >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                          {contractVal > 0 ? `${(((contractVal - totalBudget) / contractVal) * 100).toFixed(1)}%` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Struktur</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className={`text-xl font-black ${totalPendingWeight > 100 ? "text-red-500" : totalPendingWeight === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>{pendingPhases.length}</p>
                        <p className="text-[9px] text-muted-foreground">Fase</p>
                      </div>
                      <div>
                        <p className={`text-xl font-black ${totalTerminPct > 100 ? "text-red-500" : totalTerminPct === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>{pendingTermins.length}</p>
                        <p className="text-[9px] text-muted-foreground">Termin</p>
                      </div>
                      <div>
                        <p className="text-xl font-black text-foreground">{pendingVOs.length}</p>
                        <p className="text-[9px] text-muted-foreground">VO</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ─── UNIFIED FORM ─── */}
            <form id="new-proj-form" onSubmit={handleCreate} className="flex flex-col gap-4">

              {/* ══════════════════════════════════════════════════════════════ */}
              {/* DIVISION 1: DOC CON                                          */}
              {/* ══════════════════════════════════════════════════════════════ */}
              <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
                <SectionHeader
                  title="Document Control (Doc Con)"
                  subtitle="Identitas proyek, kontrak, jadwal, dan log"
                  accent="bg-indigo-600"
                  open={openSection === "doccon"}
                  onToggle={() => toggleSection("doccon")}
                  badge={
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 flex-shrink-0">
                      DIV 1
                    </span>
                  }
                />

                {openSection === "doccon" && (
                  <div className="border-t border-border bg-card px-6 py-6 flex flex-col gap-6">

                    {/* Identitas */}
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-4">Identitas & Kontrak</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        <FormField label="Penanggung Jawab" icon="🧑‍💼">
                          <input className={INPUT_CLS} value={form.pic_name} onChange={e => sf("pic_name", e.target.value)} placeholder="Nama PIC lapangan" />
                        </FormField>
                        <FormField label="Site / Lokasi" icon="📍">
                          <input className={INPUT_CLS} value={form.site_location} onChange={e => sf("site_location", e.target.value)} placeholder="Contoh: Banjarmasin Centrum 30kW" />
                        </FormField>
                        <FormField label="Nomor PO Utama" icon="📜">
                          <input className={INPUT_CLS} value={form.po_number} onChange={e => sf("po_number", e.target.value)} placeholder="12345/TB-CENTRUM" />
                        </FormField>
                        <FormField label="Nilai PO / Kontrak (Rp)" note="Ketik angka — format otomatis">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">Rp</span>
                            <input className={`${INPUT_CLS} pl-8`} inputMode="numeric" title="Nilai PO"
                              value={form.po_value_manual} onChange={e => sf("po_value_manual", fmtRpInput(e.target.value))} placeholder="0" />
                          </div>
                        </FormField>
                        <FormField label="Link Folder OneDrive">
                          <div className="relative">
                            <input type="url" className={INPUT_CLS} value={form.onedrive_folder_url}
                              onChange={e => sf("onedrive_folder_url", e.target.value)} placeholder="https://onedrive.live.com/…" />
                            {form.onedrive_folder_url && (
                              <a href={form.onedrive_folder_url} target="_blank" rel="noopener noreferrer"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500"><ExternalLink className="h-3.5 w-3.5" /></a>
                            )}
                          </div>
                        </FormField>
                        <FormField label="Status Awal">
                          <select className={INPUT_CLS} title="Status proyek" aria-label="Status proyek"
                            value={form.project_status} onChange={e => sf("project_status", e.target.value)}>
                            <option value="BERJALAN">BERJALAN</option>
                            <option value="DITUNDA">DITUNDA</option>
                          </select>
                        </FormField>
                        <FormField label="Due Date" icon="📅">
                          <input type="date" className={INPUT_CLS} title="Target tanggal selesai"
                            value={form.due_date} onChange={e => sf("due_date", e.target.value)} />
                        </FormField>
                        <div className="sm:col-span-2">
                          <FormField label="Progres Fisik Awal (%)">
                            <ProgressInput value={form.physical_progress} onChange={v => sf("physical_progress", v)} />
                          </FormField>
                        </div>
                        <div className="sm:col-span-2">
                          <FormField label="Deskripsi Pekerjaan">
                            <textarea className={`${INPUT_CLS} resize-none`} style={{ minHeight: 80 }}
                              value={form.description} onChange={e => sf("description", e.target.value)}
                              placeholder="Lingkup pekerjaan secara singkat…" />
                          </FormField>
                        </div>
                        <div className="sm:col-span-2">
                          <FormField label="Catatan Internal">
                            <textarea className={`${INPUT_CLS} resize-none`} style={{ minHeight: 60 }}
                              value={form.notes} onChange={e => sf("notes", e.target.value)}
                              placeholder="Catatan khusus tim internal…" />
                          </FormField>
                        </div>
                      </div>
                    </div>

                    {/* Jadwal & Rencana */}
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-indigo-500" />
                          <p className="text-xs font-bold text-foreground">Jadwal &amp; Rencana — {GANTT_YEAR}</p>
                          {pendingPhases.length > 0 && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              totalPendingWeight === 100 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
                              totalPendingWeight > 100  ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" :
                              "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            }`}>
                              {totalPendingWeight}%{totalPendingWeight === 100 ? " ✓" : ""}
                            </span>
                          )}
                        </div>
                        <button type="button" onClick={() => setShowPhaseForm(v => !v)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                          <Plus className="h-3 w-3" /> Tambah Fase
                        </button>
                      </div>

                      {showPhaseForm && (
                        <div className="px-4 py-4 border-b border-border bg-indigo-50/30 dark:bg-indigo-950/20">
                          <div className="grid gap-3 sm:grid-cols-4 mb-3">
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Nama Fase</label>
                              <input className={INPUT_CLS} value={phTask} onChange={e => setPhTask(e.target.value)} placeholder="Pondasi, Instalasi Panel…" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Mulai (W)</label>
                              <select title="Minggu mulai" className={INPUT_CLS} value={phStartW}
                                onChange={e => { const v = Number(e.target.value); setPhStartW(v); if (phEndW < v) setPhEndW(v) }}>
                                {Array.from({ length: 48 }, (_, i) => i + 1).map(w => <option key={w} value={w}>{weekToLabel(w)}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Selesai (W)</label>
                              <select title="Minggu selesai" className={INPUT_CLS} value={phEndW}
                                onChange={e => setPhEndW(Number(e.target.value))}>
                                {Array.from({ length: 48 }, (_, i) => i + 1).filter(w => w >= phStartW).map(w => <option key={w} value={w}>{weekToLabel(w)}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mb-3">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Bobot (%)</label>
                            <input type="text" inputMode="numeric" pattern="[0-9]*" title="Bobot fase" placeholder="10"
                              className="w-20 text-xs rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                              value={phWeight} onChange={e => setPhWeight(e.target.value.replace(/\D/g, ""))} />
                            {pendingPhases.length > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                Total setelah ini: <span className={`font-bold ${totalPendingWeight + (Number(phWeight) || 0) > 100 ? "text-red-500" : "text-foreground"}`}>
                                  {totalPendingWeight + (Number(phWeight) || 0)}%
                                </span>
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button type="button" disabled={!phTask.trim()} onClick={addPendingPhase}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                              <Plus className="h-3.5 w-3.5" /> Tambah
                            </button>
                            <button type="button" onClick={() => { setShowPhaseForm(false); setPhTask("") }}
                              className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">Batal</button>
                          </div>
                        </div>
                      )}

                      {pendingPhases.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <p className="text-xs text-muted-foreground">Belum ada fase — opsional, dapat ditambahkan setelah proyek dibuat.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {pendingPhases.map((ph, i) => {
                            const c = PILL[i % PILL.length]
                            return (
                              <div key={ph.tempId} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                                <div className="flex-shrink-0 h-2.5 w-2.5 rounded-full" style={{ background: c.done }} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-foreground truncate">{ph.task_description}</p>
                                  <p className="text-[10px] text-muted-foreground">{weekToLabel(ph.week_number)} → {weekToLabel(ph.end_week)}</p>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: c.bg, color: c.text }}>{ph.progress_weight}%</span>
                                <button type="button" onClick={() => setPendingPhases(p => p.filter(x => x.tempId !== ph.tempId))}
                                  className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Log Mingguan placeholder */}
                    <div className="rounded-xl border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center py-8 gap-2">
                      <Camera className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-xs font-medium text-muted-foreground">Log Mingguan Aktual</p>
                      <p className="text-[11px] text-muted-foreground/70 text-center max-w-xs">
                        Log lapangan tersedia setelah proyek dibuat dan fase pertama ditambahkan.
                      </p>
                    </div>

                  </div>
                )}
              </div>

              {/* ══════════════════════════════════════════════════════════════ */}
              {/* DIVISION 2: COST CONTROL                                     */}
              {/* ══════════════════════════════════════════════════════════════ */}
              <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
                <SectionHeader
                  title="Cost Control"
                  subtitle="Alokasi budget per stream — kalkulasi net margin otomatis"
                  accent="bg-violet-600"
                  open={openSection === "cc"}
                  onToggle={() => toggleSection("cc")}
                  badge={
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 flex-shrink-0">
                      DIV 2
                    </span>
                  }
                />

                {openSection === "cc" && (
                  <div className="border-t border-border bg-card px-6 py-6 flex flex-col gap-6">

                    {/* Live margin banner */}
                    {contractVal > 0 && (() => {
                      const mt = marginTier(((contractVal - totalBudget) / contractVal) * 100)
                      return (
                        <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${mt.bg} border border-current/10`}>
                          <div>
                            <p className={`text-[9px] font-black uppercase tracking-widest ${mt.text} opacity-70`}>Net Margin Live</p>
                            <p className={`text-[11px] ${mt.text} opacity-60`}>Kontrak {`Rp ${contractVal.toLocaleString("id-ID")}`} − Budget {`Rp ${totalBudget.toLocaleString("id-ID")}`}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-2xl font-black tabular-nums ${mt.text}`}>
                              {(((contractVal - totalBudget) / contractVal) * 100) >= 0 ? "+" : ""}
                              {(((contractVal - totalBudget) / contractVal) * 100).toFixed(1)}%
                            </p>
                            <p className={`text-xs font-bold ${mt.text} opacity-80`}>{mt.label}</p>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Main budget */}
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">Budget Utama (Main Stream)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {BUDGET_STREAMS.map(s => (
                          <BudgetInput key={s.key} label={s.label} value={budget[s.key]} onChange={v => sb(s.key, v)} />
                        ))}
                      </div>
                      {Object.entries(budget).filter(([k]) => !k.startsWith("vo_")).some(([, v]) => v) && (
                        <p className="mt-2 text-[10px] text-muted-foreground text-right">
                          Subtotal Main: <span className="font-bold text-foreground">
                            Rp {BUDGET_STREAMS.reduce((s, b) => s + parseRpInput(budget[b.key]), 0).toLocaleString("id-ID")}
                          </span>
                        </p>
                      )}
                    </div>

                    {/* VO budget */}
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">Budget VO (Variation Order Stream)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {BUDGET_STREAMS.map(s => (
                          <BudgetInput key={s.voKey} label={s.label} value={budget[s.voKey]} onChange={v => sb(s.voKey, v)} />
                        ))}
                      </div>
                      {Object.entries(budget).filter(([k]) => k.startsWith("vo_")).some(([, v]) => v) && (
                        <p className="mt-2 text-[10px] text-muted-foreground text-right">
                          Subtotal VO: <span className="font-bold text-foreground">
                            Rp {BUDGET_STREAMS.reduce((s, b) => s + parseRpInput(budget[b.voKey]), 0).toLocaleString("id-ID")}
                          </span>
                        </p>
                      )}
                    </div>

                    {/* VO entries (kerja tambah) */}
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted">
                        <p className="text-xs font-bold text-foreground">Kerja Tambah / VO</p>
                        <button type="button"
                          onClick={() => setPendingVOs(prev => [...prev, { id: `vo_${Date.now()}`, po_number: "", description: "", nilai_po: 0 }])}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors">
                          <Plus className="h-3 w-3" /> Tambah VO
                        </button>
                      </div>
                      {pendingVOs.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <p className="text-xs text-muted-foreground italic">Belum ada VO — opsional.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {pendingVOs.map((vo, idx) => (
                            <div key={vo.id} className="p-4 grid grid-cols-3 gap-3 items-center">
                              <div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">No. PO VO</p>
                                <input className={INPUT_CLS} value={vo.po_number} placeholder="PO Kerja Tambah"
                                  onChange={e => setPendingVOs(p => p.map((v, i) => i === idx ? { ...v, po_number: e.target.value } : v))} />
                              </div>
                              <div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Nilai (Rp)</p>
                                <input type="number" min={0} className={INPUT_CLS} value={vo.nilai_po || ""} placeholder="0"
                                  onChange={e => setPendingVOs(p => p.map((v, i) => i === idx ? { ...v, nilai_po: Number(e.target.value) } : v))} />
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Deskripsi</p>
                                  <input className={INPUT_CLS} value={vo.description} placeholder="Deskripsi VO…"
                                    onChange={e => setPendingVOs(p => p.map((v, i) => i === idx ? { ...v, description: e.target.value } : v))} />
                                </div>
                                <button type="button" onClick={() => setPendingVOs(p => p.filter((_, i) => i !== idx))}
                                  className="mt-5 p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="px-4 py-2 border-t border-border bg-muted">
                            <p className="text-[10px] text-muted-foreground text-right">
                              Total VO: <span className="font-bold text-foreground">Rp {voTotal.toLocaleString("id-ID")}</span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>

              {/* ══════════════════════════════════════════════════════════════ */}
              {/* DIVISION 3: FINANCE                                          */}
              {/* ══════════════════════════════════════════════════════════════ */}
              <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
                <SectionHeader
                  title="Finance"
                  subtitle="Terms of Payment, milestone tagihan, dan realisasi billing"
                  accent="bg-amber-500"
                  open={openSection === "finance"}
                  onToggle={() => toggleSection("finance")}
                  badge={
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 flex-shrink-0">
                      DIV 3
                    </span>
                  }
                />

                {openSection === "finance" && (
                  <div className="border-t border-border bg-card px-6 py-6 flex flex-col gap-6">

                    {/* Billing preview based on contract value */}
                    {contractVal > 0 && pendingTermins.length > 0 && (
                      <div className="rounded-xl border border-border bg-muted/30 p-4">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">Proyeksi Tagihan</p>
                        <div className="flex flex-col gap-2">
                          {pendingTermins.map((t, i) => {
                            const amt = Math.round(contractVal * t.billing_percentage / 100)
                            return (
                              <div key={t.tempId} className="flex items-center gap-3">
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 flex-shrink-0">T{i+1}</span>
                                <span className="text-xs text-foreground flex-1 truncate">{t.termin_name}</span>
                                <span className="text-[10px] text-muted-foreground flex-shrink-0">Trigger ≥{t.required_progress_trigger}%</span>
                                <span className="text-xs font-bold text-foreground flex-shrink-0">Rp {amt.toLocaleString("id-ID")}</span>
                                <span className="text-[9px] text-muted-foreground flex-shrink-0">({t.billing_percentage}%)</span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Total termin</span>
                          <span className={`text-[10px] font-bold ${totalTerminPct === 100 ? "text-emerald-600 dark:text-emerald-400" : totalTerminPct > 100 ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
                            {totalTerminPct}% dari kontrak {totalTerminPct === 100 ? "✓" : ""}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Finance status explanation */}
                    <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-start gap-3">
                      <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">Status awal: TERKUNCI</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Tagihan terbuka otomatis saat progres fisik mencapai threshold termin.
                          Setelah terbuka, Doc Con dapat mengirim ke Finance untuk diproses.
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                          <span>Sudah Ditagih: —</span>
                          <span>·</span>
                          <span>Realisasi: —</span>
                          <span>·</span>
                          <span>Lunas: —</span>
                        </div>
                      </div>
                    </div>

                    {/* Terms of Payment */}
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground">Terms of Payment (TOP)</p>
                          {pendingTermins.length > 0 && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              totalTerminPct === 100 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
                              totalTerminPct > 100 ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" :
                              "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            }`}>
                              {totalTerminPct}% {totalTerminPct === 100 ? "✓" : ""}
                            </span>
                          )}
                        </div>
                        <button type="button" onClick={() => setShowTerminForm(v => !v)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                          <Plus className="h-3 w-3" /> Tambah Termin
                        </button>
                      </div>

                      {showTerminForm && (
                        <div className="px-4 py-4 border-b border-border bg-amber-50/30 dark:bg-amber-950/10">
                          <div className="grid gap-3 sm:grid-cols-3 mb-3">
                            <div className="sm:col-span-1">
                              <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Nama Termin</label>
                              <input className={INPUT_CLS} value={tName} onChange={e => setTName(e.target.value)} placeholder="DP 30%, Progress 50%…" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Trigger (%)</label>
                              <input type="text" inputMode="numeric" pattern="[0-9]*" title="Trigger progres"
                                className={INPUT_CLS} value={tTrigger}
                                onChange={e => setTTrigger(e.target.value.replace(/\D/g, ""))} placeholder="50" />
                              <p className="text-[9px] text-muted-foreground mt-1">Terbuka saat progres ≥ nilai ini</p>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Porsi (%)</label>
                              <input type="text" inputMode="numeric" pattern="[0-9]*" title="Porsi tagihan"
                                className={INPUT_CLS} value={tBillingPct}
                                onChange={e => setTBillingPct(e.target.value.replace(/\D/g, ""))} placeholder="30" />
                              <p className="text-[9px] text-muted-foreground mt-1">% dari total nilai kontrak</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" disabled={!tName.trim()}
                              onClick={() => {
                                if (!tName.trim()) return
                                setPendingTermins(prev => [...prev, {
                                  tempId: `pt_${Date.now()}`, termin_name: tName.trim(),
                                  required_progress_trigger: Number(tTrigger) || 50,
                                  billing_percentage: Number(tBillingPct) || 30,
                                }])
                                setTName(""); setTTrigger("50"); setTBillingPct("30"); setShowTerminForm(false)
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-50 transition-colors">
                              <Plus className="h-3.5 w-3.5" /> Tambah
                            </button>
                            <button type="button" onClick={() => { setShowTerminForm(false); setTName("") }}
                              className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">Batal</button>
                          </div>
                        </div>
                      )}

                      {pendingTermins.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <p className="text-xs text-muted-foreground">Belum ada termin — opsional, dapat dikonfigurasi setelah proyek dibuat.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {pendingTermins.map((t, i) => (
                            <div key={t.tempId} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 flex-shrink-0">T{i+1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground">{t.termin_name}</p>
                                <p className="text-[10px] text-muted-foreground">Trigger: ≥{t.required_progress_trigger}% · Porsi: {t.billing_percentage}%
                                  {contractVal > 0 && <span className="ml-1 text-foreground font-medium">≈ Rp {Math.round(contractVal * t.billing_percentage / 100).toLocaleString("id-ID")}</span>}
                                </p>
                              </div>
                              <button type="button" onClick={() => setPendingTermins(p => p.filter(x => x.tempId !== t.tempId))}
                                className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <div className="pt-2 pb-8">
                <button type="submit" disabled={saving || !form.display_name.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md shadow-indigo-200/60 dark:shadow-none text-sm">
                  {saving
                    ? <><RefreshCw className="h-4 w-4 animate-spin" /> Membuat Proyek…</>
                    : <><Save className="h-4 w-4" /> Buat &amp; Buka Workspace Doc Con</>
                  }
                </button>
                <p className="text-center text-[11px] text-muted-foreground mt-2">
                  Semua data tersimpan ke database — Anda akan diarahkan ke workspace Doc Con.
                </p>
              </div>

            </form>
          </div>
        </div>

        <Toaster richColors position="bottom-right" />
      </SidebarInset>
    </SidebarProvider>
  )
}
