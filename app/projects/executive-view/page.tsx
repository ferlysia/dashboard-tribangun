"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { RefreshCw, Lock, CheckCircle2, TrendingUp, TrendingDown, Minus, FolderOpen } from "lucide-react"
import type { ExecProjectRow } from "@/app/api/executive-summary/route"

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

// ─── Components ──────────────────────────────────────────────────────────────
function DocConBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-indigo-500" : "bg-amber-400"
  const textColor = pct >= 80 ? "text-emerald-600" : pct >= 40 ? "text-indigo-600" : "text-amber-600"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-[11px] font-bold tabular-nums shrink-0 w-8 text-right ${textColor}`}>
        {Math.round(pct)}%
      </span>
    </div>
  )
}

function FinanceBadge({ status, termins }: { status: "READY" | "LOCKED"; termins: string[] }) {
  if (status === "READY") {
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3" />
          SIAP DITAGIH
        </span>
        {termins.length > 0 && (
          <p className="text-[10px] mt-1 text-emerald-600 leading-snug">
            {termins.slice(0, 2).join(", ")}
          </p>
        )}
      </div>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-400 border border-neutral-200">
      <Lock className="h-3 w-3" />
      TERKUNCI
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ExecutiveViewPage() {
  const [rows, setRows]       = React.useState<ExecProjectRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError]     = React.useState<string | null>(null)
  const [lastAt, setLastAt]   = React.useState<Date | null>(null)
  const [filter, setFilter]   = React.useState<"all" | "BERJALAN" | "SELESAI">("all")

  const load = React.useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/executive-summary", { cache: "no-store" })
      if (!res.ok) throw new Error(await res.text())
      setRows((await res.json()).data ?? [])
      setLastAt(new Date())
    } catch (e) { setError(String(e)) }
    finally     { setLoading(false) }
  }, [])

  React.useEffect(() => { load() }, [load])

  // Only projects that have Doc Con activity (logs or schedule items)
  const withActivity = rows.filter(r => r.has_doc_con_data)
  const displayed    = withActivity.filter(r => filter === "all" || r.project_status === filter)

  const totalProjects  = displayed.length
  const readyCount     = displayed.filter(r => r.financeStatus === "READY").length
  const avgProgress    = totalProjects > 0
    ? Math.round(displayed.reduce((s, r) => s + r.physical_progress, 0) / totalProjects) : 0
  const totalProfit    = displayed.reduce((s, r) => s + r.netProfit, 0)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-1 flex-col gap-6 p-6">

          {/* Page header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-lg font-bold text-neutral-900 tracking-tight">Bos View</h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Hanya menampilkan proyek yang sudah memiliki aktivitas Document Control.
                {lastAt && <span className="ml-2 text-neutral-300">· {lastAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>}
              </p>
            </div>
            <button type="button" onClick={load} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border border-neutral-200 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 text-xs font-medium bg-red-50 border border-red-200 text-red-600">
              Gagal memuat: {error}
            </div>
          )}

          {/* Loading */}
          {loading && rows.length === 0 && (
            <div className="flex items-center justify-center py-20 text-neutral-400">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Memuat data…</span>
            </div>
          )}

          {/* ── EMPTY STATE: no Doc Con activity at all ── */}
          {!loading && withActivity.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-28 text-center">
              <div className="w-16 h-16 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-center mb-5">
                <FolderOpen className="h-7 w-7 text-neutral-300" />
              </div>
              <p className="text-sm font-semibold text-neutral-500 mb-1">
                Belum ada aktivitas proyek dari Document Control.
              </p>
              <p className="text-xs text-neutral-400 max-w-xs">
                Menunggu input lapangan. Halaman ini akan aktif setelah tim Doc Con menambahkan
                Log Mingguan atau Jadwal &amp; Rencana untuk proyek manapun.
              </p>
            </div>
          )}

          {/* ── KPI strip + table (only when there's data) ── */}
          {!loading && displayed.length > 0 && (
            <>
              {/* KPI strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Proyek Aktif",      val: String(totalProjects), sub: "dengan aktivitas Doc Con",          color: "text-indigo-600" },
                  { label: "Avg Progres",        val: `${avgProgress}%`,    sub: "rata-rata fisik lapangan",           color: avgProgress >= 80 ? "text-emerald-600" : avgProgress >= 40 ? "text-amber-500" : "text-red-500" },
                  { label: "Siap Ditagih",       val: String(readyCount),   sub: `${totalProjects - readyCount} masih terkunci`, color: "text-emerald-600" },
                  { label: "Net Profit Total",   val: fShort(totalProfit),  sub: totalProfit >= 0 ? "surplus gabungan" : "defisit gabungan", color: totalProfit >= 0 ? "text-emerald-600" : "text-red-500" },
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
                      filter === f
                        ? "bg-white text-neutral-800 shadow-sm"
                        : "text-neutral-500 hover:text-neutral-700"
                    }`}>
                    {f === "all" ? "Semua" : f}
                  </button>
                ))}
              </div>

              {/* Notion-style relational table */}
              <div className="rounded-xl overflow-hidden border border-neutral-200 bg-white">

                {/* Table header */}
                <div className="grid px-5 py-3 bg-neutral-50 border-b border-neutral-200"
                  style={{ gridTemplateColumns: "minmax(200px,2.5fr) minmax(140px,1fr) minmax(180px,1.5fr) minmax(150px,1.5fr) 130px", columnGap: 16 }}>
                  {[
                    { icon: <FolderOpen className="h-3 w-3" />, label: "Nama Proyek" },
                    { icon: null,                               label: "Doc Con" },
                    { icon: <TrendingUp className="h-3 w-3" />, label: "Cost Control" },
                    { icon: null,                               label: "Nilai Kontrak" },
                    { icon: <CheckCircle2 className="h-3 w-3" />, label: "Finance" },
                  ].map(h => (
                    <div key={h.label} className="flex items-center gap-1.5">
                      {h.icon && <span className="text-neutral-300">{h.icon}</span>}
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{h.label}</span>
                    </div>
                  ))}
                </div>

                {/* Rows — divide-y divide-neutral-200 */}
                <div className="divide-y divide-neutral-200">
                  {displayed.map(row => {
                    const profitColor  = row.netProfit >= 0 ? "text-emerald-600" : "text-red-500"
                    const marginBg     = row.netMargin >= 15 ? "bg-emerald-50 text-emerald-700" : row.netMargin >= 0 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"
                    return (
                      <div key={row.project_key}
                        className="grid px-5 py-4 items-center hover:bg-neutral-50 transition-colors"
                        style={{ gridTemplateColumns: "minmax(200px,2.5fr) minmax(140px,1fr) minmax(180px,1.5fr) minmax(150px,1.5fr) 130px", columnGap: 16 }}>

                        {/* Col 1 — Nama Proyek */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <FolderOpen className="h-3.5 w-3.5 text-neutral-300 flex-shrink-0" />
                            <p className="text-sm font-semibold text-neutral-800 truncate" title={row.display_name}>
                              {row.display_name}
                            </p>
                          </div>
                          {row.customer_name && (
                            <p className="text-[11px] text-neutral-400 truncate pl-5">{row.customer_name}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 pl-5">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              row.project_status === "SELESAI" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-600"
                            }`}>
                              {row.project_status}
                            </span>
                            <span className="text-[9px] text-neutral-300">
                              {row.log_count} log · {row.sched_count} fase
                            </span>
                          </div>
                        </div>

                        {/* Col 2 — Doc Con */}
                        <div>
                          <DocConBar pct={row.physical_progress} />
                          <p className="text-[10px] text-neutral-400 mt-1">Progress fisik lapangan</p>
                        </div>

                        {/* Col 3 — Cost Control */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            {row.netProfit > 0
                              ? <TrendingUp  className={`h-3.5 w-3.5 ${profitColor}`} />
                              : row.netProfit < 0
                                ? <TrendingDown className={`h-3.5 w-3.5 ${profitColor}`} />
                                : <Minus className={`h-3.5 w-3.5 ${profitColor}`} />}
                            <span className={`text-sm font-bold tabular-nums ${profitColor}`}>
                              {fShort(row.netProfit)}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums ${marginBg}`}>
                              {row.netMargin >= 0 ? "+" : ""}{row.netMargin.toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-400">Biaya aktual: {fShort(row.totalCosts)}</p>
                        </div>

                        {/* Col 4 — Nilai Kontrak */}
                        <div>
                          {row.contractVal > 0 ? (
                            <>
                              <p className="text-sm font-bold text-neutral-800 tabular-nums">{fShort(row.contractVal)}</p>
                              <p className="text-[10px] text-neutral-400 mt-0.5" title={fIDR(row.contractVal)}>
                                {fIDR(row.contractVal)}
                              </p>
                            </>
                          ) : (
                            <span className="text-sm text-neutral-200">—</span>
                          )}
                        </div>

                        {/* Col 5 — Finance */}
                        <div>
                          <FinanceBadge status={row.financeStatus} termins={row.unlockedTermins} />
                        </div>

                      </div>
                    )
                  })}
                </div>
              </div>

              <p className="text-[10px] text-center text-neutral-200">
                Hanya proyek dengan aktivitas Doc Con · Net Profit = Nilai Kontrak − Biaya Aktual
              </p>
            </>
          )}

          {/* Empty after filter */}
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
