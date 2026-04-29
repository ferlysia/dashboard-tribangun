"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
} from "recharts"
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Award, Building2 } from "lucide-react"
import { useFilteredInvoices } from "@/lib/use-filtered-invoices"
import { useCurrentUser } from "@/components/providers/current-user-provider"
import type { InvoiceRecord } from "@/types/invoice"

const trendConfig  = { revenue: { label: "Revenue", color: "var(--primary)" } } satisfies ChartConfig
const volumeConfig = {
  paid:   { label: "Paid",        color: "var(--primary)"     },
  unpaid: { label: "Outstanding", color: "var(--destructive)" },
} satisfies ChartConfig
const statusConfig = {
  paid:   { label: "Paid",        color: "var(--primary)"     },
  unpaid: { label: "Outstanding", color: "var(--destructive)" },
} satisfies ChartConfig

const fIDR   = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)
const fShort = (n: number) => n >= 1e9 ? `Rp ${(n/1e9).toFixed(1)} B` : n >= 1e6 ? `Rp ${(n/1e6).toFixed(0)} M` : `Rp ${(n/1e3).toFixed(0)} K`
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function classifyCategory(description: string) {
  const value = description.toLowerCase()
  if (value.includes("pemeliharaan") || value.includes("perbaikan") || value.includes("maintenance")) return "Maintenance"
  if (value.includes("material") || value.includes("supply") || value.includes("dp 30%") || value.includes("dp 50%")) return "Material/PAC"
  if (value.includes("instalasi") || value.includes("pemasangan") || value.includes("termin") || value.includes("project")) return "Project"
  if (value.includes("jasa")) return "Jasa"
  return "Umum"
}

