"use client"

import * as React from "react"
import {
  Building2, MapPin, TrendingUp, TrendingDown,
  CircleCheckBig, CircleX, Search, ChevronRight,
  ArrowUpDown, Wrench, Package, FolderKanban,
  X, BarChart3, Users,
} from "lucide-react"
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useFilteredInvoices } from "@/lib/use-filtered-invoices"

// ─── Types ────────────────────────────────────────────────────────────────────
import type { InvoiceRecord as Invoice } from "@/types/invoice"
type Client = {
  id: string; name: string; locations: string[]
  totalRevenue: number; totalDPP: number; totalPPN: number
  totalPaid: number; totalOutstanding: number
  invoiceCount: number; paidCount: number; unpaidCount: number
  collectionRate: number; serviceTypes: string[]
  activeMonths: number[]; invoices: Invoice[]
  rank: number; revenueShare: number
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)
const fShort = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
  return `${(n / 1_000).toFixed(0)}K`
}
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"]

function classifyService(desc: string) {
  const d = desc.toLowerCase()
  if (d.includes("pemeliharaan") || d.includes("pemeliaharan") || d.includes("perbaikan")) return "Maintenance"
  if (d.includes("material") || d.includes("dp 30%") || d.includes("dp 50%") || d.includes("supply")) return "Material/PAC"
  if (d.includes("termin") || d.includes("instalasi") || d.includes("pemasangan")) return "Project"
  return "Jasa"
}

