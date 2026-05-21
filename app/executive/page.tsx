"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { AlertTriangle, TrendingUp, Clock, CheckCircle, RefreshCw } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────
type Buckets = { overdue: number; d30: number; d60: number; d90: number; beyond: number }
type OverdueItem = { invoice_no: string; customer: string; site_name: string; amount: number; overdueDays: number }
type EscalationItem = { id: string; project_key: string; escalation_type: string; triggered_at: string; notes: string | null }
type ForecastData = {
  buckets: Buckets
  totalOutstanding: number
  overdueList: OverdueItem[]
  openEscalations: EscalationItem[]
  generatedAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)
const fShort = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)}Jt`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}Rb`
  return String(n)
}

// ─── Mini bar chart (pure SVG, no recharts dep) ──────────────────────────────
function CashBar({ buckets, total }: { buckets: Buckets; total: number }) {
  if (total === 0) return <p className="text-xs text-muted-foreground text-center py-6">Tidak ada piutang aktif.</p>

  const bars = [
    { label: "Overdue",  value: buckets.overdue, color: "#ef4444" },
    { label: "≤30 hari", value: buckets.d30,     color: "#f97316" },
    { label: "31-60h",   value: buckets.d60,     color: "#f59e0b" },
    { label: "61-90h",   value: buckets.d90,     color: "#22c55e" },
    { label: ">90h",     value: buckets.beyond,  color: "#94a3b8" },
  ]
  const maxVal = Math.max(...bars.map(b => b.value), 1)
  const W = 280, H = 100, barW = 36, gap = 18, left = 0

  return (
    <svg viewBox={`0 0 ${W} ${H + 28}`} className="w-full max-w-xs mx-auto">
      {bars.map((b, i) => {
        const bh = Math.max(4, (b.value / maxVal) * H)
        const x  = left + i * (barW + gap)
        const y  = H - bh
        return (
          <g key={b.label}>
            <rect x={x} y={y} width={barW} height={bh} rx="5" fill={b.color} opacity={b.value > 0 ? 0.85 : 0.15} />
            {b.value > 0 && (
              <text x={x + barW / 2} y={y - 4} fontSize="8" fill={b.color} textAnchor="middle" fontWeight="700">
                {fShort(b.value)}
              </text>
            )}
            <text x={x + barW / 2} y={H + 16} fontSize="7.5" fill="#94a3b8" textAnchor="middle">{b.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────
function KpiTile({
  label, value, sub, color, icon,
}: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-2 ${color}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="opacity-60">{icon}</span>
      </div>
      <p className="text-2xl font-black font-mono text-foreground leading-none">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ExecutivePage() {
  const [data,    setData]    = React.useState<ForecastData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error,   setError]   = React.useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const r = await fetch("/api/cashflow-forecast")
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setData(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data")
    } finally { setLoading(false) }
  }

  React.useEffect(() => { load() }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="p-6 max-w-4xl mx-auto">

          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-foreground">Executive Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Cash flow forecast &amp; VO escalation alerts
                {data?.generatedAt && (
                  <> · Data per {new Date(data.generatedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</>
                )}
              </p>
            </div>
            <button type="button" onClick={load} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl border border-destructive/30 bg-destructive/8 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading && !data && (
            <div className="text-center py-16 text-muted-foreground text-sm">Memuat data...</div>
          )}

          {data && (
            <>
              {/* ── VO Escalation Alerts ── */}
              {data.openEscalations.length > 0 && (
                <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/6 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <p className="text-sm font-black text-destructive">
                      {data.openEscalations.length} VO Escalation Belum Di-acknowledge
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {data.openEscalations.map(e => (
                      <div key={e.id} className="flex items-start gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/15">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground">
                            {e.escalation_type === "vo_budget_exceeded" ? "🔴 Budget VO Terlampaui" : "🟡 Budget VO ≥80%"}
                            {" — "}
                            <span className="font-mono text-muted-foreground">{e.project_key.replace("MANUAL::", "")}</span>
                          </p>
                          {e.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{e.notes}</p>}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(e.triggered_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3">
                    Buka proyek terkait di halaman Projects untuk acknowledge setiap eskalasi.
                  </p>
                </div>
              )}

              {/* ── 4 KPI Tiles ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <KpiTile
                  label="Overdue"
                  value={fShort(data.buckets.overdue)}
                  sub={data.overdueList.length > 0 ? `${data.overdueList.length} invoice` : "Tidak ada"}
                  color="border-destructive/25 bg-destructive/5"
                  icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
                />
                <KpiTile
                  label="Jatuh tempo ≤30h"
                  value={fShort(data.buckets.d30)}
                  color="border-amber-500/25 bg-amber-500/5"
                  icon={<Clock className="h-5 w-5 text-amber-500" />}
                />
                <KpiTile
                  label="31–90 hari"
                  value={fShort(data.buckets.d60 + data.buckets.d90)}
                  color="border-green-500/25 bg-green-500/5"
                  icon={<TrendingUp className="h-5 w-5 text-green-500" />}
                />
                <KpiTile
                  label="Total Piutang"
                  value={fShort(data.totalOutstanding)}
                  sub="Semua invoice belum lunas"
                  color="border-primary/25 bg-primary/5"
                  icon={<CheckCircle className="h-5 w-5 text-primary" />}
                />
              </div>

              {/* ── Bar Chart + Overdue List ── */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Cash flow bar chart */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="text-sm font-bold text-foreground mb-1">Distribusi Piutang</p>
                  <p className="text-[11px] text-muted-foreground mb-4">Berdasarkan jatuh tempo dari sekarang</p>
                  <CashBar buckets={data.buckets} total={data.totalOutstanding} />
                  <p className="text-center text-xs font-bold text-foreground mt-3">
                    Total: {fIDR(data.totalOutstanding)}
                  </p>
                </div>

                {/* Overdue invoice list */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Invoice Overdue
                  </p>
                  <p className="text-[11px] text-muted-foreground mb-3">Top 10 terlama belum dibayar</p>
                  {data.overdueList.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      ✅ Tidak ada invoice overdue
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {data.overdueList.map(inv => (
                        <div key={inv.invoice_no} className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-destructive/5 border border-destructive/10">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-foreground truncate">{inv.customer}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{inv.invoice_no} · {inv.site_name}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] font-black text-destructive">{fShort(inv.amount)}</p>
                            <p className="text-[9px] text-muted-foreground">{inv.overdueDays}h lewat</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
