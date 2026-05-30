"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  RefreshCw, Search, Plus, Trash2, Pencil, Check, X,
  TrendingUp, TrendingDown, FolderOpen,
  AlertTriangle, ChevronLeft, Save, Bell, CheckCircle2,
  BarChart3,
} from "lucide-react"
import type { ExecProjectRow } from "@/app/api/executive-summary/route"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

type CostItem = {
  id: string; project_key: string; category: string; description: string
  amount: number; cost_date?: string | null; input_by?: string
  cost_stream: "main" | "vo"; created_at: string
}

type CCProjectDetail = {
  op_gaji: number; op_material: number; op_transport: number
  op_operasional: number; op_sewa: number; op_lainnya: number
  op_budget_vo: number
  op_vo_gaji: number; op_vo_material: number; op_vo_transport: number
  op_vo_operasional: number; op_vo_sewa: number; op_vo_lainnya: number
}

type Escalation = {
  id: string; escalation_type: string; threshold_pct: number
  triggered_at: string; acknowledged_at: string | null; notes: string | null
}

// ─── Budget stream definitions ────────────────────────────────────────────────

const STREAMS: Array<{
  key: string; label: string; detailField: keyof CCProjectDetail
  voField: keyof CCProjectDetail; catColor: string
}> = [
  { key: "gaji",        label: "Gaji & Tunjangan",     detailField: "op_gaji",        voField: "op_vo_gaji",        catColor: "bg-slate-100 text-slate-700 border-slate-200"  },
  { key: "material",    label: "Material / Bahan",      detailField: "op_material",    voField: "op_vo_material",    catColor: "bg-teal-50 text-teal-700 border-teal-200"      },
  { key: "transport",   label: "Transport & Logistik",  detailField: "op_transport",   voField: "op_vo_transport",   catColor: "bg-orange-50 text-orange-700 border-orange-200"},
  { key: "operasional", label: "Biaya Operasional",     detailField: "op_operasional", voField: "op_vo_operasional", catColor: "bg-violet-50 text-violet-700 border-violet-200"},
  { key: "sewa",        label: "Sewa & Utilitas",       detailField: "op_sewa",        voField: "op_vo_sewa",        catColor: "bg-pink-50 text-pink-700 border-pink-200"      },
  { key: "lainnya",     label: "Biaya Lainnya",         detailField: "op_lainnya",     voField: "op_vo_lainnya",     catColor: "bg-neutral-100 text-neutral-500 border-neutral-200"},
]

const CATS = STREAMS.map(s => s.key)
const CAT_LABELS: Record<string, string> = Object.fromEntries(STREAMS.map(s => [s.key, s.label]))
const CAT_COLORS: Record<string, string> = Object.fromEntries(STREAMS.map(s => [s.key, s.catColor]))

const EMPTY_DETAIL: CCProjectDetail = {
  op_gaji: 0, op_material: 0, op_transport: 0,
  op_operasional: 0, op_sewa: 0, op_lainnya: 0, op_budget_vo: 0,
  op_vo_gaji: 0, op_vo_material: 0, op_vo_transport: 0,
  op_vo_operasional: 0, op_vo_sewa: 0, op_vo_lainnya: 0,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

const fShort = (n: number): string => {
  const abs  = Math.abs(n)
  const sign = n < 0 ? "−" : ""
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000)     return `${sign}${(abs / 1_000_000).toFixed(1)}Jt`
  if (abs >= 1_000)         return `${sign}${(abs / 1_000).toFixed(0)}Rb`
  return `${sign}${Math.round(abs)}`
}

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = React.useState(value)
  React.useEffect(() => { const id = setTimeout(() => setDv(value), ms); return () => clearTimeout(id) }, [value, ms])
  return dv
}

function progColor(pct: number) {
  return pct > 100 ? "bg-red-500" : pct > 80 ? "bg-amber-400" : "bg-indigo-500"
}

// ─── Margin Pill ──────────────────────────────────────────────────────────────