const SVC_STYLE: Record<string, string> = {
  Maintenance:  "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800",
  "Material/PAC":"bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800",
  Project:      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  Jasa:         "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
}
const SVC_ICON: Record<string, React.ReactNode> = {
  Maintenance:   <Wrench className="h-2.5 w-2.5" />,
  "Material/PAC":<Package className="h-2.5 w-2.5" />,
  Project:       <FolderKanban className="h-2.5 w-2.5" />,
  Jasa:          <BarChart3 className="h-2.5 w-2.5" />,
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes fillBar {
    from { width: 0 !important; }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }

  .c-up-1 { animation: fadeSlideUp 0.38s ease both 0.04s; }
  .c-up-2 { animation: fadeSlideUp 0.38s ease both 0.10s; }
  .c-up-3 { animation: fadeSlideUp 0.38s ease both 0.16s; }
  .c-up-4 { animation: fadeSlideUp 0.38s ease both 0.22s; }

  .c-sc-1 { animation: scaleIn 0.32s cubic-bezier(.22,.68,0,1.2) both 0.05s; }
  .c-sc-2 { animation: scaleIn 0.32s cubic-bezier(.22,.68,0,1.2) both 0.11s; }
  .c-sc-3 { animation: scaleIn 0.32s cubic-bezier(.22,.68,0,1.2) both 0.17s; }
  .c-sc-4 { animation: scaleIn 0.32s cubic-bezier(.22,.68,0,1.2) both 0.23s; }

  .detail-panel { animation: slideInRight 0.26s cubic-bezier(.22,.68,0,1.15) both; }
  .bar-fill { animation: fillBar 1s cubic-bezier(0.16,1,0.3,1) both; animation-delay: 0.5s; }

  /* KPI cards same as analytics */
  .kpi-card { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
  .kpi-card:hover { transform: translateY(-2px) scale(1.01); box-shadow: 0 8px 24px -4px hsl(var(--primary)/.14); }

  /* Table row hover */
  .cl-row {
    transition: background 0.12s ease;
    cursor: pointer;
    border-bottom: 1px solid hsl(var(--border));
  }
  .cl-row:last-child { border-bottom: none; }
  .cl-row:hover { background: hsl(var(--muted)/.5); }
  .cl-row.selected { background: hsl(var(--primary)/.06); }
  .cl-row.selected td:first-child { border-left: 2px solid hsl(var(--primary)); }

  /* Search */
  .search-box {
    background: hsl(var(--muted)/.5);
    border: 1px solid hsl(var(--border));
    border-radius: 8px;
    padding: 8px 12px 8px 36px;
    font-size: 13px;
    color: hsl(var(--foreground));
    outline: none;
    width: 100%;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .search-box::placeholder { color: hsl(var(--muted-foreground)); }
  .search-box:focus {
    border-color: hsl(var(--primary)/.5);
    box-shadow: 0 0 0 3px hsl(var(--primary)/.08);
    background: hsl(var(--card));
  }

  /* Filter chip */
  .chip {
    border: 1px solid hsl(var(--border));
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 11.5px;
    cursor: pointer;
    transition: all 0.13s;
    background: transparent;
    color: hsl(var(--muted-foreground));
    white-space: nowrap;
  }
  .chip:hover { border-color: hsl(var(--primary)/.5); color: hsl(var(--foreground)); }
  .chip.on {
    background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/.82));
    border-color: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    font-weight: 800;
    box-shadow: 0 10px 20px -12px hsl(var(--primary)/.7), inset 0 1px 0 hsl(0 0% 100%/.18);
    transform: translateY(-1px) scale(1.02);
  }

  /* Sort button */
  .sort-btn { transition: color 0.12s; }
  .sort-btn:hover { color: hsl(var(--foreground)); }

  /* hv-card same as analytics */
  .hv-card { transition: box-shadow 0.2s ease; }
  .hv-card:hover { box-shadow: 0 4px 18px -4px hsl(var(--primary)/.10); }

  /* Month pip */
  .mpip {
    width: 6px; height: 6px; border-radius: 50%;
    background: hsl(var(--muted));
    border: 1px solid hsl(var(--border));
    transition: background 0.1s;
  }
  .mpip.on { background: hsl(var(--primary)); border-color: hsl(var(--primary)); }

  /* Scrollable table body */
  .table-scroll { overflow-y: auto; max-height: calc(100vh - 360px); min-height: 340px; }
  .table-scroll::-webkit-scrollbar { width: 4px; }
  .table-scroll::-webkit-scrollbar-track { background: transparent; }
  .table-scroll::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 4px; }

  /* Detail panel scroll */
  .detail-scroll { overflow-y: auto; max-height: calc(100vh - 260px); }
  .detail-scroll::-webkit-scrollbar { width: 4px; }
  .detail-scroll::-webkit-scrollbar-track { background: transparent; }
  .detail-scroll::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 4px; }

  /* Invoice pill */
  .inv-row { transition: background 0.1s; border-radius: 6px; }
  .inv-row:hover { background: hsl(var(--muted)/.4); }

  /* Rank pills */
  .rank-gold   { background: linear-gradient(135deg,#f59e0b,#fbbf24); color:#fff; }
  .rank-silver { background: linear-gradient(135deg,#94a3b8,#cbd5e1); color:#1e293b; }
  .rank-bronze { background: linear-gradient(135deg,#b45309,#d97706); color:#fff; }
`

// ─── Build clients from invoices ──────────────────────────────────────────────
function buildClients(raw: Invoice[]): Client[] {
  const map = new Map<string, {
    name: string; locations: Set<string>; invoices: Invoice[]
    totalDPP: number; totalPPN: number; totalRevenue: number
    totalPaid: number; totalOutstanding: number
    paidCount: number; unpaidCount: number
    serviceTypes: Set<string>; activeMonths: Set<number>
  }>()

  for (const inv of raw) {
    const base = inv.customer.includes("(")
      ? inv.customer.split("(")[0].trim()
      : inv.customer.trim()
    const loc = inv.customer.includes("(")
      ? inv.customer.split("(")[1]?.replace(")", "").trim() ?? ""
      : ""
    if (!map.has(base)) {
      map.set(base, {
        name: base, locations: new Set(), invoices: [],
        totalDPP: 0, totalPPN: 0, totalRevenue: 0,
        totalPaid: 0, totalOutstanding: 0,
        paidCount: 0, unpaidCount: 0,
        serviceTypes: new Set(), activeMonths: new Set(),
      })
    }
    const c = map.get(base)!
    if (loc) c.locations.add(loc)
    c.invoices.push(inv)
    c.totalDPP += inv.dpp || 0
    c.totalPPN += inv.ppn || 0
    c.totalRevenue += inv.total || 0
    c.totalPaid += inv.payment_value || 0
    c.activeMonths.add(inv.month)
    c.serviceTypes.add(classifyService(inv.description))
    if (inv.status === "PAID") c.paidCount++
    else { c.unpaidCount++; c.totalOutstanding += inv.total || 0 }
  }

  const grandTotal = Array.from(map.values()).reduce((s, c) => s + c.totalRevenue, 0)
  const sorted = Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue)

  return sorted.map((c, i) => ({
    id: c.name.toLowerCase().replace(/\s+/g, "-"),
    name: c.name,
    locations: Array.from(c.locations).slice(0, 5),
    totalRevenue: c.totalRevenue, totalDPP: c.totalDPP, totalPPN: c.totalPPN,
    totalPaid: c.totalPaid, totalOutstanding: c.totalOutstanding,
    invoiceCount: c.invoices.length,
    paidCount: c.paidCount, unpaidCount: c.unpaidCount,
    collectionRate: c.totalRevenue > 0 ? (c.totalPaid / c.totalRevenue) * 100 : 0,
    serviceTypes: Array.from(c.serviceTypes),
    activeMonths: Array.from(c.activeMonths).sort((a, b) => a - b),
    invoices: c.invoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    rank: i + 1,
    revenueShare: grandTotal > 0 ? (c.totalRevenue / grandTotal) * 100 : 0,
  }))
}

// ─── Rank badge ───────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  const cls = rank === 1 ? "rank-gold" : rank === 2 ? "rank-silver" : rank === 3 ? "rank-bronze" : ""
  if (!cls) return (
    <span className="flex h-5 w-6 items-center justify-center rounded text-[10px] font-bold text-muted-foreground bg-muted">
      {rank}
    </span>
  )
  return (
    <span className={`${cls} flex h-5 w-6 items-center justify-center rounded text-[10px] font-black`}>
      {rank}
    </span>
  )
}

// ─── Detail Panel (right side) ────────────────────────────────────────────────
function DetailPanel({ client, onClose }: { client: Client; onClose: () => void }) {
  const [tab, setTab] = React.useState<"overview" | "invoices">("overview")

  return (
    <div className="detail-panel flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 py-5 border-b">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <RankBadge rank={client.rank} />
            <span className="text-[10px] text-muted-foreground font-mono">
              #{client.rank} · {client.revenueShare.toFixed(1)}% revenue share
            </span>
          </div>
          <h2 className="text-sm font-bold leading-snug">{client.name}</h2>
          {client.locations.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
              <span className="text-[11px] text-muted-foreground">{client.locations.join(" · ")}</span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 px-6 py-3 border-b bg-muted/20">
        {(["overview", "invoices"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {t === "overview" ? "Overview" : `Invoice (${client.invoiceCount})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="detail-scroll flex-1 px-6 py-5 space-y-6">
        {tab === "overview" ? (
          <>
            {/* 4 KPI mini boxes */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Revenue",  val: fIDR(client.totalRevenue),    color: "" },
                { label: "Terkumpul",      val: fIDR(client.totalPaid),       color: "text-green-600" },
                { label: "Outstanding",    val: fIDR(client.totalOutstanding), color: client.totalOutstanding > 0 ? "text-destructive" : "text-green-600" },
                { label: "Collection",     val: `${client.collectionRate.toFixed(1)}%`, color: client.collectionRate >= 80 ? "text-green-600" : "text-amber-500" },
              ].map(k => (
                <div key={k.label} className="rounded-lg bg-muted/40 border p-4">
                  <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">{k.label}</p>
                  <p className={`text-xs font-bold font-mono leading-snug ${k.color}`}>{k.val}</p>
                </div>
              ))}
            </div>

            {/* Collection bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Payment Progress</span>
                <span className="font-medium">{client.collectionRate.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="bar-fill h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(client.collectionRate, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span className="text-green-600">✓ {client.paidCount} paid</span>
                <span className={client.unpaidCount > 0 ? "text-destructive" : "text-muted-foreground"}>
                  ✗ {client.unpaidCount} unpaid
                </span>
              </div>
            </div>

            {/* DPP/PPN breakdown */}
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tax Breakdown</p>
              {[
                { label: "DPP (Nett)", val: fIDR(client.totalDPP), color: "" },
                { label: "PPN (11%)",  val: fIDR(client.totalPPN), color: "text-amber-500" },
                { label: "Total",      val: fIDR(client.totalRevenue), color: "font-bold" },
              ].map((r, i) => (
                <div key={r.label} className={`flex justify-between text-xs ${i === 2 ? "pt-3 border-t" : ""}`}>
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className={`font-mono ${r.color}`}>{r.val}</span>
                </div>
              ))}
            </div>

            {/* Service types */}
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Layanan</p>
              <div className="flex flex-wrap gap-1.5">
                {client.serviceTypes.map(s => (
                  <span key={s} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${SVC_STYLE[s] ?? ""}`}>
                    {SVC_ICON[s]} {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Month activity */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Aktivitas Bulanan</p>
                <span className="text-[10px] text-muted-foreground">{client.activeMonths.length}/12</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                {MONTHS.map((m, i) => {
                  const active = client.activeMonths.includes(i + 1)
                  return (
                    <div key={m} className="flex flex-col items-center gap-1" title={m}>
                      <div className={`mpip ${active ? "on" : ""}`} />
                      <span className="text-[8px] text-muted-foreground/60">{m.slice(0,1)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          /* Invoice list */
          <div className="space-y-1">
            {client.invoices.map(inv => (
              <div key={inv.invoice_no} className="inv-row px-3 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${inv.status === "PAID" ? "bg-green-500" : "bg-destructive"}`} />
                      <span className="text-[10px] font-mono text-muted-foreground">{inv.invoice_no}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{inv.description}</p>
                    <p className="text-[9px] text-muted-foreground/50 mt-1">{inv.date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold font-mono">{fIDR(inv.total)}</p>
                    <span className={`text-[10px] font-semibold ${inv.status === "PAID" ? "text-green-600" : "text-destructive"}`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const { invoices: raw, periodLabel } = useFilteredInvoices()
  const allClients = React.useMemo(() => buildClients(raw), [raw])

  const grandStats = React.useMemo(() => ({
    totalRevenue:    allClients.reduce((s, c) => s + c.totalRevenue, 0),
    totalOutstanding:allClients.reduce((s, c) => s + c.totalOutstanding, 0),
    totalClients:    allClients.length,
    fullyPaid:       allClients.filter(c => c.unpaidCount === 0).length,
    hasOutstanding:  allClients.filter(c => c.unpaidCount > 0).length,
    avgRate:         allClients.reduce((s, c) => s + c.collectionRate, 0) / allClients.length,
  }), [allClients])

  const [search,       setSearch]       = React.useState("")
  const [filterSvc,    setFilterSvc]    = React.useState("Semua")
  const [filterStatus, setFilterStatus] = React.useState("Semua")
  const [sortKey,      setSortKey]      = React.useState<"revenue"|"invoice"|"rate"|"outstanding">("revenue")
  const [sortAsc,      setSortAsc]      = React.useState(false)
  const [selected,     setSelected]     = React.useState<Client | null>(null)

  const SVC_FILTERS    = ["Semua", "Maintenance", "Material/PAC", "Project", "Jasa"]
  const STATUS_FILTERS = ["Semua", "Lunas", "Ada Outstanding"]

  const displayed = React.useMemo(() => {
    let list = [...allClients]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.locations.some(l => l.toLowerCase().includes(q)))
    }
    if (filterSvc !== "Semua") list = list.filter(c => c.serviceTypes.includes(filterSvc))
    if (filterStatus === "Lunas") list = list.filter(c => c.unpaidCount === 0)
    if (filterStatus === "Ada Outstanding") list = list.filter(c => c.unpaidCount > 0)
    list.sort((a, b) => {
      const diff =
        sortKey === "revenue"     ? b.totalRevenue    - a.totalRevenue :
        sortKey === "invoice"     ? b.invoiceCount    - a.invoiceCount :
        sortKey === "rate"        ? b.collectionRate  - a.collectionRate :
                                    b.totalOutstanding - a.totalOutstanding
      return sortAsc ? -diff : diff
    })
    return list
  }, [allClients, search, filterSvc, filterStatus, sortKey, sortAsc])

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortAsc(p => !p)
    else { setSortKey(k); setSortAsc(false) }
  }

  const renderSortIcon = (key: typeof sortKey) => (
    <ArrowUpDown className={`h-3 w-3 inline-block ml-1 transition-opacity ${sortKey === key ? "opacity-100 text-primary" : "opacity-30"}`} />
  )

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />

        <div className="flex flex-1 flex-col gap-6 p-6">

          {/* ── Page Title ─────────────────────────────────────────────── */}
          <div className="c-up-1 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-xl font-semibold">Klien</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {allClients.length} klien · {raw.length} invoice · {periodLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 border border-green-500/20 px-3 py-1 text-xs font-semibold text-green-600">
                <CircleCheckBig className="h-3 w-3" /> {grandStats.fullyPaid} lunas
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 border border-destructive/20 px-3 py-1 text-xs font-semibold text-destructive">
                <CircleX className="h-3 w-3" /> {grandStats.hasOutstanding} outstanding
              </span>
            </div>
          </div>

          {/* ── 4 KPI Cards — same pattern as analytics ───────────────── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                cls:"c-sc-1 kpi-card",
                title:"Total Revenue", icon:<Building2 className="h-4 w-4 text-muted-foreground"/>,
                val: fIDR(grandStats.totalRevenue), sub:`dari ${allClients.length} klien`,
              },
              {
                cls:"c-sc-2 kpi-card",
                title:"Klien Aktif", icon:<Users className="h-4 w-4 text-muted-foreground"/>,
                val: String(grandStats.totalClients), sub:`semua terdaftar ${periodLabel}`,
              },
              {
                cls:"c-sc-3 kpi-card",
                title:"Avg Collection Rate", icon:<TrendingUp className="h-4 w-4 text-green-600"/>,
                val: `${grandStats.avgRate.toFixed(1)}%`,
                sub: grandStats.avgRate >= 80 ? "✓ Performa sehat" : "⚠ Perlu perhatian",
                subColor: grandStats.avgRate >= 80 ? "text-green-600" : "text-amber-500",
              },
              {
                cls:"c-sc-4 kpi-card",
                title:"Total Outstanding", icon:<TrendingDown className="h-4 w-4 text-destructive"/>,
                val: fIDR(grandStats.totalOutstanding),
                sub:`${grandStats.hasOutstanding} klien belum lunas`,
                subColor: "text-destructive",
              },
            ].map(c => (
              <Card key={c.title} className={c.cls}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">{c.title}</CardTitle>
                  {c.icon}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{c.val}</div>
                  <p className={`text-xs mt-1 ${(c as { subColor?: string }).subColor ?? "text-muted-foreground"}`}>{c.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Main: Table + Detail Panel ─────────────────────────────── */}
          <div className="c-up-3 flex gap-6 items-start">

            {/* LEFT — Filters + Table */}
            <div className={`flex flex-col gap-4 min-w-0 transition-all duration-300 ${selected ? "flex-[1.4]" : "flex-1"}`}>

              {/* Search + Filter row */}
              <Card className="hv-card">
                <CardContent className="py-5 px-6 space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Cari nama klien atau lokasi..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="search-box"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Filter chips */}
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex gap-1.5 flex-wrap">
                      {SVC_FILTERS.map(f => (
                        <button key={f} onClick={() => setFilterSvc(f)} className={`chip ${filterSvc === f ? "on" : ""}`}>
                          {f}
                        </button>
                      ))}
                    </div>
                    <div className="w-px bg-border mx-1" />
                    <div className="flex gap-1.5 flex-wrap">
                      {STATUS_FILTERS.map(f => (
                        <button key={f} onClick={() => setFilterStatus(f)} className={`chip ${filterStatus === f ? "on" : ""}`}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Result count */}
                  <p className="text-xs text-muted-foreground">
                    Menampilkan <span className="font-semibold text-foreground">{displayed.length}</span> klien
                    {selected && <> · <span className="text-primary font-medium">{selected.name}</span> dipilih</>}
                  </p>
                </CardContent>
              </Card>

              {/* Table */}
              <Card className="hv-card overflow-hidden">
                {/* Table header */}
                <div className="border-b bg-muted/40">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="px-5 py-3.5 text-left font-medium text-muted-foreground w-10">#</th>
                        <th className="px-5 py-3.5 text-left font-medium text-muted-foreground">Klien</th>
                        <th className="px-5 py-3.5 text-right font-medium text-muted-foreground cursor-pointer sort-btn" onClick={() => toggleSort("revenue")}>
                          Revenue {renderSortIcon("revenue")}
                        </th>
                        {!selected && <>
                          <th className="px-5 py-3.5 text-right font-medium text-muted-foreground cursor-pointer sort-btn hidden lg:table-cell" onClick={() => toggleSort("rate")}>
                            Rate {renderSortIcon("rate")}
                          </th>
                          <th className="px-5 py-3.5 text-right font-medium text-muted-foreground cursor-pointer sort-btn hidden xl:table-cell" onClick={() => toggleSort("invoice")}>
                            Inv {renderSortIcon("invoice")}
                          </th>
                        </>}
                        <th className="px-5 py-3.5 text-right font-medium text-muted-foreground cursor-pointer sort-btn" onClick={() => toggleSort("outstanding")}>
                          Outstanding {renderSortIcon("outstanding")}
                        </th>
                        <th className="px-5 py-3.5 w-8" />
                      </tr>
                    </thead>
                  </table>
                </div>

                {/* Scrollable body */}
                <div className="table-scroll">
                  <table className="w-full text-sm">
                    <tbody>
                      {displayed.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-16 text-muted-foreground text-sm">
                            <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            Tidak ada klien ditemukan
                          </td>
                        </tr>
                      ) : displayed.map(client => (
                        <tr
                          key={client.id}
                          className={`cl-row ${selected?.id === client.id ? "selected" : ""}`}
                          onClick={() => setSelected(p => p?.id === client.id ? null : client)}
                        >
                          {/* Rank */}
                          <td className="px-5 py-4 w-10">
                            <RankBadge rank={client.rank} />
                          </td>

                          {/* Name + location + service */}
                          <td className="px-5 py-4 min-w-0">
                            <div className="flex flex-col gap-1.5 min-w-0">
                              <span className={`text-sm font-semibold truncate leading-tight max-w-[180px] ${selected ? "max-w-[120px]" : ""} ${selected?.id === client.id ? "text-primary" : ""}`}>
                                {client.name}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {client.locations.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate max-w-[140px]">
                                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                                    {client.locations.slice(0,2).join(", ")}
                                    {client.locations.length > 2 && ` +${client.locations.length-2}`}
                                  </span>
                                )}
                                {!selected && client.serviceTypes.slice(0,1).map(s => (
                                  <span key={s} className={`hidden sm:flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${SVC_STYLE[s] ?? ""}`}>
                                    {SVC_ICON[s]} {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>

                          {/* Revenue */}
                          <td className="px-5 py-4 text-right">
                            <div>
                              <p className="text-xs font-bold font-mono">{fShort(client.totalRevenue)}</p>
                              <p className="text-[9px] text-muted-foreground mt-0.5">{client.revenueShare.toFixed(1)}%</p>
                            </div>
                          </td>

                          {/* Rate — hidden when panel open */}
                          {!selected && <>
                            <td className="px-5 py-4 text-right hidden lg:table-cell">
                              <span className={`text-xs font-semibold ${client.collectionRate >= 80 ? "text-green-600" : "text-amber-500"}`}>
                                {client.collectionRate.toFixed(0)}%
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right hidden xl:table-cell">
                              <span className="text-xs text-muted-foreground">{client.invoiceCount}</span>
                            </td>
                          </>}

                          {/* Outstanding */}
                          <td className="px-5 py-4 text-right">
                            {client.totalOutstanding > 0 ? (
                              <div>
                                <p className="text-xs font-mono font-semibold text-destructive">{fShort(client.totalOutstanding)}</p>
                                <p className="text-[9px] text-muted-foreground mt-0.5">{client.unpaidCount} inv</p>
                              </div>
                            ) : (
                              <span className="text-[10px] font-medium text-green-600">Lunas ✓</span>
                            )}
                          </td>

                          {/* Arrow */}
                          <td className="px-4 py-4">
                            <ChevronRight className={`h-3.5 w-3.5 transition-all ${selected?.id === client.id ? "text-primary rotate-90" : "text-muted-foreground/40"}`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table footer */}
                {displayed.length > 0 && (
                  <div className="border-t bg-muted/20 px-5 py-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{displayed.length} klien</span>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Total: <span className="font-semibold text-foreground font-mono">
                        {fIDR(displayed.reduce((s, c) => s + c.totalRevenue, 0))}
                      </span></span>
                      <span>Outstanding: <span className={`font-semibold font-mono ${displayed.some(c => c.totalOutstanding > 0) ? "text-destructive" : "text-green-600"}`}>
                        {fIDR(displayed.reduce((s, c) => s + c.totalOutstanding, 0))}
                      </span></span>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* RIGHT — Detail Panel */}
            {selected && (
              <div className="flex-[1] min-w-0">
                <Card className="hv-card overflow-hidden sticky top-6">
                  <DetailPanel client={selected} onClose={() => setSelected(null)} />
                </Card>
              </div>
            )}
          </div>

        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
