"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  RefreshCw, Lock, CheckCircle2, TrendingUp, TrendingDown, Minus,
  FolderOpen, ChevronDown, ChevronRight, FileText, DollarSign, BarChart2,
  Circle, CheckCircle,
} from "lucide-react"
import type { ExecProjectRow } from "@/app/api/executive-summary/route"

// ─── Types ────────────────────────────────────────────────────────────────────
type TerminEntry = { id: string; nama: string; target_progres: number; persen_tagihan?: number }
type Phase = {
  id: string; project_key: string; task_description: string
  week_number: number; end_week?: number; progress_weight: number
  is_done: boolean; completed_at?: string; created_at: string
}
type WeekLog = {
  id: string; project_key: string; week_number: number
  description: string; photo_url?: string; progress_pct?: number; created_at: string
}
type ProjectDetail = {
  project_key: string
  op_gaji?: number; op_material?: number; op_transport?: number
  op_operasional?: number; op_sewa?: number; op_lainnya?: number
  op_vo_gaji?: number; op_vo_material?: number; op_vo_transport?: number
  op_vo_operasional?: number; op_vo_sewa?: number; op_vo_lainnya?: number
  termin_schedule?: TerminEntry[]
}
type ExpandedData = { phases: Phase[]; logs: WeekLog[]; detail: ProjectDetail | null }

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

