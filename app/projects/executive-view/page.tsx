"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { RefreshCw, Lock, CheckCircle2, TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { ExecProjectRow } from "@/app/api/executive-summary/route"

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

const fShort = (n: number): string => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)}Jt`
  if (abs >= 1_000)         return `${(n / 1_000).toFixed(0)}Rb`
  return String(Math.round(n))
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct, color = "#6366f1" }: { pct: number; color?: string }) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#f3f4f6", minWidth: 60 }}>
        <div className="h-full rounded-full transition-all"
          style={{ width: `${clamped}%`, background: color }} />
      </div>
      <span className="text-[11px] font-bold tabular-nums shrink-0"
        style={{ color, minWidth: 32, textAlign: "right" }}>
        {Math.round(clamped)}%
      </span>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function FinanceBadge({ status, termins }: { status: "READY" | "LOCKED"; termins: string[] }) {
  if (status === "READY") {
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: "#d1fae5", color: "#065f46", border: "1px solid #6ee7b7" }}>
          <CheckCircle2 className="h-3 w-3" /> READY TO BILL
        </span>
        {termins.length > 0 && (
          <p className="text-[10px] mt-0.5" style={{ color: "#059669" }}>
            {termins.join(", ")}
          </p>
        )}
      </div>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: "#f3f4f6", color: "#9ca3af", border: "1px solid #e5e7eb" }}>
      <Lock className="h-3 w-3" /> LOCKED
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ExecutiveViewPage() {
  const [rows, setRows]       = React.useState<ExecProjectRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError]     = React.useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)
  const [filter, setFilter]   = React.useState<"all" | "BERJALAN" | "SELESAI">("all")

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/executive-summary", { cache: "no-store" })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setRows(json.data ?? [])
      setLastUpdated(new Date())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { fetchData() }, [fetchData])

  const displayed = rows.filter(r => filter === "all" || r.project_status === filter)

  // Summary KPIs
  const totalProjects  = displayed.length
  const readyCount     = displayed.filter(r => r.financeStatus === "READY").length
  const avgProgress    = totalProjects > 0
    ? Math.round(displayed.reduce((s, r) => s + r.physical_progress, 0) / totalProjects)
    : 0
  const totalNetProfit = displayed.reduce((s, r) => s + r.netProfit, 0)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* Page header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">Bos View — Executive Overview</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ringkasan progres, profitabilitas &amp; status invoice semua proyek.
                {lastUpdated && (
                  <span className="ml-2" style={{ color: "#9ca3af" }}>
                    Diperbarui {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
            </div>
            <button type="button" onClick={fetchData} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#e5e7eb")}
              onMouseLeave={e => (e.currentTarget.style.background = "#f3f4f6")}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Proyek",     val: String(totalProjects),    sub: filter === "all" ? "semua status" : filter, color: "#6366f1" },
              { label: "Rata-rata Progres", val: `${avgProgress}%`,       sub: "progress fisik",                          color: avgProgress >= 80 ? "#10b981" : avgProgress >= 40 ? "#f59e0b" : "#ef4444" },
              { label: "Ready to Bill",    val: String(readyCount),       sub: `${totalProjects - readyCount} masih locked`, color: "#10b981" },
              { label: "Net Profit Total", val: fShort(totalNetProfit),   sub: totalNetProfit >= 0 ? "surplus" : "defisit", color: totalNetProfit >= 0 ? "#059669" : "#dc2626" },
            ].map(k => (
              <div key={k.label} className="rounded-xl p-4" style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}>
                <p className="text-[10px] text-muted-foreground font-semibold mb-1">{k.label}</p>
                <p className="text-2xl font-black tabular-nums" style={{ color: k.color }}>{k.val}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#9ca3af" }}>{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
            {(["all", "BERJALAN", "SELESAI"] as const).map(f => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: filter === f ? "#ffffff" : "transparent",
                  color: filter === f ? "#111827" : "#6b7280",
                  boxShadow: filter === f ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}>
                {f === "all" ? "Semua" : f}
              </button>
            ))}
          </div>

          {/* Error state */}
          {error && (
            <div className="rounded-xl p-4 text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
              Gagal memuat data: {error}
            </div>
          )}

          {/* Notion-style table */}
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Memuat data proyek…</span>
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground text-sm">
              Tidak ada proyek ditemukan.
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
              {/* Table header */}
              <div className="grid px-4 py-3"
                style={{
                  gridTemplateColumns: "minmax(180px,2fr) minmax(120px,1fr) minmax(160px,1.5fr) minmax(140px,1.5fr) 110px",
                  gap: "12px",
                  background: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",
                }}>
                {["Nama Proyek", "Doc Con — Progres", "Cost Control — Profit", "Nilai Kontrak", "Finance Status"].map(h => (
                  <span key={h} className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#6b7280" }}>
                    {h}
                  </span>
                ))}
              </div>

              {/* Table rows */}
              {displayed.map((row, idx) => {
                const isLast       = idx === displayed.length - 1
                const progColor    = row.physical_progress >= 80 ? "#10b981" : row.physical_progress >= 40 ? "#6366f1" : "#f59e0b"
                const profitColor  = row.netProfit >= 0 ? "#059669" : "#dc2626"
                const marginColor  = row.netMargin >= 15 ? "#059669" : row.netMargin >= 0 ? "#f59e0b" : "#dc2626"

                return (
                  <div key={row.project_key}
                    className="grid px-4 py-3.5 items-center transition-colors"
                    style={{
                      gridTemplateColumns: "minmax(180px,2fr) minmax(120px,1fr) minmax(160px,1.5fr) minmax(140px,1.5fr) 110px",
                      gap: "12px",
                      background: "#ffffff",
                      borderBottom: isLast ? "none" : "1px solid #f3f4f6",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#ffffff")}>

                    {/* Nama Proyek */}
                    <div style={{ minWidth: 0 }}>
                      <p className="text-xs font-bold text-foreground truncate" title={row.display_name}>
                        {row.display_name}
                      </p>
                      {row.customer_name && (
                        <p className="text-[10px] truncate mt-0.5" style={{ color: "#9ca3af" }}>
                          {row.customer_name}
                        </p>
                      )}
                      <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: row.project_status === "SELESAI" ? "#d1fae5" : "#eff6ff",
                          color: row.project_status === "SELESAI" ? "#065f46" : "#3b82f6",
                        }}>
                        {row.project_status}
                      </span>
                    </div>

                    {/* Doc Con — Progress */}
                    <div>
                      <ProgressBar pct={row.physical_progress} color={progColor} />
                    </div>

                    {/* Cost Control — Profit */}
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        {row.netProfit >= 0
                          ? <TrendingUp className="h-3 w-3" style={{ color: profitColor }} />
                          : row.netProfit < -1000
                            ? <TrendingDown className="h-3 w-3" style={{ color: profitColor }} />
                            : <Minus className="h-3 w-3" style={{ color: profitColor }} />
                        }
                        <span className="text-xs font-bold tabular-nums" style={{ color: profitColor }}>
                          {fShort(row.netProfit)}
                        </span>
                        <span className="text-[10px] font-semibold tabular-nums"
                          style={{ color: marginColor, background: row.netMargin >= 15 ? "#d1fae5" : row.netMargin >= 0 ? "#fef3c7" : "#fee2e2", borderRadius: 4, padding: "1px 4px" }}>
                          {row.netMargin >= 0 ? "+" : ""}{row.netMargin.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-[10px]" style={{ color: "#9ca3af" }}>
                        Biaya: {fShort(row.totalCosts)}
                      </p>
                    </div>

                    {/* Nilai Kontrak */}
                    <div>
                      {row.contractVal > 0 ? (
                        <>
                          <p className="text-xs font-bold tabular-nums text-foreground">{fShort(row.contractVal)}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: "#9ca3af" }} title={fIDR(row.contractVal)}>
                            {fIDR(row.contractVal).replace("Rp ", "Rp ")}
                          </p>
                        </>
                      ) : (
                        <span className="text-[10px]" style={{ color: "#d1d5db" }}>Belum diisi</span>
                      )}
                    </div>

                    {/* Finance Status */}
                    <div>
                      <FinanceBadge status={row.financeStatus} termins={row.unlockedTermins} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer note */}
          <p className="text-[10px] text-center" style={{ color: "#d1d5db" }}>
            Data diambil dari Supabase secara real-time. Net Profit = Nilai Kontrak − Total Biaya Aktual.
          </p>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