function MarginPill({ margin, contractVal }: { margin: number; contractVal: number }) {
  if (contractVal <= 0) return <span className="text-neutral-200 text-sm">—</span>
  const cls =
    margin >= 15 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    margin >= 0  ? "bg-amber-50  text-amber-700  border-amber-200"     :
                   "bg-red-50    text-red-600    border-red-200"
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border tabular-nums ${cls}`}>
      {margin >= 0 ? "+" : ""}{margin.toFixed(1)}%
    </span>
  )
}

// ─── Safety Margin State ─────────────────────────────────────────────────────

type SafetyKey = "AMAN" | "WASPADA" | "KRITIS" | "RUGI"
type SafetyState = {
  key: SafetyKey; label: string; desc: string
  bg: string; text: string; border: string; bar: string
}

function getSafetyState(margin: number): SafetyState {
  if (margin >= 15) return { key: "AMAN",    label: "AMAN",    desc: "Margin memenuhi ambang overhead korporat",        bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", bar: "bg-emerald-500" }
  if (margin >= 5)  return { key: "WASPADA", label: "WASPADA", desc: "Margin tipis — perlu pengawasan aktif",            bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   bar: "bg-amber-400"   }
  if (margin >= 0)  return { key: "KRITIS",  label: "KRITIS",  desc: "Margin di bawah biaya overhead minimum",          bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200",  bar: "bg-orange-400"  }
  return              { key: "RUGI",    label: "RUGI",    desc: "Proyek merugi — eskalasi segera diperlukan",      bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     bar: "bg-red-500"     }
}

// ─── ROI Overview Panel ───────────────────────────────────────────────────────

function ROIOverviewPanel({
  contractVal, actualCosts, progress, detail,
}: {
  contractVal: number; actualCosts: number; progress: number; detail: CCProjectDetail
}) {
  const netProfit = contractVal - actualCosts
  const netMargin = contractVal > 0 ? (netProfit / contractVal) * 100 : 0
  const utilPct   = contractVal > 0 ? Math.min(150, (actualCosts / contractVal) * 100) : 0
  const safety    = getSafetyState(netMargin)

  const totalBudgetDef = STREAMS.reduce((s, st) => s + detail[st.detailField] + detail[st.voField], 0)
  const budgetDefPct   = contractVal > 0 && totalBudgetDef > 0
    ? Math.min(100, (totalBudgetDef / contractVal) * 100) : 0

  const marginBarPct  = Math.min(100, Math.max(0, (netMargin / 30) * 100))

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">

      {/* Safety banner */}
      <div className={`flex items-center gap-3 px-5 py-3.5 border-b ${safety.bg} ${safety.border}`}>
        <div className={`flex-shrink-0 h-9 w-9 rounded-xl border flex items-center justify-center ${safety.bg} ${safety.border}`}>
          {safety.key === "AMAN"
            ? <TrendingUp className={`h-4 w-4 ${safety.text}`} />
            : <AlertTriangle className={`h-4 w-4 ${safety.text}`} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-black tracking-widest uppercase ${safety.text}`}>
            Status Margin: {safety.label}
          </p>
          <p className={`text-[11px] mt-0.5 ${safety.text} opacity-75`}>{safety.desc}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={`text-3xl font-black tabular-nums leading-none ${safety.text}`}>
            {netMargin >= 0 ? "+" : ""}{netMargin.toFixed(1)}%
          </p>
          <p className={`text-[10px] mt-0.5 ${safety.text} opacity-60`}>Net Margin</p>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-neutral-100">
        {([
          { label: "Nilai Kontrak + VO",      val: fShort(contractVal), sub: fIDR(contractVal),  color: "text-neutral-800" },
          { label: "Grand Total Biaya Aktual", val: fShort(actualCosts), sub: fIDR(actualCosts),  color: utilPct > 100 ? "text-red-600" : "text-indigo-700" },
          { label: "Net Profit",               val: fShort(netProfit),   sub: fIDR(netProfit),    color: netProfit >= 0 ? "text-emerald-600" : "text-red-600" },
          { label: "Progres Fisik",            val: `${progress}%`,      sub: "selesai fisik",    color: "text-indigo-600" },
        ] as const).map(k => (
          <div key={k.label} className="px-5 py-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">{k.label}</p>
            <p className={`text-2xl font-black tabular-nums leading-none ${k.color}`}>{k.val}</p>
            <p className="text-[10px] text-neutral-400 mt-1.5 tabular-nums truncate">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Progress bars */}
      <div className="px-5 py-3.5 border-t border-neutral-50 flex flex-col gap-2.5">
        {[
          { label: "Utilisasi Anggaran",  pct: utilPct,      barCls: utilPct > 100 ? "bg-red-500" : utilPct > 80 ? "bg-amber-400" : "bg-indigo-500", valCls: utilPct > 100 ? "text-red-500" : utilPct > 80 ? "text-amber-500" : "text-neutral-600" },
          { label: "Progres Fisik",       pct: progress,     barCls: "bg-indigo-400",  valCls: "text-indigo-600" },
          { label: "Net Margin Health",   pct: marginBarPct, barCls: safety.bar,       valCls: safety.text },
          ...(totalBudgetDef > 0 ? [{ label: "Plafon Terdefinisi", pct: budgetDefPct, barCls: budgetDefPct > 100 ? "bg-amber-400" : "bg-violet-400", valCls: "text-violet-600" }] : []),
        ].map(row => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 w-36 flex-shrink-0">{row.label}</span>
            <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${row.barCls}`}
                style={{ width: `${Math.min(100, row.pct)}%` }} />
            </div>
            <span className={`text-[10px] font-bold tabular-nums w-9 text-right flex-shrink-0 ${row.valCls}`}>
              {Math.round(row.pct)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Project Gallery Card ─────────────────────────────────────────────────────

function CCProjectCard({ row, isActive, onFocus }: {
  row: ExecProjectRow; isActive: boolean; onFocus: () => void
}) {
  const prog  = row.physical_progress
  const pct   = row.contractVal > 0 ? Math.min(110, (row.totalCosts / row.contractVal) * 100) : 0
  const progCl = pct > 100 ? "#ef4444" : pct > 80 ? "#f59e0b" : "#6366f1"

  return (
    <div onClick={onFocus}
      className={`group relative flex flex-col rounded-2xl bg-white border cursor-pointer transition-all duration-200 overflow-hidden ${
        isActive
          ? "border-indigo-400 shadow-lg shadow-indigo-100/50 ring-1 ring-indigo-400/20"
          : "border-neutral-200 hover:border-neutral-300 hover:shadow-md"
      }`}>
      {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500" />}

      {/* Header */}
      <div className={`flex items-start gap-3 px-4 pt-4 pb-3 border-b ${isActive ? "bg-indigo-50/40 border-indigo-100" : "bg-white border-neutral-100"}`}>
        <div className={`flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${isActive ? "bg-indigo-600" : "bg-neutral-100 group-hover:bg-neutral-200"}`}>
          <FolderOpen className={`h-4 w-4 transition-colors ${isActive ? "text-white" : "text-neutral-400"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-neutral-900 line-clamp-2 leading-snug">{row.display_name}</p>
          <p className="text-[11px] text-neutral-400 truncate mt-0.5">{row.customer_name || "—"}</p>
        </div>
        <span className={`flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded uppercase mt-0.5 ${
          row.project_status === "SELESAI" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
        }`}>{row.project_status}</span>
      </div>

      {/* Financials */}
      <div className="px-4 py-3.5 flex flex-col gap-2.5 flex-1">
        {row.po_number && <p className="text-[10px] font-mono text-neutral-500 truncate">📜 {row.po_number}</p>}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">Kontrak</p>
            <p className="text-xs font-bold text-neutral-800 tabular-nums">{row.contractVal > 0 ? fShort(row.contractVal) : "—"}</p>
          </div>
          <div>
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">Biaya Aktual</p>
            <p className="text-xs font-bold tabular-nums" style={{ color: progCl }}>{fShort(row.totalCosts)}</p>
          </div>
        </div>

        {/* Budget utilization bar */}
        {row.contractVal > 0 && (
          <div>
            <div className="flex justify-between mb-1">
              <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Utilisasi Anggaran</p>
              <p className="text-[9px] tabular-nums font-bold" style={{ color: progCl }}>{Math.round(pct)}%</p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pct)}%`, background: progCl }} />
            </div>
          </div>
        )}

        {/* Net profit + margin */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center gap-1">
            {row.netProfit >= 0
              ? <TrendingUp className="h-3 w-3 text-emerald-500" />
              : <TrendingDown className="h-3 w-3 text-red-500" />}
            <span className={`text-xs font-bold tabular-nums ${row.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {fShort(row.netProfit)}
            </span>
          </div>
          <MarginPill margin={row.netMargin} contractVal={row.contractVal} />
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between mb-1">
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Progres Fisik</p>
            <p className="text-[9px] tabular-nums font-black text-indigo-600">{prog}%</p>
          </div>
          <div className="h-1 w-full rounded-full bg-neutral-100 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-400" style={{ width: `${prog}%` }} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 pb-3.5 pt-2 border-t border-neutral-50">
        <span className="text-[10px] text-neutral-400">{isActive ? "Workspace aktif" : "Klik untuk kelola biaya"}</span>
        <Pencil className={`h-3.5 w-3.5 transition-colors ${isActive ? "text-indigo-500 opacity-100" : "text-neutral-200 opacity-0 group-hover:opacity-100"}`} />
      </div>
    </div>
  )
}

// ─── Budget Plafon Section ────────────────────────────────────────────────────

function BudgetPlafonSection({
  projectKey, detail, costs, contractVal, saving,
  onSave,
}: {
  projectKey: string; detail: CCProjectDetail; costs: CostItem[]
  contractVal: number; saving: boolean
  onSave: (patch: Partial<CCProjectDetail>) => void
}) {
  const [form, setForm] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(STREAMS.map(s => [s.detailField, String(detail[s.detailField] || "")]))
  )
  const [showVO, setShowVO] = React.useState(false)
  const [voForm, setVoForm] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(STREAMS.map(s => [s.voField, String(detail[s.voField] || "")]))
  )
  const [dirty, setDirty] = React.useState(false)

  React.useEffect(() => {
    setForm(Object.fromEntries(STREAMS.map(s => [s.detailField, String(detail[s.detailField] || "")])))
    setVoForm(Object.fromEntries(STREAMS.map(s => [s.voField, String(detail[s.voField] || "")])))
    setDirty(false)
  }, [detail])

  const totalBudget    = STREAMS.reduce((s, st) => s + (Number(form[st.detailField]) || 0), 0)
  const totalVoBudget  = STREAMS.reduce((s, st) => s + (Number(voForm[st.voField]) || 0), 0)
  const budgetOverage  = contractVal > 0 && totalBudget > contractVal

  // Actual per category (main stream)
  const actualByCategory = React.useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of costs.filter(c => c.cost_stream === "main")) {
      map[c.category] = (map[c.category] || 0) + Number(c.amount)
    }
    return map
  }, [costs])

  const actualVoByCategory = React.useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of costs.filter(c => c.cost_stream === "vo")) {
      map[c.category] = (map[c.category] || 0) + Number(c.amount)
    }
    return map
  }, [costs])

  function handleSave() {
    const patch: Partial<CCProjectDetail> = {}
    STREAMS.forEach(s => {
      const v = Number(form[s.detailField]) || 0
      ;(patch as Record<string, number>)[s.detailField] = v
    })
    if (showVO) {
      STREAMS.forEach(s => {
        const v = Number(voForm[s.voField]) || 0
        ;(patch as Record<string, number>)[s.voField] = v
      })
      patch.op_budget_vo = totalVoBudget
    }
    onSave(patch)
    setDirty(false)
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 bg-neutral-50/60">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-indigo-600" />
          <p className="text-sm font-bold text-neutral-900">Anggaran Operasional (Plafon)</p>
          {totalBudget > 0 && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              budgetOverage ? "bg-red-50 text-red-600 border-red-200" :
              contractVal > 0 ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-neutral-50 text-neutral-500 border-neutral-200"
            }`}>
              {contractVal > 0 ? `${Math.round((totalBudget / contractVal) * 100)}% dari kontrak` : fShort(totalBudget)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button type="button" disabled={saving} onClick={handleSave}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? "Menyimpan…" : "Simpan Anggaran"}
            </button>
          )}
          <button type="button" onClick={() => setShowVO(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
              showVO ? "bg-amber-50 text-amber-700 border-amber-200" : "text-neutral-500 border-neutral-200 hover:bg-neutral-50"
            }`}>
            {showVO ? "Hide VO" : "Kerja Tambah (VO)"}
          </button>
        </div>
      </div>

      {budgetOverage && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-red-50 border-b border-red-100">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
          <p className="text-[11px] text-red-600 font-semibold">
            Total anggaran ({fShort(totalBudget)}) melebihi nilai kontrak ({fShort(contractVal)}).
          </p>
        </div>
      )}

      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          {STREAMS.map(s => {
            const budget  = Number(form[s.detailField]) || 0
            const actual  = actualByCategory[s.key] || 0
            const pct     = budget > 0 ? Math.min(110, (actual / budget) * 100) : actual > 0 ? 110 : 0
            const overBudget = pct > 100
            return (
              <div key={s.key} className={`rounded-xl border p-3.5 transition-colors ${
                overBudget && budget > 0 ? "bg-red-50/30 border-red-200" : "bg-neutral-50/40 border-neutral-100"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${s.catColor}`}>{s.label}</span>
                  {overBudget && budget > 0 && <span className="text-[9px] font-bold text-red-500">⚠ Melebihi</span>}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-semibold text-neutral-400 whitespace-nowrap">Plafon Rp</span>
                  <input
                    type="number" min={0}
                    value={form[s.detailField]}
                    onChange={e => { setForm(p => ({ ...p, [s.detailField]: e.target.value })); setDirty(true) }}
                    placeholder="0"
                    className="flex-1 min-w-0 text-xs rounded-lg border border-neutral-200 bg-white px-2 py-1.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 tabular-nums transition-all"
                  />
                </div>
                {budget > 0 && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[9px] text-neutral-400">Aktual: {fShort(actual)}</span>
                      <span className="text-[9px] tabular-nums font-bold" style={{ color: progColor(pct) === "bg-red-500" ? "#ef4444" : progColor(pct) === "bg-amber-400" ? "#f59e0b" : "#6366f1" }}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-neutral-200 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${progColor(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    {budget > actual && <p className="text-[9px] text-neutral-300 mt-0.5 tabular-nums">Sisa: {fShort(budget - actual)}</p>}
                  </div>
                )}
                {budget === 0 && actual > 0 && (
                  <p className="text-[9px] text-amber-600 font-semibold">Biaya ada tapi plafon belum diset</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Budget rollup summary */}
        {contractVal > 0 && totalBudget > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100 mb-4">
            <span className="text-[11px] text-neutral-500">Total plafon terdefinisi:</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold tabular-nums text-neutral-800">{fShort(totalBudget)}</span>
              <span className="text-[10px] text-neutral-400">dari kontrak {fShort(contractVal)}</span>
              <span className={`text-[10px] font-bold ${budgetOverage ? "text-red-500" : "text-neutral-400"}`}>
                ({Math.round((totalBudget / contractVal) * 100)}%)
              </span>
            </div>
          </div>
        )}

        {/* VO Budget form */}
        {showVO && (
          <div className="border-t border-amber-100 pt-4 mt-2">
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-3">
              Anggaran Kerja Tambah / VO — Total: {fShort(totalVoBudget)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STREAMS.map(s => {
                const budget = Number(voForm[s.voField]) || 0
                const actual = actualVoByCategory[s.key] || 0
                const pct    = budget > 0 ? Math.min(110, (actual / budget) * 100) : 0
                return (
                  <div key={s.key} className="rounded-xl border border-amber-100 bg-amber-50/20 p-3">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border block mb-2 w-fit ${s.catColor}`}>{s.label}</span>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-semibold text-neutral-400 whitespace-nowrap">VO Rp</span>
                      <input type="number" min={0} value={voForm[s.voField]}
                        onChange={e => { setVoForm(p => ({ ...p, [s.voField]: e.target.value })); setDirty(true) }}
                        placeholder="0"
                        className="flex-1 min-w-0 text-xs rounded-lg border border-amber-200 bg-white px-2 py-1.5 outline-none focus:border-amber-400 tabular-nums" />
                    </div>
                    {budget > 0 && (
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-[9px] text-neutral-400">Aktual VO: {fShort(actual)}</span>
                          <span className="text-[9px] tabular-nums font-bold text-amber-600">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-amber-100 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Save hint */}
      {!dirty && (
        <div className="px-5 pb-4">
          <p className="text-[10px] text-neutral-300 text-center">Ubah angka di atas untuk mengaktifkan tombol simpan.</p>
        </div>
      )}
    </div>
  )
}

// ─── Budget vs Actual Matrix ──────────────────────────────────────────────────

function BudgetActualMatrix({
  detail, costs, contractVal,
}: {
  detail: CCProjectDetail; costs: CostItem[]; contractVal: number
}) {
  const actualMain = React.useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of costs.filter(c => c.cost_stream === "main"))
      m[c.category] = (m[c.category] || 0) + Number(c.amount)
    return m
  }, [costs])

  const actualVO = React.useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of costs.filter(c => c.cost_stream === "vo"))
      m[c.category] = (m[c.category] || 0) + Number(c.amount)
    return m
  }, [costs])

  const hasVoBudget = STREAMS.some(s => detail[s.voField] > 0)

  const rows = STREAMS.map(s => {
    const budgetPM    = detail[s.detailField]
    const budgetVO    = detail[s.voField]
    const totalBudget = budgetPM + budgetVO
    const terpakai    = (actualMain[s.key] || 0) + (actualVO[s.key] || 0)
    const sisa        = totalBudget - terpakai
    const pct         = totalBudget > 0 ? (terpakai / totalBudget) * 100 : terpakai > 0 ? 110 : 0
    return { key: s.key, label: s.label, catColor: s.catColor, budgetPM, budgetVO, totalBudget, terpakai, sisa, pct }
  })

  const totals = rows.reduce(
    (acc, r) => ({ budgetPM: acc.budgetPM + r.budgetPM, budgetVO: acc.budgetVO + r.budgetVO, totalBudget: acc.totalBudget + r.totalBudget, terpakai: acc.terpakai + r.terpakai, sisa: acc.sisa + r.sisa }),
    { budgetPM: 0, budgetVO: 0, totalBudget: 0, terpakai: 0, sisa: 0 }
  )

  const chartData = STREAMS.map(s => ({
    name: s.label.split(/[\s/]/)[0],
    budget: Math.round((detail[s.detailField] + detail[s.voField]) / 1_000),
    aktual: Math.round(((actualMain[s.key] || 0) + (actualVO[s.key] || 0)) / 1_000),
  }))

  const anyBudgetSet    = totals.totalBudget > 0
  const anyActual       = totals.terpakai   > 0

  if (!anyBudgetSet && !anyActual) return null

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-neutral-100 bg-neutral-50/60">
        <BarChart3 className="h-4 w-4 text-violet-600" />
        <p className="text-sm font-bold text-neutral-900">Matriks Budget vs Realisasi</p>
        {totals.sisa < 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">
            ⚠ Over Budget
          </span>
        )}
      </div>

      {/* Recharts grouped bar — only when plafon set */}
      {anyBudgetSet && (
        <div className="px-5 pt-4 pb-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-3">
            Visualisasi Budget vs Aktual (Ribu Rupiah)
          </p>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={chartData} barCategoryGap="35%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={38}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}Jt` : `${v}Rb`} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  [fIDR(value * 1_000), name === "budget" ? "Budget PM+VO" : "Biaya Aktual"]}
                contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px" }}
              />
              <Bar dataKey="budget" name="budget" fill="#e0e7ff" radius={[3, 3, 0, 0]} />
              <Bar dataKey="aktual" name="aktual" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.aktual > entry.budget && entry.budget > 0 ? "#ef4444" : "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 justify-center mt-1 mb-1">
            <div className="flex items-center gap-1.5"><div className="h-2 w-4 rounded bg-indigo-100" /><span className="text-[10px] text-neutral-400">Budget PM+VO</span></div>
            <div className="flex items-center gap-1.5"><div className="h-2 w-4 rounded bg-indigo-500" /><span className="text-[10px] text-neutral-400">Aktual</span></div>
            <div className="flex items-center gap-1.5"><div className="h-2 w-4 rounded bg-red-500" /><span className="text-[10px] text-neutral-400">Over Budget</span></div>
          </div>
        </div>
      )}

      {/* Comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-t border-neutral-100">
          <thead>
            <tr className="bg-neutral-50">
              <th className="text-left px-5 py-2 text-[9px] font-black uppercase tracking-widest text-neutral-400">Kategori</th>
              <th className="text-right px-4 py-2 text-[9px] font-black uppercase tracking-widest text-neutral-400">Budget PM</th>
              {hasVoBudget && <th className="text-right px-4 py-2 text-[9px] font-black uppercase tracking-widest text-amber-500">Budget VO</th>}
              <th className="text-right px-4 py-2 text-[9px] font-black uppercase tracking-widest text-neutral-400">Terpakai</th>
              <th className="text-right px-4 py-2 text-[9px] font-black uppercase tracking-widest text-neutral-400">Sisa Kuota</th>
              <th className="text-right px-5 py-2 text-[9px] font-black uppercase tracking-widest text-neutral-400">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {rows.map(r => {
              const isOver   = r.sisa < 0 && r.totalBudget > 0
              const isWarn   = r.pct >= 80 && r.pct <= 100 && r.totalBudget > 0
              const noPlafon = r.totalBudget === 0 && r.terpakai > 0
              return (
                <tr key={r.key} className={isOver ? "bg-red-50/30" : isWarn ? "bg-amber-50/20" : ""}>
                  <td className="px-5 py-2.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${r.catColor}`}>{r.label}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600">
                    {r.budgetPM > 0 ? fShort(r.budgetPM) : <span className="text-neutral-200">—</span>}
                  </td>
                  {hasVoBudget && (
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-600">
                      {r.budgetVO > 0 ? fShort(r.budgetVO) : <span className="text-neutral-200">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-neutral-800">
                    {r.terpakai > 0 ? fShort(r.terpakai) : <span className="text-neutral-200">—</span>}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${
                    noPlafon ? "text-amber-500" : isOver ? "text-red-600" : isWarn ? "text-amber-600" : r.totalBudget > 0 ? "text-emerald-600" : "text-neutral-300"
                  }`}>
                    {noPlafon
                      ? <span className="text-[10px] font-semibold">Plafon blm diset</span>
                      : r.totalBudget > 0
                        ? <span>{isOver && "⚠ "}{fShort(r.sisa)}</span>
                        : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {r.totalBudget > 0 ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-14 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                          <div className={`h-full rounded-full ${r.pct > 100 ? "bg-red-500" : r.pct > 80 ? "bg-amber-400" : "bg-indigo-400"}`}
                            style={{ width: `${Math.min(100, r.pct)}%` }} />
                        </div>
                        <span className={`text-[10px] tabular-nums font-bold w-7 text-right ${r.pct > 100 ? "text-red-500" : r.pct > 80 ? "text-amber-500" : "text-neutral-500"}`}>
                          {Math.round(Math.min(r.pct, 999))}%
                        </span>
                      </div>
                    ) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-200 bg-neutral-50/80">
              <td className="px-5 py-3 text-xs font-black text-neutral-800 uppercase tracking-wide">Grand Total</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold text-neutral-700">
                {totals.budgetPM > 0 ? fShort(totals.budgetPM) : <span className="text-neutral-300">—</span>}
              </td>
              {hasVoBudget && (
                <td className="px-4 py-3 text-right tabular-nums font-bold text-amber-600">
                  {totals.budgetVO > 0 ? fShort(totals.budgetVO) : <span className="text-neutral-300">—</span>}
                </td>
              )}
              <td className="px-4 py-3 text-right tabular-nums font-black text-neutral-900 text-sm">
                {fShort(totals.terpakai)}
                <span className="block text-[9px] font-normal text-neutral-400 mt-0.5">{fIDR(totals.terpakai)}</span>
              </td>
              <td className={`px-4 py-3 text-right tabular-nums font-black text-base ${totals.totalBudget > 0 ? (totals.sisa < 0 ? "text-red-600" : "text-emerald-600") : "text-neutral-400"}`}>
                {totals.totalBudget > 0 ? (
                  <span className="flex items-center justify-end gap-1">
                    {totals.sisa < 0 && <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />}
                    {fShort(totals.sisa)}
                  </span>
                ) : <span className="text-sm font-normal text-neutral-300">Plafon blm diset</span>}
              </td>
              <td className="px-5 py-3 text-right">
                {totals.totalBudget > 0 && (
                  <span className={`text-sm font-black tabular-nums ${
                    totals.terpakai > totals.totalBudget ? "text-red-600" : totals.terpakai / totals.totalBudget >= 0.8 ? "text-amber-500" : "text-indigo-600"
                  }`}>
                    {Math.round((totals.terpakai / totals.totalBudget) * 100)}%
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Grand Total Biaya Aktual — absolute bottom anchor */}
      {anyActual && (
        <div className="flex items-center justify-between px-5 py-3 bg-neutral-900 text-white">
          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Grand Total Biaya Aktual Proyek</span>
          <span className="text-xl font-black tabular-nums">{fIDR(totals.terpakai)}</span>
        </div>
      )}
    </div>
  )
}

// ─── Cost Item View ───────────────────────────────────────────────────────────

function CostItemView({ item, onEdit, onDelete, confirming, onConfirmDelete, onCancelDelete }: {
  item: CostItem; onEdit: () => void; onDelete: () => void
  confirming: boolean; onConfirmDelete: () => void; onCancelDelete: () => void
}) {
  const catLabel = CAT_LABELS[item.category] ?? item.category
  const catColor = CAT_COLORS[item.category] ?? "bg-neutral-100 text-neutral-500 border-neutral-200"
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 group hover:bg-neutral-50 transition-colors">
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${item.cost_stream === "vo" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
        {item.cost_stream === "vo" ? "KT" : "PO"}
      </span>
      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${catColor}`}>{catLabel}</span>
      <p className="flex-1 text-xs text-neutral-600 truncate min-w-0">{item.description}</p>
      {item.cost_date && (
        <span className="text-[10px] text-neutral-300 flex-shrink-0 hidden sm:block">
          {new Date(item.cost_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" })}
        </span>
      )}
      <span className="text-sm font-bold tabular-nums text-neutral-800 flex-shrink-0 w-28 text-right">{fShort(Number(item.amount))}</span>
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {confirming ? (
          <>
            <button type="button" onClick={onConfirmDelete} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
              <Trash2 className="h-3 w-3" />Hapus?
            </button>
            <button type="button" onClick={onCancelDelete} title="Batal hapus" aria-label="Batal hapus" className="p-1 rounded text-neutral-400 hover:bg-neutral-100"><X className="h-3 w-3" /></button>
          </>
        ) : (
          <>
            <button type="button" onClick={onEdit} title="Edit item" aria-label="Edit item" className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"><Pencil className="h-3 w-3" /></button>
            <button type="button" onClick={onDelete} title="Hapus item" aria-label="Hapus item" className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Cost Item Edit Row ───────────────────────────────────────────────────────

function CostItemEdit({ item, onSave, onCancel, saving }: {
  item: CostItem
  onSave: (d: { description: string; amount: number; category: string; cost_date: string | null }) => void
  onCancel: () => void; saving: boolean
}) {
  const [desc,   setDesc]   = React.useState(item.description)
  const [amount, setAmount] = React.useState(String(item.amount))
  const [cat,    setCat]    = React.useState(item.category || "lainnya")
  const [date,   setDate]   = React.useState(item.cost_date ?? "")

  const commit = () => {
    const a = Number(amount.replace(/[^0-9.-]/g, ""))
    if (!desc.trim() || isNaN(a) || a <= 0) return
    onSave({ description: desc.trim(), amount: a, category: cat, cost_date: date || null })
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50/70 border-l-2 border-indigo-400">
      <select value={cat} onChange={e => setCat(e.target.value)} title="Kategori biaya"
        className="text-[11px] border border-neutral-200 rounded px-1.5 py-1 bg-white outline-none focus:border-indigo-400 flex-shrink-0">
        {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
      </select>
      <input value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit() } if (e.key === "Escape") onCancel() }}
        placeholder="Deskripsi" autoFocus
        className="flex-1 min-w-0 text-xs border border-neutral-200 rounded px-2 py-1 bg-white outline-none focus:border-indigo-400" />
      <input value={date} onChange={e => setDate(e.target.value)} type="date" title="Tanggal biaya" placeholder="Tanggal"
        className="text-[11px] border border-neutral-200 rounded px-1.5 py-1 bg-white outline-none focus:border-indigo-400 flex-shrink-0 w-32" />
      <input value={amount} onChange={e => setAmount(e.target.value)}
        placeholder="Jumlah"
        className="text-xs border border-neutral-200 rounded px-2 py-1 bg-white outline-none focus:border-indigo-400 w-32 text-right tabular-nums flex-shrink-0" />
      <button type="button" onClick={commit} disabled={saving}
        className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0">
        {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Simpan
      </button>
      <button type="button" onClick={onCancel} title="Batal edit" aria-label="Batal edit" className="p-1.5 rounded text-neutral-400 hover:bg-neutral-100 flex-shrink-0"><X className="h-3.5 w-3.5" /></button>
    </div>
  )
}

// ─── Add Cost Form ────────────────────────────────────────────────────────────

function AddCostForm({ projectKey, onAdd, onCancel }: {
  projectKey: string; onAdd: (item: CostItem) => void; onCancel: () => void
}) {
  const [desc,   setDesc]   = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [cat,    setCat]    = React.useState("lainnya")
  const [stream, setStream] = React.useState<"main" | "vo">("main")
  const [date,   setDate]   = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [err,    setErr]    = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const a = Number(amount.replace(/[^0-9.-]/g, ""))
    if (!desc.trim() || isNaN(a) || a <= 0) { setErr("Deskripsi dan jumlah wajib diisi."); return }
    setSaving(true); setErr(null)
    try {
      const res = await fetch("/api/project-costs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_key: projectKey, description: desc.trim(), amount: a, category: cat, cost_stream: stream, cost_date: date || null, input_by: "" }),
      })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      if (json.escalationWarning) {
        const msg = json.escalationWarning === "vo_budget_exceeded"
          ? "⚠ Biaya VO telah melebihi anggaran yang disetujui!"
          : "⚠ Biaya VO sudah mencapai 80% dari anggaran."
        setErr(msg)
        setTimeout(() => setErr(null), 4000)
      }
      onAdd(json.data as CostItem)
      setDesc(""); setAmount(""); setCat("lainnya"); setDate(""); setStream("main")
    } catch (e2) { setErr(String(e2)) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 bg-emerald-50/60 border-t border-emerald-100">
      <select value={stream} onChange={e => setStream(e.target.value as "main" | "vo")}
        title="Stream biaya" aria-label="Stream biaya"
        className="text-[11px] border border-neutral-200 rounded px-1.5 py-1 bg-white outline-none focus:border-emerald-400 flex-shrink-0">
        <option value="main">PO Utama</option>
        <option value="vo">Kerja Tambah</option>
      </select>
      <select value={cat} onChange={e => setCat(e.target.value)}
        title="Kategori biaya" aria-label="Kategori biaya"
        className="text-[11px] border border-neutral-200 rounded px-1.5 py-1 bg-white outline-none focus:border-emerald-400 flex-shrink-0">
        {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
      </select>
      <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Deskripsi pengeluaran…" required autoFocus
        title="Deskripsi pengeluaran" aria-label="Deskripsi pengeluaran"
        className="flex-1 min-w-0 text-xs border border-neutral-200 rounded px-2 py-1 bg-white outline-none focus:border-emerald-400" />
      <input value={date} onChange={e => setDate(e.target.value)} type="date"
        title="Tanggal biaya" aria-label="Tanggal biaya" placeholder="Tanggal"
        className="text-[11px] border border-neutral-200 rounded px-1.5 py-1 bg-white outline-none focus:border-emerald-400 flex-shrink-0 w-32" />
      <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Jumlah (Rp)" required
        title="Jumlah biaya" aria-label="Jumlah biaya"
        className="text-xs border border-neutral-200 rounded px-2 py-1 bg-white outline-none focus:border-emerald-400 w-32 text-right tabular-nums flex-shrink-0" />
      {err && <span className="text-[10px] text-amber-600 flex-shrink-0 max-w-[140px] truncate font-semibold">{err}</span>}
      <button type="submit" disabled={saving}
        className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50 flex-shrink-0">
        {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Tambah
      </button>
      <button type="button" onClick={onCancel} title="Batal tambah" aria-label="Batal tambah" className="p-1.5 rounded text-neutral-400 hover:bg-neutral-100 flex-shrink-0"><X className="h-3.5 w-3.5" /></button>
    </form>
  )
}

// ─── Realisasi Biaya Section ──────────────────────────────────────────────────

function RealisasiBiayaSection({ projectKey, costs, loading, onItemAdded, onItemSaved, onItemDeleted }: {
  projectKey: string; costs: CostItem[] | undefined; loading: boolean
  onItemAdded: (item: CostItem) => void
  onItemSaved: (id: string, patch: Partial<CostItem>) => void
  onItemDeleted: (id: string) => void
}) {
  const [editingId,  setEditingId]  = React.useState<string | null>(null)
  const [savingId,   setSavingId]   = React.useState<string | null>(null)
  const [confirmId,  setConfirmId]  = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [showAdd,    setShowAdd]    = React.useState(false)
  const [streamTab,  setStreamTab]  = React.useState<"all" | "main" | "vo">("all")

  const handleSave = async (id: string, data: { description: string; amount: number; category: string; cost_date: string | null }) => {
    setSavingId(id)
    try {
      const res = await fetch(`/api/project-costs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      onItemSaved(id, json.data ?? data); setEditingId(null)
    } catch { /* keep edit open */ }
    finally { setSavingId(null) }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/project-costs/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
      onItemDeleted(id); setConfirmId(null)
    } catch { /* silent */ }
    finally { setDeletingId(null) }
  }

  if (loading || !costs)
    return <div className="py-8 text-center text-xs text-neutral-400"><RefreshCw className="h-3 w-3 animate-spin inline mr-1.5" />Memuat pengeluaran…</div>

  const shown     = streamTab === "all" ? costs : costs.filter(c => c.cost_stream === streamTab)
  const mainTotal = costs.filter(c => c.cost_stream === "main").reduce((s, c) => s + Number(c.amount), 0)
  const voTotal   = costs.filter(c => c.cost_stream === "vo").reduce((s, c) => s + Number(c.amount), 0)

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-neutral-50/60 border-b border-neutral-100">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm font-bold text-neutral-900">Realisasi Biaya</p>
          <div className="flex gap-0.5 p-0.5 rounded-md bg-neutral-100">
            {(["all", "main", "vo"] as const).map(f => {
              const count = f === "all" ? costs.length : costs.filter(c => c.cost_stream === f).length
              return (
                <button key={f} type="button" onClick={() => setStreamTab(f)}
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${streamTab === f ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}>
                  {f === "all" ? `Semua (${count})` : f === "main" ? `PO (${count})` : `VO (${count})`}
                </button>
              )
            })}
          </div>
          {voTotal > 0 && (
            <span className="text-[10px] text-neutral-400">
              PO: <strong className="text-neutral-600">{fShort(mainTotal)}</strong>
              &nbsp;·&nbsp;KT: <strong className="text-amber-600">{fShort(voTotal)}</strong>
            </span>
          )}
        </div>
        <button type="button" onClick={() => setShowAdd(v => !v)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${showAdd ? "bg-neutral-200 text-neutral-600" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
          {showAdd ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showAdd ? "Batal" : "Tambah Pengeluaran"}
        </button>
      </div>

      {showAdd && (
        <AddCostForm
          projectKey={projectKey}
          onAdd={item => { onItemAdded(item); setShowAdd(false) }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {shown.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-xs text-neutral-400">{costs.length === 0 ? "Belum ada pengeluaran dicatat." : "Tidak ada item di stream ini."}</p>
          {costs.length === 0 && <p className="text-[10px] text-neutral-300 mt-1">Klik &quot;+ Tambah Pengeluaran&quot; untuk mulai mencatat.</p>}
        </div>
      ) : (
        <div className="divide-y divide-neutral-50">
          <div className="flex items-center gap-3 px-4 py-1.5 bg-neutral-50/40">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-300 w-6">Str</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-300 w-24">Kategori</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-300 flex-1">Deskripsi</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-300 w-24 hidden sm:block">Tanggal</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-300 w-28 text-right">Jumlah</span>
            <span className="w-16" />
          </div>
          {shown.map(item =>
            editingId === item.id ? (
              <CostItemEdit key={item.id} item={item} saving={savingId === item.id}
                onSave={data => handleSave(item.id, data)} onCancel={() => setEditingId(null)} />
            ) : (
              <CostItemView key={item.id} item={item}
                confirming={confirmId === item.id}
                onEdit={() => { setEditingId(item.id); setConfirmId(null) }}
                onDelete={() => setConfirmId(item.id)}
                onConfirmDelete={() => { if (deletingId !== item.id) handleDelete(item.id) }}
                onCancelDelete={() => setConfirmId(null)}
              />
            )
          )}
          <div className="flex items-center justify-end gap-2 px-4 py-2 bg-neutral-50/40">
            <span className="text-[10px] text-neutral-400">{shown.length} item ·</span>
            <span className="text-xs font-bold tabular-nums text-neutral-700">
              {fIDR(shown.reduce((s, c) => s + Number(c.amount), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CostControlPage() {
  const [rows,        setRows]        = React.useState<ExecProjectRow[]>([])
  const [costsCache,  setCostsCache]  = React.useState<Record<string, CostItem[]>>({})
  const [detailCache, setDetailCache] = React.useState<Record<string, CCProjectDetail>>({})
  const [escalCache,  setEscalCache]  = React.useState<Record<string, Escalation[]>>({})
  const [loadingKeys, setLoadingKeys] = React.useState<Record<string, boolean>>({})
  const [loading,     setLoading]     = React.useState(true)
  const [savingDetail, setSavingDetail] = React.useState(false)
  const [error,       setError]       = React.useState<string | null>(null)
  const [lastAt,      setLastAt]      = React.useState<Date | null>(null)
  const [activeKey,   setActiveKey]   = React.useState<string | null>(null)
  const [search,      setSearch]      = React.useState("")
  const debouncedSearch               = useDebounce(search, 500)

  // ── Stable refs — avoid recreating callbacks on every cache mutation ────────
  // Problem without refs: costsCache/detailCache/escalCache in enterFocus deps
  // causes the callback to recreate on EVERY item add/edit/delete, making all
  // CCProjectCard onFocus props stale and triggering full gallery re-renders.
  const costsRef    = React.useRef<Record<string, CostItem[]>>({})
  const detailRef   = React.useRef<Record<string, CCProjectDetail>>({})
  const escalRef    = React.useRef<Record<string, Escalation[]>>({})
  const activeRef   = React.useRef<string | null>(null)
  const inflightRef = React.useRef(new Set<string>())   // dedup concurrent fetches
  const lastSummaryAt = React.useRef(0)
  const SUMMARY_TTL_MS = 30_000                         // 30s: protect against 10+ users hammering refresh

  // Keep refs in sync with state (runs after every render, before next interaction)
  React.useEffect(() => { costsRef.current  = costsCache  }, [costsCache])
  React.useEffect(() => { detailRef.current = detailCache }, [detailCache])
  React.useEffect(() => { escalRef.current  = escalCache  }, [escalCache])
  React.useEffect(() => { activeRef.current = activeKey   }, [activeKey])

  // ── Summary fetch with 30s TTL ────────────────────────────────────────────
  const loadSummary = React.useCallback(async (force = false) => {
    if (!force && Date.now() - lastSummaryAt.current < SUMMARY_TTL_MS) return
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/executive-summary")
      if (!res.ok) throw new Error(await res.text())
      setRows((await res.json()).data ?? [])
      lastSummaryAt.current = Date.now()
      setLastAt(new Date())
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { loadSummary() }, [loadSummary])

  // ── Focus mode: stable callback via refs, in-flight deduplication ─────────
  // Empty dep array: this function NEVER recreates between renders.
  // All mutable state is accessed through refs (updated synchronously after each render).
  const enterFocus = React.useCallback(async (key: string) => {
    if (activeRef.current === key) { setActiveKey(null); return }
    setActiveKey(key)

    const needsCosts  = costsRef.current[key]  === undefined
    const needsDetail = detailRef.current[key] === undefined
    const needsEscal  = escalRef.current[key]  === undefined
    if (!needsCosts && !needsDetail && !needsEscal) return

    // Deduplicate: if another async call for this key is already in-flight, bail.
    // Prevents two users clicking the same card simultaneously from firing duplicate fetches.
    if (inflightRef.current.has(key)) return
    inflightRef.current.add(key)

    setLoadingKeys(p => ({ ...p, [key]: true }))
    try {
      await Promise.all([
        needsCosts && fetch(`/api/project-costs?key=${encodeURIComponent(key)}`)
          .then(r => r.json())
          .then(d => setCostsCache(p => ({ ...p, [key]: (d.data ?? []) as CostItem[] })))
          .catch(() => setCostsCache(p => ({ ...p, [key]: [] }))),

        needsDetail && fetch(`/api/project-details/${encodeURIComponent(key)}`)
          .then(r => r.json())
          .then(d => {
            const row = d.data ?? {}
            setDetailCache(p => ({ ...p, [key]: {
              op_gaji:           Number(row.op_gaji        || 0),
              op_material:       Number(row.op_material    || 0),
              op_transport:      Number(row.op_transport   || 0),
              op_operasional:    Number(row.op_operasional || 0),
              op_sewa:           Number(row.op_sewa        || 0),
              op_lainnya:        Number(row.op_lainnya     || 0),
              op_budget_vo:      Number(row.op_budget_vo   || 0),
              op_vo_gaji:        Number(row.op_vo_gaji        || 0),
              op_vo_material:    Number(row.op_vo_material    || 0),
              op_vo_transport:   Number(row.op_vo_transport   || 0),
              op_vo_operasional: Number(row.op_vo_operasional || 0),
              op_vo_sewa:        Number(row.op_vo_sewa        || 0),
              op_vo_lainnya:     Number(row.op_vo_lainnya     || 0),
            }}))
          })
          .catch(() => setDetailCache(p => ({ ...p, [key]: { ...EMPTY_DETAIL } }))),

        needsEscal && fetch(`/api/project-escalations/${encodeURIComponent(key)}`)
          .then(r => r.json())
          .then(d => setEscalCache(p => ({ ...p, [key]: (d.data ?? []) as Escalation[] })))
          .catch(() => setEscalCache(p => ({ ...p, [key]: [] }))),
      ])
    } finally {
      inflightRef.current.delete(key)
      setLoadingKeys(p => ({ ...p, [key]: false }))
    }
  }, []) // ← stable: never recreates, no re-render cascade on cache mutations

  // Save budget plafon
  const handleSaveDetail = React.useCallback(async (key: string, patch: Partial<CCProjectDetail>) => {
    setSavingDetail(true)
    try {
      const res = await fetch(`/api/project-details/${encodeURIComponent(key)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(await res.text())
      setDetailCache(p => ({ ...p, [key]: { ...(p[key] ?? EMPTY_DETAIL), ...patch } as CCProjectDetail }))
    } finally { setSavingDetail(false) }
  }, [])

  // Acknowledge escalation
  const handleAckEscal = React.useCallback(async (key: string, id: string) => {
    try {
      await fetch(`/api/project-escalations/${encodeURIComponent(key)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, acknowledged_by: "cost_control" }),
      })
      setEscalCache(p => ({
        ...p,
        [key]: (p[key] ?? []).map(e => e.id === id ? { ...e, acknowledged_at: new Date().toISOString() } : e),
      }))
    } catch { /* silent */ }
  }, [])

  // Reactive KPIs (use live costs cache if available, fall back to API total)
  const effectiveCosts = React.useCallback((key: string, fallback: number) =>
    costsCache[key] !== undefined
      ? costsCache[key].reduce((s, c) => s + Number(c.amount), 0)
      : fallback
  , [costsCache])

  const q         = debouncedSearch.toLowerCase().trim()
  const displayed = React.useMemo(() =>
    q ? rows.filter(r =>
      r.po_number?.toLowerCase().includes(q) ||
      r.display_name.toLowerCase().includes(q) ||
      r.customer_name.toLowerCase().includes(q)
    ) : rows
  , [rows, q])

  const kpiContract = displayed.reduce((s, r) => s + r.contractVal, 0)
  const kpiCosts    = displayed.reduce((s, r) => s + effectiveCosts(r.project_key, r.totalCosts), 0)
  const kpiProfit   = kpiContract - kpiCosts
  const kpiMargin   = kpiContract > 0 ? (kpiProfit / kpiContract) * 100 : 0

  const activeRow    = rows.find(r => r.project_key === activeKey)
  const activeDetail = activeKey ? (detailCache[activeKey] ?? EMPTY_DETAIL) : EMPTY_DETAIL
  const activeCosts  = activeKey ? costsCache[activeKey] : undefined
  const activeEscals = activeKey ? (escalCache[activeKey] ?? []).filter(e => !e.acknowledged_at) : []
  const activeActual = activeCosts ? activeCosts.reduce((s, c) => s + Number(c.amount), 0) : (activeRow?.totalCosts ?? 0)
  const activeProfit = (activeRow?.contractVal ?? 0) - activeActual
  const activeMargin = (activeRow?.contractVal ?? 0) > 0 ? (activeProfit / (activeRow?.contractVal ?? 1)) * 100 : 0

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col min-h-0">

          {/* Search + Refresh */}
          <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur-sm px-6 py-3.5 flex items-center gap-4">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-300 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari Berdasarkan Nomor PO Utama..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm placeholder:text-neutral-300 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all" />
              {search && (
                <button type="button" onClick={() => setSearch("")} title="Hapus pencarian" aria-label="Hapus pencarian"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500"><X className="h-4 w-4" /></button>
              )}
            </div>
            <button type="button" onClick={() => loadSummary(true)} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border border-neutral-200 transition-colors flex-shrink-0">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-6 p-6">

            {error && (
              <div className="rounded-xl px-4 py-3 text-xs font-medium bg-red-50 border border-red-200 text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />Gagal memuat: {error}
              </div>
            )}

            {loading && rows.length === 0 && (
              <div className="flex items-center justify-center py-24 text-neutral-400">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" /><span className="text-sm">Memuat data proyek…</span>
              </div>
            )}

            {/* ── Gallery or Focus Mode ── */}
            {!activeKey ? (
              /* Gallery */
              <div className="flex flex-col gap-5">
                {displayed.length > 0 && (
                  <>
                    {/* KPI strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Total Nilai Kontrak", val: fShort(kpiContract), sub: fIDR(kpiContract), color: "text-neutral-800" },
                        { label: "Total Pengeluaran",   val: fShort(kpiCosts),    sub: fIDR(kpiCosts),    color: "text-indigo-600" },
                        { label: "Net Profit Gabungan", val: fShort(kpiProfit),   sub: fIDR(kpiProfit),   color: kpiProfit >= 0 ? "text-emerald-600" : "text-red-500" },
                        { label: "Avg Margin",          val: `${kpiMargin.toFixed(1)}%`, sub: `${displayed.length} proyek`, color: kpiMargin >= 15 ? "text-emerald-600" : kpiMargin >= 0 ? "text-amber-500" : "text-red-500" },
                      ].map(k => (
                        <div key={k.label} className="rounded-xl p-4 bg-white border border-neutral-200">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">{k.label}</p>
                          <p className={`text-2xl font-black tabular-nums leading-none ${k.color}`}>{k.val}</p>
                          <p className="text-[10px] text-neutral-400 mt-1.5 truncate">{k.sub}</p>
                        </div>
                      ))}
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4">
                        {displayed.length} Proyek · Klik kartu untuk buka workspace biaya
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {displayed.map(r => (
                          <CCProjectCard key={r.project_key} row={r} isActive={false}
                            onFocus={() => enterFocus(r.project_key)} />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {!loading && displayed.length === 0 && rows.length > 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Search className="h-8 w-8 text-neutral-200 mb-3" />
                    <p className="text-sm font-medium text-neutral-400">Tidak ada hasil untuk &quot;{debouncedSearch}&quot;</p>
                    <p className="text-xs text-neutral-300 mt-1">Coba nomor PO, nama proyek, atau nama klien.</p>
                  </div>
                )}
              </div>
            ) : (
              /* Focus Mode */
              <div className="flex flex-col gap-5">

                {/* Back + focused card */}
                <div>
                  <button type="button" onClick={() => setActiveKey(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-indigo-600 transition-colors mb-4">
                    <ChevronLeft className="h-4 w-4" /> Semua Proyek
                  </button>
                  {activeRow && (
                    <div className="max-w-xs">
                      <CCProjectCard row={{ ...activeRow, totalCosts: activeActual }} isActive={true} onFocus={() => {}} />
                    </div>
                  )}
                </div>

                {/* ROI Overview Panel */}
                <ROIOverviewPanel
                  contractVal={activeRow?.contractVal ?? 0}
                  actualCosts={activeActual}
                  progress={activeRow?.physical_progress ?? 0}
                  detail={activeDetail}
                />

                {/* VO Escalation alerts */}
                {activeEscals.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {activeEscals.map(esc => (
                      <div key={esc.id} className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border ${
                        esc.escalation_type === "vo_budget_exceeded"
                          ? "bg-red-50 border-red-200"
                          : "bg-amber-50 border-amber-200"
                      }`}>
                        <Bell className={`h-4 w-4 flex-shrink-0 mt-0.5 ${esc.escalation_type === "vo_budget_exceeded" ? "text-red-500" : "text-amber-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold ${esc.escalation_type === "vo_budget_exceeded" ? "text-red-700" : "text-amber-700"}`}>
                            {esc.escalation_type === "vo_budget_exceeded" ? "⚠ Biaya VO Melebihi Anggaran (100%+)" : "⚠ Biaya VO Mendekati Batas (≥80%)"}
                          </p>
                          <p className="text-[11px] text-neutral-500 mt-0.5">{esc.notes}</p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">
                            {new Date(esc.triggered_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                        <button type="button" onClick={() => activeKey && handleAckEscal(activeKey, esc.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-50 flex-shrink-0 transition-colors">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Loading indicator for workspace data */}
                {loadingKeys[activeKey] && (
                  <div className="flex items-center justify-center py-8 gap-2 text-neutral-400 text-sm">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Memuat data workspace…
                  </div>
                )}

                {!loadingKeys[activeKey] && (
                  <>
                    {/* Budget Plafon — input form */}
                    <BudgetPlafonSection
                      projectKey={activeKey}
                      detail={activeDetail}
                      costs={activeCosts ?? []}
                      contractVal={activeRow?.contractVal ?? 0}
                      saving={savingDetail}
                      onSave={patch => handleSaveDetail(activeKey, patch)}
                    />

                    {/* Budget vs Actual comparison matrix */}
                    <BudgetActualMatrix
                      detail={activeDetail}
                      costs={activeCosts ?? []}
                      contractVal={activeRow?.contractVal ?? 0}
                    />

                    {/* Realisasi Biaya */}
                    <RealisasiBiayaSection
                      projectKey={activeKey}
                      costs={activeCosts}
                      loading={loadingKeys[activeKey] ?? false}
                      onItemAdded={item => setCostsCache(p => ({ ...p, [activeKey]: [...(p[activeKey] ?? []), item] }))}
                      onItemSaved={(id, patch) => setCostsCache(p => ({ ...p, [activeKey]: (p[activeKey] ?? []).map(c => c.id === id ? { ...c, ...patch } : c) }))}
                      onItemDeleted={id => setCostsCache(p => ({ ...p, [activeKey]: (p[activeKey] ?? []).filter(c => c.id !== id) }))}
                    />
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