function resolveFinance(row: ExecProjectRow): {
  state: "TERKUNCI" | "SIAP_TAGIH" | "LUNAS"
  label: string; sub: string; bg: string; text: string; border: string
} {
  if (row.project_status === "SELESAI")
    return { state: "LUNAS", label: "LUNAS", sub: "Proyek selesai", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" }
  if (row.financeStatus === "READY") {
    const sub = row.unlockedTermins.length > 0 ? row.unlockedTermins.slice(0, 2).join(", ") : "Progres memenuhi syarat tagih"
    return { state: "SIAP_TAGIH", label: "SIAP TAGIH", sub, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" }
  }
  return { state: "TERKUNCI", label: "TERKUNCI", sub: `Progres ${row.physical_progress}% belum cukup`, bg: "bg-neutral-100", text: "text-neutral-500", border: "border-neutral-200" }
}

// ─── Micro components ─────────────────────────────────────────────────────────
function MicroBar({ pct, color = "bg-indigo-500" }: { pct: number; color?: string }) {
  return (
    <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  )
}

function FinancePill({ row }: { row: ExecProjectRow }) {
  const f = resolveFinance(row)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${f.bg} ${f.text} ${f.border}`}>
      {f.state === "TERKUNCI" ? <Lock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
      {f.label}
    </span>
  )
}

// ─── Accordion tab: Doc Con ───────────────────────────────────────────────────
function AccordionDocCon({ data }: { data: ExpandedData | undefined }) {
  if (!data)
    return <div className="py-6 text-center text-xs text-neutral-400"><RefreshCw className="h-3 w-3 animate-spin inline mr-1" />Memuat…</div>

  const { phases, logs } = data
  const done     = phases.filter(p => p.is_done).length
  const totalW   = phases.reduce((s, p) => s + p.progress_weight, 0)
  const doneW    = phases.filter(p => p.is_done).reduce((s, p) => s + p.progress_weight, 0)
  const progress = totalW > 0 ? Math.round(doneW / totalW * 100) : 0
  const recent   = [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 4)

  return (
    <div className="grid grid-cols-2 gap-6 p-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-3">
          Fase Jadwal ({done}/{phases.length})
        </p>
        {phases.length === 0
          ? <p className="text-xs text-neutral-300">Belum ada fase.</p>
          : (
            <div className="space-y-2">
              {phases.slice(0, 6).map(p => (
                <div key={p.id} className="flex items-start gap-2">
                  {p.is_done
                    ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    : <Circle      className="h-3.5 w-3.5 text-neutral-300 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${p.is_done ? "text-neutral-400 line-through" : "text-neutral-700"}`}>
                      {p.task_description}
                    </p>
                    <p className="text-[10px] text-neutral-300">
                      W{p.week_number}{p.end_week && p.end_week > p.week_number ? `–W${p.end_week}` : ""} · {p.progress_weight}%
                    </p>
                  </div>
                </div>
              ))}
              {phases.length > 6 && <p className="text-[10px] text-neutral-300 pl-5">+{phases.length - 6} fase lainnya</p>}
            </div>
          )}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-neutral-400">Bobot terselesaikan</span>
            <span className="text-[10px] font-bold text-indigo-600">{progress}%</span>
          </div>
          <MicroBar pct={progress} color={progress >= 80 ? "bg-emerald-500" : progress >= 40 ? "bg-indigo-500" : "bg-amber-400"} />
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-3">
          Log Terbaru ({logs.length} total)
        </p>
        {recent.length === 0
          ? <p className="text-xs text-neutral-300">Belum ada log.</p>
          : (
            <div className="space-y-2">
              {recent.map(l => (
                <div key={l.id} className="border border-neutral-100 rounded-lg p-2.5 bg-neutral-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-neutral-400">W{l.week_number}</span>
                    {l.progress_pct !== undefined && (
                      <span className="text-[10px] font-bold text-indigo-600">{l.progress_pct}%</span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-600 line-clamp-2">
                    {l.description || <span className="text-neutral-300 italic">Belum ada catatan.</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}

// ─── Accordion tab: Cost Control ─────────────────────────────────────────────
function AccordionCostControl({ row, data }: { row: ExecProjectRow; data: ExpandedData | undefined }) {
  if (!data)
    return <div className="py-6 text-center text-xs text-neutral-400"><RefreshCw className="h-3 w-3 animate-spin inline mr-1" />Memuat…</div>

  const d = data.detail
  const cats = d ? [
    { label: "Gaji & Upah",  main: d.op_gaji ?? 0,        vo: d.op_vo_gaji ?? 0 },
    { label: "Material",     main: d.op_material ?? 0,     vo: d.op_vo_material ?? 0 },
    { label: "Transport",    main: d.op_transport ?? 0,    vo: d.op_vo_transport ?? 0 },
    { label: "Operasional",  main: d.op_operasional ?? 0,  vo: d.op_vo_operasional ?? 0 },
    { label: "Sewa Alat",    main: d.op_sewa ?? 0,         vo: d.op_vo_sewa ?? 0 },
    { label: "Lain-lain",    main: d.op_lainnya ?? 0,      vo: d.op_vo_lainnya ?? 0 },
  ] : []

  const profitColor = row.netProfit >= 0 ? "text-emerald-600" : "text-red-500"

  return (
    <div className="p-4">
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Nilai Kontrak", val: fShort(row.contractVal), sub: row.contractVal > 0 ? fIDR(row.contractVal) : "—",     color: "text-neutral-800" },
          { label: "Total Biaya",   val: fShort(row.totalCosts),  sub: fIDR(row.totalCosts),                                   color: "text-neutral-700" },
          { label: "Net Profit",    val: fShort(row.netProfit),   sub: `Margin ${row.netMargin.toFixed(1)}%`,                  color: profitColor },
        ].map(k => (
          <div key={k.label} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-base font-black tabular-nums ${k.color}`}>{k.val}</p>
            <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{k.sub}</p>
          </div>
        ))}
      </div>

      {cats.some(c => c.main + c.vo > 0) && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Rincian Biaya</p>
            <span className="flex items-center gap-1 text-[10px] text-neutral-400">
              <span className="w-2 h-2 rounded-sm bg-indigo-400 inline-block" />PO Utama
            </span>
            <span className="flex items-center gap-1 text-[10px] text-neutral-400">
              <span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />Kerja Tambah
            </span>
          </div>
          <div className="space-y-1.5">
            {cats.filter(c => c.main + c.vo > 0).map(c => {
              const pctMain = row.totalCosts > 0 ? (c.main / row.totalCosts) * 100 : 0
              const pctVo   = row.totalCosts > 0 ? (c.vo   / row.totalCosts) * 100 : 0
              return (
                <div key={c.label} className="flex items-center gap-3">
                  <p className="text-[11px] text-neutral-500 w-28 flex-shrink-0">{c.label}</p>
                  <div className="flex-1 h-3 bg-neutral-100 rounded-full overflow-hidden flex">
                    {pctMain > 0 && <div className="h-full bg-indigo-400" style={{ width: `${pctMain}%` }} />}
                    {pctVo   > 0 && <div className="h-full bg-amber-400"  style={{ width: `${pctVo}%`   }} />}
                  </div>
                  <p className="text-[11px] tabular-nums text-neutral-500 w-16 text-right">{fShort(c.main + c.vo)}</p>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Accordion tab: Finance ───────────────────────────────────────────────────
function AccordionFinance({ row, data }: { row: ExecProjectRow; data: ExpandedData | undefined }) {
  if (!data)
    return <div className="py-6 text-center text-xs text-neutral-400"><RefreshCw className="h-3 w-3 animate-spin inline mr-1" />Memuat…</div>

  const finance  = resolveFinance(row)
  const termins  = (data.detail?.termin_schedule ?? []) as TerminEntry[]
  const progress = row.physical_progress

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${finance.bg} ${finance.text} ${finance.border}`}>
          {finance.state === "TERKUNCI" ? <Lock className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {finance.label}
        </span>
        <p className="text-xs text-neutral-400">{finance.sub}</p>
      </div>

      {termins.length === 0 ? (
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 text-center">
          <p className="text-xs text-neutral-400">Belum ada jadwal termin (TOP).</p>
          <p className="text-[10px] text-neutral-300 mt-1">Atur di halaman detail proyek → Finance → TOP Schedule.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Jadwal Termin Pembayaran</p>
          {termins.map((t, i) => {
            const unlocked  = progress >= t.target_progres
            const tagihan   = t.persen_tagihan ?? null
            const amountEst = tagihan !== null ? row.contractVal * tagihan / 100 : null
            return (
              <div key={t.id} className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${unlocked ? "border-emerald-200 bg-emerald-50" : "border-neutral-100 bg-neutral-50"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${unlocked ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-500"}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${unlocked ? "text-emerald-700" : "text-neutral-600"}`}>{t.nama}</p>
                  <p className="text-[10px] text-neutral-400">
                    Trigger: progres ≥ {t.target_progres}%{tagihan !== null ? ` · ${tagihan}% kontrak` : ""}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {amountEst !== null && (
                    <p className={`text-xs font-bold tabular-nums ${unlocked ? "text-emerald-700" : "text-neutral-500"}`}>{fShort(amountEst)}</p>
                  )}
                  {unlocked
                    ? <p className="text-[10px] text-emerald-500 font-medium">TERBUKA</p>
                    : <p className="text-[10px] text-neutral-300">+{t.target_progres - progress}% lagi</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Inline accordion wrapper ─────────────────────────────────────────────────
function ExpandedRow({
  row, data, activeTab, onTabChange,
}: {
  row:        ExecProjectRow
  data:       ExpandedData | undefined
  activeTab:  "doccon" | "cost" | "finance"
  onTabChange: (tab: "doccon" | "cost" | "finance") => void
}) {
  const tabs: { id: "doccon" | "cost" | "finance"; label: string; icon: React.ReactNode }[] = [
    { id: "doccon",  label: "Doc Con",      icon: <FileText   className="h-3 w-3" /> },
    { id: "cost",    label: "Cost Control", icon: <BarChart2  className="h-3 w-3" /> },
    { id: "finance", label: "Finance",      icon: <DollarSign className="h-3 w-3" /> },
  ]
  return (
    <div className="bg-white border-t border-neutral-100">
      <div className="flex gap-0 border-b border-neutral-100 px-4">
        {tabs.map(t => (
          <button key={t.id} type="button" onClick={() => onTabChange(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-indigo-500 text-indigo-700"
                : "border-transparent text-neutral-400 hover:text-neutral-600"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <div className="min-h-[100px]">
        {activeTab === "doccon"  && <AccordionDocCon      data={data} />}
        {activeTab === "cost"    && <AccordionCostControl row={row} data={data} />}
        {activeTab === "finance" && <AccordionFinance     row={row} data={data} />}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ExecutiveViewPage() {
  const [rows, setRows]       = React.useState<ExecProjectRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError]     = React.useState<string | null>(null)
  const [lastAt, setLastAt]   = React.useState<Date | null>(null)
  const [filter, setFilter]   = React.useState<"all" | "BERJALAN" | "SELESAI">("all")

  const [expanded,  setExpanded]  = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<Record<string, "doccon" | "cost" | "finance">>({})
  const [cache,     setCache]     = React.useState<Record<string, ExpandedData>>({})

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/executive-summary", { cache: "no-store" })
      if (!res.ok) throw new Error(await res.text())
      setRows((await res.json()).data ?? [])
      setLastAt(new Date())
    } catch (e) { setError(String(e)) }
    finally     { if (!silent) setLoading(false) }
  }, [])

  React.useEffect(() => { load() }, [load])

  React.useEffect(() => {
    const id = setInterval(() => load(true), 30_000)
    return () => clearInterval(id)
  }, [load])

  const expandRow = React.useCallback(async (key: string) => {
    if (expanded === key) { setExpanded(null); return }
    setExpanded(key)
    setActiveTab(prev => prev[key] ? prev : { ...prev, [key]: "doccon" })
    if (cache[key]) return
    try {
      const [phasesRes, logsRes, detailRes] = await Promise.all([
        fetch(`/api/project-schedule/${encodeURIComponent(key)}`),
        fetch(`/api/project-weekly-logs/${encodeURIComponent(key)}`),
        fetch(`/api/project-details/${encodeURIComponent(key)}`),
      ])
      const phases = phasesRes.ok  ? ((await phasesRes.json()).data  ?? []) as Phase[]          : []
      const logs   = logsRes.ok    ? ((await logsRes.json()).data    ?? []) as WeekLog[]         : []
      const detail = detailRes.ok  ? ((await detailRes.json()).data  ?? null) as ProjectDetail | null : null
      setCache(prev => ({ ...prev, [key]: { phases, logs, detail } }))
    } catch {
      setCache(prev => ({ ...prev, [key]: { phases: [], logs: [], detail: null } }))
    }
  }, [expanded, cache])

  const withActivity = rows.filter(r => r.has_doc_con_data)
  const displayed    = withActivity.filter(r => filter === "all" || r.project_status === filter)
  const totalProjects = displayed.length
  const readyCount    = displayed.filter(r => r.financeStatus === "READY" || r.project_status === "SELESAI").length
  const avgProgress   = totalProjects > 0
    ? Math.round(displayed.reduce((s, r) => s + r.physical_progress, 0) / totalProjects) : 0
  const totalProfit   = displayed.reduce((s, r) => s + r.netProfit, 0)

  const COLS = "minmax(200px,2.5fr) minmax(130px,1fr) minmax(200px,1.5fr) 160px"

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-1 flex-col gap-6 p-6">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-lg font-bold text-neutral-900 tracking-tight">Bos View</h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Ringkasan eksekutif · Hanya proyek dengan aktivitas Doc Con
                {lastAt && (
                  <span className="ml-2 text-neutral-300">
                    · Diperbarui {lastAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-neutral-400">Live 30s</span>
              </div>
              <button type="button" onClick={() => load()} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border border-neutral-200 transition-colors">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-xs font-medium bg-red-50 border border-red-200 text-red-600">
              Gagal memuat: {error}
            </div>
          )}

          {loading && rows.length === 0 && (
            <div className="flex items-center justify-center py-20 text-neutral-400">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Memuat data…</span>
            </div>
          )}

          {!loading && withActivity.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-28 text-center">
              <div className="w-16 h-16 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-center mb-5">
                <FolderOpen className="h-7 w-7 text-neutral-300" />
              </div>
              <p className="text-sm font-semibold text-neutral-500 mb-1">Belum ada aktivitas Doc Con.</p>
              <p className="text-xs text-neutral-400 max-w-xs">
                Halaman ini aktif setelah tim Doc Con menambahkan Log Mingguan atau Jadwal untuk proyek manapun.
              </p>
            </div>
          )}

          {!loading && displayed.length > 0 && (
            <>
              {/* KPI strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Proyek Aktif",    val: String(totalProjects), sub: "dengan aktivitas Doc Con",              color: "text-indigo-600" },
                  { label: "Avg Progres",      val: `${avgProgress}%`,    sub: "rata-rata fisik lapangan",               color: avgProgress >= 80 ? "text-emerald-600" : avgProgress >= 40 ? "text-amber-500" : "text-red-500" },
                  { label: "Siap / Lunas",     val: String(readyCount),   sub: `${totalProjects - readyCount} terkunci`, color: "text-emerald-600" },
                  { label: "Net Profit Total", val: fShort(totalProfit),  sub: totalProfit >= 0 ? "surplus gabungan" : "defisit gabungan", color: totalProfit >= 0 ? "text-emerald-600" : "text-red-500" },
                ].map(k => (
                  <div key={k.label} className="rounded-xl p-4 bg-white border border-neutral-200">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">{k.label}</p>
                    <p className={`text-2xl font-black tabular-nums leading-none ${k.color}`}>{k.val}</p>
                    <p className="text-[10px] text-neutral-400 mt-1.5">{k.sub}</p>
                  </div>
                ))}
              </div>

              {/* Filter tabs */}
              <div className="flex gap-1 p-1 rounded-lg bg-neutral-100 w-fit">
                {(["all", "BERJALAN", "SELESAI"] as const).map(f => (
                  <button key={f} type="button" onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      filter === f ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                    }`}>
                    {f === "all" ? "Semua" : f}
                  </button>
                ))}
              </div>

              {/* Relation table */}
              <div className="rounded-xl overflow-hidden border border-neutral-200 bg-white">
                {/* Header */}
                <div className="grid px-5 py-3 bg-neutral-50 border-b border-neutral-200"
                  style={{ gridTemplateColumns: COLS, columnGap: 16 }}>
                  {[
                    { label: "Nama Proyek",  icon: <FolderOpen   className="h-3 w-3" /> },
                    { label: "Doc Con",      icon: <FileText     className="h-3 w-3" /> },
                    { label: "Cost Control", icon: <TrendingUp   className="h-3 w-3" /> },
                    { label: "Finance",      icon: <CheckCircle2 className="h-3 w-3" /> },
                  ].map(h => (
                    <div key={h.label} className="flex items-center gap-1.5">
                      <span className="text-neutral-300">{h.icon}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{h.label}</span>
                    </div>
                  ))}
                </div>

                {/* Data rows */}
                <div className="divide-y divide-neutral-100">
                  {displayed.map(row => {
                    const isOpen      = expanded === row.project_key
                    const profitColor = row.netProfit >= 0 ? "text-emerald-600" : "text-red-500"
                    const marginBg    = row.netMargin >= 15 ? "bg-emerald-50 text-emerald-700" : row.netMargin >= 0 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"
                    const pctColor    = row.physical_progress >= 80 ? "bg-emerald-500" : row.physical_progress >= 40 ? "bg-indigo-500" : "bg-amber-400"
                    const pctText     = row.physical_progress >= 80 ? "text-emerald-600" : row.physical_progress >= 40 ? "text-indigo-600" : "text-amber-600"
                    return (
                      <div key={row.project_key}>
                        {/* Summary row */}
                        <div
                          className={`grid px-5 py-4 items-center cursor-pointer transition-colors select-none ${isOpen ? "bg-indigo-50/60" : "hover:bg-neutral-50"}`}
                          style={{ gridTemplateColumns: COLS, columnGap: 16 }}
                          onClick={() => expandRow(row.project_key)}>

                          {/* Col 1 – Nama Proyek */}
                          <div className="min-w-0 flex items-start gap-2">
                            <div className="pt-0.5 flex-shrink-0">
                              {isOpen
                                ? <ChevronDown  className="h-4 w-4 text-indigo-500" />
                                : <ChevronRight className="h-4 w-4 text-neutral-300" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-800 truncate" title={row.display_name}>{row.display_name}</p>
                              {row.customer_name && <p className="text-[11px] text-neutral-400 truncate">{row.customer_name}</p>}
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  row.project_status === "SELESAI" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-600"
                                }`}>{row.project_status}</span>
                                <span className="text-[9px] text-neutral-300">{row.log_count} log · {row.sched_count} fase</span>
                              </div>
                            </div>
                          </div>

                          {/* Col 2 – Doc Con */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pctColor}`} style={{ width: `${row.physical_progress}%` }} />
                              </div>
                              <span className={`text-[11px] font-bold tabular-nums w-8 text-right flex-shrink-0 ${pctText}`}>
                                {row.physical_progress}%
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-300">{row.log_count} log · {row.sched_count} fase</p>
                          </div>

                          {/* Col 3 – Cost Control */}
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {row.netProfit > 0
                                ? <TrendingUp   className={`h-3.5 w-3.5 ${profitColor}`} />
                                : row.netProfit < 0
                                  ? <TrendingDown className={`h-3.5 w-3.5 ${profitColor}`} />
                                  : <Minus        className={`h-3.5 w-3.5 ${profitColor}`} />}
                              <span className={`text-sm font-bold tabular-nums ${profitColor}`}>{fShort(row.netProfit)}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums ${marginBg}`}>
                                {row.netMargin >= 0 ? "+" : ""}{row.netMargin.toFixed(1)}%
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-400">
                              Kontrak: {fShort(row.contractVal)} · Biaya: {fShort(row.totalCosts)}
                            </p>
                          </div>

                          {/* Col 4 – Finance */}
                          <div>
                            <FinancePill row={row} />
                            {row.unlockedTermins.length > 0 && (
                              <p className="text-[10px] mt-1 text-emerald-600 leading-snug truncate">
                                {row.unlockedTermins.slice(0, 2).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Inline accordion */}
                        {isOpen && (
                          <ExpandedRow
                            row={row}
                            data={cache[row.project_key]}
                            activeTab={activeTab[row.project_key] ?? "doccon"}
                            onTabChange={tab => setActiveTab(prev => ({ ...prev, [row.project_key]: tab }))}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <p className="text-[10px] text-center text-neutral-200">
                Hanya proyek dengan aktivitas Doc Con · Net Profit = Nilai Kontrak − Biaya Aktual · Auto-refresh setiap 30 detik
              </p>
            </>
          )}

          {!loading && withActivity.length > 0 && displayed.length === 0 && (
            <p className="text-sm text-center text-neutral-400 py-12">
              Tidak ada proyek &quot;{filter}&quot; dengan aktivitas Doc Con.
            </p>
          )}

        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