const DASHBOARD_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600&display=swap');

  @keyframes heroReveal {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes heroScaleIn {
    from { opacity: 0; transform: scale(1.04); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes statPop {
    0%   { opacity: 0; transform: translateY(12px) scale(0.95); }
    70%  { transform: translateY(-2px) scale(1.02); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes lineGrow {
    from { width: 0; opacity: 0; }
    to   { width: 64px; opacity: 1; }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }

  /* ── Hero wrapper: office photo as bg ── */
  .hero-office-wrap {
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    min-height: 240px;
    animation: heroScaleIn 0.7s ease both;
  }

  /* Office photo bg */
  .hero-office-img {
    position: absolute;
    inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    object-position: center 30%;
    filter: brightness(0.72) saturate(0.9);
    transition: transform 6s ease;
  }
  .hero-office-wrap:hover .hero-office-img {
    transform: scale(1.02);
  }

  /* Gradient overlay top to bottom — dark top for text, lighter bottom */
  .hero-office-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      rgba(10, 14, 30, 0.75) 0%,
      rgba(10, 14, 30, 0.55) 50%,
      rgba(10, 14, 30, 0.3) 100%
    );
  }

  /* Content inside hero */
  .hero-office-content {
    position: relative;
    z-index: 2;
    padding: 36px 40px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  @media(min-width: 768px) {
    .hero-office-content {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  /* Logo in hero */
  .hero-logo-circle {
    width: 60px; height: 60px;
    border-radius: 16px;
    overflow: hidden;
    border: 2px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.1);
    backdrop-filter: blur(8px);
    flex-shrink: 0;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    margin-bottom: 12px;
    animation: statPop 0.6s cubic-bezier(.22,.68,0,1.2) both 0.1s;
  }

  /* FIX #5: Beautiful typography for company name */
  .hero-greeting {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: rgba(255,255,255,0.7);
    text-transform: uppercase;
    margin-bottom: 6px;
    animation: heroReveal 0.5s ease both 0.15s;
  }
  .hero-company-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-weight: 900;
    font-size: clamp(1.6rem, 3vw, 2.5rem);
    line-height: 1.1;
    color: white;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
    animation: heroReveal 0.55s ease both 0.22s;
  }
  .hero-company-name span {
    /* Highlighted "USAHA PERSADA" in golden color */
    color: #D4B896;
  }
  .hero-accent-line {
    display: block;
    height: 3px;
    background: linear-gradient(90deg, #D4B896, rgba(212,184,150,0));
    border-radius: 2px;
    margin: 10px 0 12px;
    animation: lineGrow 0.6s ease both 0.35s;
  }
  .hero-tagline {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: rgba(255,255,255,0.65);
    letter-spacing: 0.03em;
    animation: heroReveal 0.5s ease both 0.3s;
  }

  /* Stat pills on right */
  .hero-stats {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    animation: heroReveal 0.5s ease both 0.4s;
  }
  @media(min-width: 768px) {
    .hero-stats { flex-wrap: nowrap; }
  }
  .hero-stat-pill {
    background: rgba(255,255,255,0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 14px;
    padding: 12px 18px;
    text-align: center;
    min-width: 90px;
    transition: background 0.2s, transform 0.2s;
  }
  .hero-stat-pill:hover {
    background: rgba(255,255,255,0.16);
    transform: translateY(-2px);
  }
  .hero-stat-val {
    font-family: 'Playfair Display', serif;
    font-size: 1.35rem;
    font-weight: 700;
    color: white;
    line-height: 1;
    margin-bottom: 4px;
  }
  .hero-stat-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 9px;
    color: rgba(255,255,255,0.6);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .hero-stat-icon {
    margin-bottom: 6px;
  }

  /* Fallback gradient if image missing */
  .hero-fallback-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      #0f1929 0%,
      #1a2d4a 35%,
      #2c3e70 65%,
      #1a2440 100%
    );
  }
`

export default function DashboardPage() {
  const [filterStatus, setFilterStatus] = React.useState<string | null>(null)
  const tableRef = React.useRef<HTMLDivElement>(null)
  const { invoices: activeInvoices, periodLabel } = useFilteredInvoices()
  const { user } = useCurrentUser()

  const now      = new Date()
  const hour     = now.getHours()
  const greeting = hour < 12 ? "Selamat Pagi" : hour < 17 ? "Selamat Siang" : "Selamat Malam"
  const emoji    = hour < 12 ? "🌅" : hour < 17 ? "☀️" : "🌙"

  const { invoices, stats } = React.useMemo(() => {
    const seen = new Set<string>()
    const invoices = (activeInvoices as InvoiceRecord[]).filter(inv => {
      if (seen.has(inv.invoice_no)) return false
      seen.add(inv.invoice_no)
      return true
    })
    const totalRevenue   = invoices.reduce((s,i) => s + (i.total || 0), 0)
    const totalCollected = invoices.reduce((s,i) => s + (i.payment_value || 0), 0)
    const paidCount      = invoices.filter(i => i.status === "PAID").length
    const unpaidCount    = invoices.filter(i => i.status === "UNPAID").length

    const monthly = MONTHS.map((month, idx) => {
      const rows   = invoices.filter(i => i.month === idx + 1)
      const rev    = rows.reduce((s,i) => s + i.total, 0)
      const paid   = rows.filter(i => i.status === "PAID").length
      const unpaid = rows.filter(i => i.status === "UNPAID").length
      return { month, revenue: rev, paid, unpaid }
    })

    const pieData = [
      { name: "paid",   value: totalCollected,               label: "Paid"        },
      { name: "unpaid", value: totalRevenue - totalCollected, label: "Outstanding" },
    ]
    const collectionRate = totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0

    return { invoices, stats: { totalRevenue, totalCollected, paidCount, unpaidCount, collectionRate, monthly, pieData } }
  }, [activeInvoices])

  const tableInvoices = React.useMemo(() =>
    invoices.map(inv => ({
      id: inv.id,
      invoice_no: inv.invoice_no, date: inv.date,
      amount: inv.total, status: inv.status, customer: inv.customer,
      site_name: inv.site_name,
      total: inv.total,
      category: classifyCategory(inv.description),
    }))
  , [invoices])

  const filteredInvoices = React.useMemo(() =>
    filterStatus ? tableInvoices.filter(i => i.status === filterStatus) : tableInvoices
  , [tableInvoices, filterStatus])

  const handleFilter = (status: string | null) => {
    setFilterStatus(status)
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <style dangerouslySetInnerHTML={{ __html: DASHBOARD_STYLES }} />

        <div className="flex flex-1 flex-col gap-6 p-6">

          {/* ── FIX #4 + #5: Hero with office bg + beautiful typography ── */}
          <div className="hero-office-wrap">
            {/* Fallback gradient (shown if image fails) */}
            <div className="hero-fallback-bg" />
            {/* Real office photo — /public/office-bg.jpg */}
            <img
              src="/office-bg.jpg"
              alt="Office"
              className="hero-office-img"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
            <div className="hero-office-overlay" />

            <div className="hero-office-content">
              {/* Left: text */}
              <div>
                {/* FIX #3: Real logo */}
                <div className="hero-logo-circle">
                  <img
                    src="/logo pt.jpg"
                    alt="TUP Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      const el = e.currentTarget as HTMLImageElement
                      el.style.display = 'none'
                      el.parentElement!.style.background = 'rgba(255,255,255,0.2)'
                    }}
                  />
                </div>

                <p className="hero-greeting">{greeting}, {user.firstName} {emoji}</p>

                <h1 className="hero-company-name">
                  PT TRI BANGUN<br />
                  <span>USAHA PERSADA</span>
                </h1>

                <i className="hero-accent-line" />
                <p className="hero-tagline">Distributor PAC · Automation & Control Systems · Jakarta</p>
              </div>

              {/* Right: stat pills */}
              <div className="hero-stats">
                <div className="hero-stat-pill">
                  <div className="hero-stat-icon">
                    <TrendingUp size={16} color="rgba(255,255,255,0.7)" />
                  </div>
                  <div className="hero-stat-val">{fShort(stats.totalRevenue)}</div>
                  <div className="hero-stat-label">Revenue</div>
                </div>
                <div className="hero-stat-pill">
                  <div className="hero-stat-icon">
                    <Award size={16} color="#86efac" />
                  </div>
                  <div className="hero-stat-val" style={{ color: '#86efac' }}>
                    {stats.collectionRate.toFixed(0)}%
                  </div>
                  <div className="hero-stat-label">Collected</div>
                </div>
                <div className="hero-stat-pill">
                  <div className="hero-stat-icon">
                    <Building2 size={16} color="rgba(255,255,255,0.7)" />
                  </div>
                  <div className="hero-stat-val">{invoices.length}</div>
                  <div className="hero-stat-label">Invoice</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section Cards ── */}
          <SectionCards invoices={tableInvoices} onFilter={handleFilter} periodLabel={periodLabel} />

          {/* ── Revenue Trend ── */}
          <div className="rounded-xl border bg-card p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Revenue Trend {periodLabel}</h3>
              <p className="text-sm text-muted-foreground">Total pendapatan bulanan · {fIDR(stats.totalRevenue)}</p>
            </div>
            <ChartContainer config={trendConfig} className="h-[360px] w-full">
              <AreaChart data={stats.monthly} margin={{ top: 10, left: 20, right: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillRevenueDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-revenue)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={80} tickFormatter={fShort} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => <span className="font-mono">{fIDR(Number(v))}</span>} />} />
                <Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2} fill="url(#fillRevenueDash)" isAnimationActive animationDuration={900} />
              </AreaChart>
            </ChartContainer>
          </div>

          {/* ── Volume + Donut ── */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Volume {periodLabel}</CardTitle>
                <p className="text-sm text-muted-foreground">Paid vs Outstanding per bulan</p>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ChartContainer config={volumeConfig} className="h-full w-full">
                  <BarChart data={stats.monthly} barCategoryGap="25%">
                    <CartesianGrid vertical={false} className="stroke-border" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => <span className="font-mono">{v} invoice</span>} />} />
                    <Bar dataKey="paid"   fill="var(--color-paid)"   radius={[4,4,0,0]} isAnimationActive animationDuration={900} />
                    <Bar dataKey="unpaid" fill="var(--color-unpaid)" radius={[4,4,0,0]} isAnimationActive animationDuration={900} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Status</CardTitle>
                <p className="text-sm text-muted-foreground">Revenue terkumpul vs outstanding</p>
              </CardHeader>
              <CardContent className="h-[320px] flex items-center justify-center relative">
                <ChartContainer config={statusConfig} className="h-full w-full">
                  <PieChart>
                    <Pie data={stats.pieData} dataKey="value" innerRadius={70} outerRadius={110} paddingAngle={4} isAnimationActive animationDuration={900}>
                      <Cell fill="var(--color-paid)"   />
                      <Cell fill="var(--color-unpaid)" />
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => <span className="font-mono">{fIDR(Number(v))}</span>} />} />
                  </PieChart>
                </ChartContainer>
                <div className="absolute text-center pointer-events-none">
                  <p className="text-xs text-muted-foreground">Collected</p>
                  <p className="text-2xl font-bold">{stats.collectionRate.toFixed(0)}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{stats.paidCount} / {stats.paidCount + stats.unpaidCount} inv</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Data Table ── */}
          <div ref={tableRef} className="space-y-2 pt-4">
            <h3 className="text-lg font-bold border-l-4 border-primary pl-3">
              Detail Invoices: <span className="text-primary">{filterStatus || "Semua"}</span>
              <span className="text-sm font-normal text-muted-foreground ml-2">({filteredInvoices.length} invoice)</span>
            </h3>
            <DataTable data={filteredInvoices} />
          </div>

        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
