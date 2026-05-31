"use client"

import * as React       from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar }   from "@/components/app-sidebar"
import { SiteHeader }   from "@/components/site-header"
import {
  RefreshCw, Search, Lock, CheckCircle2, TrendingUp, TrendingDown,
  AlertTriangle, X, Minus, FolderOpen,
} from "lucide-react"
import type { ExecProjectRow } from "@/app/api/executive-summary/route"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fShort = (n: number): string => {
  const abs  = Math.abs(n)
  const sign = n < 0 ? "−" : ""
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000)     return `${sign}${(abs / 1_000_000).toFixed(1)}Jt`
  if (abs >= 1_000)         return `${sign}${(abs / 1_000).toFixed(0)}Rb`
  return `${sign}${Math.round(abs)}`
}

const fIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

function relTime(iso: string | null | undefined): string {
  if (!iso) return "Never updated"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000)             return "Last updated was just now"
  if (ms < 3_600_000)          return `Last updated was ${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000)         return `Last updated was ${Math.floor(ms / 3_600_000)}h ago`
  if (ms < 7 * 86_400_000)     return `Last updated was ${Math.floor(ms / 86_400_000)}d ago`
  return `Last updated ${new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`
}

function dueBadge(due: string | null | undefined): { label: string; cls: string } | null {
  if (!due) return null
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000)
  if (days < 0)  return { label: `Terlambat ${Math.abs(days)}h`,  cls: "bg-red-50 text-red-600 border-red-200" }
  if (days <= 14) return { label: `Due ${days}h lagi`,             cls: "bg-amber-50 text-amber-600 border-amber-200" }
  return { label: new Date(due).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" }), cls: "bg-neutral-50 text-neutral-400 border-neutral-200" }
}

function useDebounce<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value)
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

// ─── Margin safety thresholds (matches cost-control safety logic) ─────────────

type SafetyTier = { label: string; accent: string; bg: string; text: string; ring: string }

function marginTier(m: number): SafetyTier {
  if (m >= 15) return { label: "AMAN",    accent: "bg-emerald-500", bg: "bg-emerald-50",  text: "text-emerald-700", ring: "ring-emerald-200" }
  if (m >= 5)  return { label: "WASPADA", accent: "bg-amber-400",   bg: "bg-amber-50",    text: "text-amber-700",   ring: "ring-amber-200"   }
  if (m >= 0)  return { label: "KRITIS",  accent: "bg-orange-400",  bg: "bg-orange-50",   text: "text-orange-700",  ring: "ring-orange-200"  }
  return              { label: "RUGI",    accent: "bg-red-500",     bg: "bg-red-50",      text: "text-red-700",     ring: "ring-red-200"     }
}

// ─── Finance status resolver ──────────────────────────────────────────────────

type FinState = { label: string; bg: string; text: string; border: string; icon: React.ReactNode }

function financeState(row: ExecProjectRow): FinState {
  if (row.project_status === "SELESAI")
    return { label: "LUNAS",      bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> }
  if (row.financeStatus === "READY")
    return { label: "SIAP TAGIH", bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   icon: <CheckCircle2 className="h-3 w-3" /> }
  return   { label: "TERKUNCI",   bg: "bg-neutral-100",text: "text-neutral-500", border: "border-neutral-200", icon: <Lock         className="h-3 w-3" /> }
}

// ─── Micro progress bar ───────────────────────────────────────────────────────

function MicroBar({ pct, accent }: { pct: number; accent: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${accent}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

// ─── Executive Project Card ───────────────────────────────────────────────────

function ExecCard({ row }: { row: ExecProjectRow }) {
  const mt  = marginTier(row.netMargin)
  const fin = financeState(row)

  // Progress pillar colors
  const progAccent =
    row.physical_progress >= 80 ? "bg-emerald-500" :
    row.physical_progress >= 40 ? "bg-indigo-500"  : "bg-amber-400"
  const progText =
    row.physical_progress >= 80 ? "text-emerald-600" :
    row.physical_progress >= 40 ? "text-indigo-600"  : "text-amber-500"

  // Profit icon
  const ProfitIcon =
    row.netProfit > 0 ? TrendingUp :
    row.netProfit < 0 ? TrendingDown : Minus
  const profitText = row.netProfit >= 0 ? "text-emerald-600" : "text-red-500"

  return (
    <div className={`
      relative flex flex-col bg-white rounded-2xl border border-neutral-200
      overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200
      ring-1 ${mt.ring} ring-opacity-40
    `}>
      {/* Left accent bar — margin safety at a glance */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${mt.accent}`} />

      {/* ── Header ── */}
      <div className="pl-4 pr-4 pt-4 pb-3 border-b border-neutral-50">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
            row.project_status === "SELESAI"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-blue-50 text-blue-600"
          }`}>
            {row.project_status}
          </span>
          <div className="flex items-center gap-1.5">
            {(() => { const d = dueBadge(row.due_date); return d ? <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${d.cls}`}>{d.label}</span> : null })()}
            {row.po_number && (
              <span className="text-[9px] font-mono text-neutral-300 truncate max-w-[80px]" title={row.po_number}>
                {row.po_number}
              </span>
            )}
          </div>
        </div>
        <h3 className="text-sm font-bold text-neutral-900 line-clamp-2 leading-snug mb-0.5">
          {row.display_name}
        </h3>
        <p className="text-[11px] text-neutral-400 truncate">{row.customer_name || "—"}</p>
      </div>

      {/* ── Three Sacred Pillars ── */}
      <div className="pl-4 pr-4 pt-3.5 pb-4 flex flex-col gap-3.5 flex-1">

        {/* Pillar 1 — Progress (Doc Con) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">
              Progres Fisik
            </span>
            <span className={`text-xs font-black tabular-nums ${progText}`}>
              {row.physical_progress}%
            </span>
          </div>
          <MicroBar pct={row.physical_progress} accent={progAccent} />
        </div>

        {/* Pillar 2 — Profitability (Cost Control) */}
        <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${mt.bg}`}>
          <div>
            <p className={`text-[9px] font-black uppercase tracking-widest ${mt.text} opacity-70`}>
              Net Margin
            </p>
            <p className={`text-[9px] ${mt.text} opacity-60 tabular-nums`}>
              {fShort(row.contractVal)} → {fShort(row.totalCosts)}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-xl font-black tabular-nums leading-none ${mt.text}`}>
              {row.netMargin >= 0 ? "+" : ""}{row.netMargin.toFixed(1)}%
            </p>
            <p className={`text-[10px] tabular-nums font-semibold ${mt.text} opacity-75 flex items-center justify-end gap-0.5 mt-0.5`}>
              <ProfitIcon className="h-2.5 w-2.5" />
              {fShort(row.netProfit)}
            </p>
          </div>
        </div>

        {/* Pillar 3 — Collection (Finance) */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">
            Status Tagihan
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${fin.bg} ${fin.text} ${fin.border}`}>
            {fin.icon}
            {fin.label}
          </span>
        </div>

        {/* Unlocked termins hint */}
        {row.unlockedTermins.length > 0 && (
          <p className="text-[10px] text-emerald-600 font-medium leading-tight truncate -mt-1">
            ↳ {row.unlockedTermins.slice(0, 2).join(" · ")}
            {row.unlockedTermins.length > 2 && ` +${row.unlockedTermins.length - 2}`}
          </p>
        )}
      </div>

      {/* ── Footer meta ── */}
      <div className="pl-4 pr-4 pb-3 flex items-center justify-between border-t border-neutral-50 pt-2.5">
        <span className="text-[9px] text-neutral-300 tabular-nums" title={row.last_updated_at ?? undefined}>
          {relTime(row.last_updated_at)}
        </span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${mt.bg} ${mt.text}`}>
          {mt.label}
        </span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExecutiveViewPage() {
  const [rows,    setRows]    = React.useState<ExecProjectRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error,   setError]   = React.useState<string | null>(null)
  const [lastAt,  setLastAt]  = React.useState<Date | null>(null)

  const [statusFilter, setStatusFilter] = React.useState<"all" | "BERJALAN" | "SELESAI">("all")
  const [marginFilter, setMarginFilter] = React.useState<"all" | "safe" | "warn" | "loss">("all")
  const [search,       setSearch]       = React.useState("")
  const debouncedSearch                 = useDebounce(search, 300)

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const lastFetchAt = React.useRef(0)

  const load = React.useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetchAt.current < 30_000) return
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/executive-summary")
      if (!res.ok) throw new Error(await res.text())
      setRows((await res.json()).data ?? [])
      lastFetchAt.current = Date.now()
      setLastAt(new Date())
    } catch (e) { setError(String(e)) }
    finally     { setLoading(false) }
  }, [])

  React.useEffect(() => { load() }, [load])

  // Auto-refresh every 30s
  React.useEffect(() => {
    const id = setInterval(() => load(true), 30_000)
    return () => clearInterval(id)
  }, [load])

  // ── Client-side filters (zero DB calls) ────────────────────────────────────
  const active = rows.filter(r => r.has_doc_con_data)

  const displayed = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim()
    return active.filter(r => {
      if (statusFilter !== "all" && r.project_status !== statusFilter) return false
      if (marginFilter === "safe" && r.netMargin < 15)  return false
      if (marginFilter === "warn" && (r.netMargin >= 15 || r.netMargin < 0)) return false
      if (marginFilter === "loss" && r.netMargin >= 0)  return false
      if (q && !r.display_name.toLowerCase().includes(q) &&
               !r.customer_name.toLowerCase().includes(q) &&
               !(r.po_number?.toLowerCase().includes(q))) return false
      return true
    })
  }, [active, statusFilter, marginFilter, debouncedSearch])

  // ── Aggregate KPIs (client-side, no DB) ────────────────────────────────────
  const n = displayed.length
  const avgProg    = n > 0 ? Math.round(displayed.reduce((s, r) => s + r.physical_progress, 0) / n) : 0
  const totalProfit = displayed.reduce((s, r) => s + r.netProfit, 0)
  const readyCount  = displayed.filter(r => r.financeStatus === "READY" || r.project_status === "SELESAI").length
  const avgMargin   = n > 0 ? displayed.reduce((s, r) => s + r.netMargin, 0) / n : 0

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-5 p-6">

          {/* ── Page header ── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-lg font-black text-neutral-900 tracking-tight">
                Bos View
              </h1>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                3 Pilar Eksekutif · Progres · Profitabilitas · Tagihan
                {lastAt && (
                  <span className="ml-2 text-neutral-300">
                    · {lastAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live 30s
              </span>
              <button type="button" onClick={() => load(true)} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border border-neutral-200 transition-colors">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 text-xs font-medium bg-red-50 border border-red-200 text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> Gagal memuat: {error}
            </div>
          )}

          {/* Initial load */}
          {loading && rows.length === 0 && (
            <div className="flex items-center justify-center py-24 text-neutral-400">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Memuat data eksekutif…</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && active.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-28 text-center">
              <div className="w-16 h-16 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-center mb-5">
                <FolderOpen className="h-7 w-7 text-neutral-300" />
              </div>
              <p className="text-sm font-semibold text-neutral-500 mb-1">Belum ada aktivitas Doc Con.</p>
              <p className="text-[11px] text-neutral-400 max-w-xs">
                Halaman ini aktif setelah tim Doc Con menambahkan log atau jadwal.
              </p>
            </div>
          )}

          {active.length > 0 && (
            <>
              {/* ── KPI strip (always visible, always client-side) ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Proyek Aktif",
                    val:   String(n),
                    sub:   `dari ${active.length} total`,
                    color: "text-indigo-600",
                  },
                  {
                    label: "Avg Progres",
                    val:   `${avgProg}%`,
                    sub:   "rata-rata fisik lapangan",
                    color: avgProg >= 80 ? "text-emerald-600" : avgProg >= 40 ? "text-amber-500" : "text-red-500",
                  },
                  {
                    label: "Siap / Lunas",
                    val:   String(readyCount),
                    sub:   `${n - readyCount} terkunci`,
                    color: "text-emerald-600",
                  },
                  {
                    label: "Avg Margin",
                    val:   `${avgMargin >= 0 ? "+" : ""}${avgMargin.toFixed(1)}%`,
                    sub:   `Profit: ${fShort(totalProfit)}`,
                    color: avgMargin >= 15 ? "text-emerald-600" : avgMargin >= 0 ? "text-amber-500" : "text-red-500",
                  },
                ].map(k => (
                  <div key={k.label} className="rounded-xl p-4 bg-white border border-neutral-200">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">{k.label}</p>
                    <p className={`text-2xl font-black tabular-nums leading-none ${k.color}`}>{k.val}</p>
                    <p className="text-[10px] text-neutral-400 mt-1.5 truncate">{k.sub}</p>
                  </div>
                ))}
              </div>

              {/* ── Filter bar ── */}
              <div className="flex flex-wrap items-center gap-3">

                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-300 pointer-events-none" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Cari proyek atau klien…"
                    title="Cari proyek atau klien"
                    aria-label="Cari proyek atau klien"
                    className="w-full pl-9 pr-8 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-xs placeholder:text-neutral-300 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch("")}
                      title="Hapus pencarian" aria-label="Hapus pencarian"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Status filter */}
                <div className="flex gap-0.5 p-0.5 rounded-lg bg-neutral-100">
                  {(["all", "BERJALAN", "SELESAI"] as const).map(f => (
                    <button key={f} type="button" onClick={() => setStatusFilter(f)}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                        statusFilter === f ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                      }`}>
                      {f === "all" ? "Semua Status" : f}
                    </button>
                  ))}
                </div>

                {/* Margin filter */}
                <div className="flex gap-0.5 p-0.5 rounded-lg bg-neutral-100">
                  {([
                    { key: "all",  label: "Semua Margin" },
                    { key: "safe", label: "Aman ≥15%" },
                    { key: "warn", label: "Waspada" },
                    { key: "loss", label: "Rugi" },
                  ] as const).map(f => (
                    <button key={f.key} type="button" onClick={() => setMarginFilter(f.key)}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                        marginFilter === f.key
                          ? f.key === "safe" ? "bg-emerald-500 text-white shadow-sm"
                          : f.key === "warn" ? "bg-amber-400 text-white shadow-sm"
                          : f.key === "loss" ? "bg-red-500 text-white shadow-sm"
                          : "bg-white text-neutral-800 shadow-sm"
                          : "text-neutral-500 hover:text-neutral-700"
                      }`}>
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Active filter count */}
                <p className="text-[11px] text-neutral-400 ml-auto tabular-nums">
                  {displayed.length} proyek
                </p>
              </div>

              {/* ── No filter results ── */}
              {displayed.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="h-7 w-7 text-neutral-200 mb-3" />
                  <p className="text-sm font-medium text-neutral-400">Tidak ada proyek yang cocok.</p>
                  <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); setMarginFilter("all") }}
                    className="text-xs text-indigo-500 mt-2 hover:underline">
                    Reset filter
                  </button>
                </div>
              )}

              {/* ── 4-column Executive Card Grid ── */}
              {displayed.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {displayed.map(row => (
                    <ExecCard key={row.project_key} row={row} />
                  ))}
                </div>
              )}

              <p className="text-[10px] text-center text-neutral-200 pb-2">
                Net Profit = Nilai Kontrak − Biaya Aktual · Auto-refresh 30s · Garis kiri = status margin
              </p>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
