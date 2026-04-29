"use client"

import * as React from "react"
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, ReferenceLine, Cell,
} from "recharts"
import {
  TrendingUp, DollarSign, Target, Zap,
  BarChart3, Info, Settings2, RotateCcw, AlertTriangle, Calculator,
} from "lucide-react"
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useThemeConfig } from "@/components/ui/active-theme"
import { useFilteredInvoices } from "@/lib/use-filtered-invoices"

// ─── Cost Category ────────────────────────────────────────────────────────────
type CostCategory = {
  id: string; label: string; placeholder: string
  icon: string; color: string
}

const COST_CATEGORIES: CostCategory[] = [
  { id: "gaji",       label: "Gaji & Tunjangan",     placeholder: "Cth: 150,000,000",  icon: "👷", color: "#3B82F6" },
  { id: "operasional",label: "Biaya Operasional",     placeholder: "Cth: 50,000,000",   icon: "⚙️",  color: "#8B5CF6" },
  { id: "material",   label: "Biaya Material/Bahan",  placeholder: "Cth: 80,000,000",   icon: "📦", color: "#F59E0B" },
  { id: "sewa",       label: "Sewa & Utilitas",       placeholder: "Cth: 20,000,000",   icon: "🏢", color: "#10B981" },
  { id: "transport",  label: "Transport & Logistik",  placeholder: "Cth: 15,000,000",   icon: "🚚", color: "#EF4444" },
  { id: "lainnya",    label: "Biaya Lainnya",         placeholder: "Cth: 10,000,000",   icon: "📋", color: "#6B7280" },
]

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

// ─── Formatters ───────────────────────────────────────────────────────────────
const fIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)
const fShort = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1e3).toFixed(0)}K`
  return String(Math.round(n))
}
// Format large ROI values compactly: 444900% → "444.9k%"
const fROI = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 100_000) return `${(n / 1000).toFixed(0)}k%`
  if (abs >= 1_000)   return `${(n / 1000).toFixed(1)}k%`
  return `${n.toFixed(1)}%`
}
// Compact IDR for KPI cards (avoids overflow)
const fIDRShort = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `Rp ${(n / 1e9).toFixed(1)}B`
  if (abs >= 1_000_000)     return `Rp ${(n / 1e6).toFixed(1)}M`
  if (abs >= 1_000)         return `Rp ${(n / 1e3).toFixed(0)}K`
  return fIDR(n)
}
// ─── Classify service ────────────────────────────────────────────────────────
function classify(desc: string) {
  const d = desc.toLowerCase()
  if (d.includes("pemeliharaan") || d.includes("perbaikan") || d.includes("maintenance")) return "Maintenance"
  if (d.includes("material") || d.includes("supply") || d.includes("dp 30%") || d.includes("dp 50%")) return "Material/PAC"
  if (d.includes("instalasi") || d.includes("pemasangan") || d.includes("termin") || d.includes("project")) return "Project/Instalasi"
  return "Jasa"
}

// ─── useThemeColor hook ───────────────────────────────────────────────────────
function useThemeColor(variable: string, watchToken?: string) {
  const [color, setColor] = React.useState("#3b82f6")
  React.useEffect(() => {
    const update = () => {
      const el = document.createElement("div")
      el.style.color = `hsl(var(${variable}))`
      el.style.display = "none"
      document.body.appendChild(el)
      const c = getComputedStyle(el).color
      document.body.removeChild(el)
      const m = c.match(/\d+/g)
      if (m) setColor("#" + m.slice(0,3).map((n:string) => parseInt(n).toString(16).padStart(2,"0")).join(""))
    }

    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [variable, watchToken])
  return color
}

function useFinancialTheme(watchToken?: string) {
  const [theme, setTheme] = React.useState({
    primary: "#3b82f6",
    success: "#16a34a",
    warning: "#d97706",
    danger: "#dc2626",
    violet: "#8b5cf6",
    muted: "#64748b",
    foreground: "#111827",
    border: "#d4d4d8",
    card: "#ffffff",
  })

  React.useEffect(() => {
    const update = () => {
      const probe = document.createElement("div")
      probe.style.display = "none"
      document.body.appendChild(probe)

      const resolve = (property: "color" | "borderColor" | "backgroundColor", value: string) => {
        probe.style.color = ""
        probe.style.borderColor = ""
        probe.style.backgroundColor = ""
        probe.style[property] = value
        return getComputedStyle(probe)[property]
      }

      setTheme({
        primary: resolve("color", "hsl(var(--primary))"),
        success: "#16a34a",
        warning: "#d97706",
        danger: resolve("color", "hsl(var(--destructive))"),
        violet: "#8b5cf6",
        muted: resolve("color", "hsl(var(--muted-foreground))"),
        foreground: resolve("color", "hsl(var(--foreground))"),
        border: resolve("borderColor", "hsl(var(--border))"),
        card: resolve("backgroundColor", "hsl(var(--card))"),
      })

      document.body.removeChild(probe)
    }

    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [watchToken])

  return theme
}

function formatPercentValue(value: number) {
  return fROI(value)
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes scaleIn  { from{opacity:0;transform:scale(0.93)}      to{opacity:1;transform:scale(1)} }
  @keyframes growBar  { from{width:0} to{width:var(--bar-w)} }
  @keyframes shimmer  { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes countUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

  .fp-u1{animation:fadeUp .42s ease both .04s} .fp-u2{animation:fadeUp .42s ease both .10s}
  .fp-u3{animation:fadeUp .42s ease both .16s} .fp-u4{animation:fadeUp .42s ease both .22s}
  .fp-u5{animation:fadeUp .42s ease both .28s} .fp-u6{animation:fadeUp .42s ease both .34s}
  .fp-s1{animation:scaleIn .38s cubic-bezier(.22,.68,0,1.2) both .06s}
  .fp-s2{animation:scaleIn .38s cubic-bezier(.22,.68,0,1.2) both .13s}
  .fp-s3{animation:scaleIn .38s cubic-bezier(.22,.68,0,1.2) both .20s}
  .fp-s4{animation:scaleIn .38s cubic-bezier(.22,.68,0,1.2) both .27s}
  .fp-s5{animation:scaleIn .38s cubic-bezier(.22,.68,0,1.2) both .34s}

  /* Progress bar */
  .bar-fill { width:var(--bar-w); animation:growBar 1.1s cubic-bezier(0.16,1,0.3,1) both .5s }

  /* KPI Cards */
  .kpi-card { transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease; cursor:default }
  .kpi-card:hover { transform:translateY(-3px) scale(1.012) }
  .kpi-default:hover { box-shadow:0 8px 24px -4px hsl(var(--primary)/.18) }
  .kpi-green:hover  { box-shadow:0 8px 24px -4px rgb(34 197 94/.22); border-color:rgb(34 197 94)!important }
  .kpi-red:hover    { box-shadow:0 8px 24px -4px rgb(239 68 68/.22);  border-color:rgb(239 68 68)!important }
  .kpi-amber:hover  { box-shadow:0 8px 24px -4px rgb(245 158 11/.22); border-color:rgb(245 158 11)!important }
  .kpi-violet:hover { box-shadow:0 8px 24px -4px rgb(139 92 246/.22); border-color:rgb(139 92 246)!important }

  /* ROI gauge ring */
  .roi-ring { transition:stroke-dashoffset .9s cubic-bezier(.16,1,.3,1) }

  /* hv-card */
  .hv-card { transition:box-shadow .2s ease }
  .hv-card:hover { box-shadow:0 4px 18px -4px hsl(var(--primary)/.10) }

  /* Cost input */
  .cost-input {
    width:100%;
    background:hsl(var(--muted)/.5);
    border:1px solid hsl(var(--border));
    border-radius:8px;
    padding:8px 12px;
    font-size:13px;
    color:hsl(var(--foreground));
    outline:none;
    transition:border-color .15s, box-shadow .15s;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }
  .cost-input::placeholder { color:hsl(var(--muted-foreground)) }
  .cost-input:focus {
    border-color:hsl(var(--primary)/.5);
    box-shadow:0 0 0 3px hsl(var(--primary)/.08);
    background:hsl(var(--card));
  }

  /* Category tab */
  .cat-bar {
    display:flex; gap:6px; overflow-x:auto; padding-bottom:4px;
  }
  .cat-bar::-webkit-scrollbar { height:3px }
  .cat-bar::-webkit-scrollbar-thumb { background:hsl(var(--border)); border-radius:2px }
  .cat-chip {
    flex-shrink:0; padding:5px 14px; border-radius:99px; font-size:12px; font-weight:600;
    border:1.5px solid hsl(var(--border)); cursor:pointer; white-space:nowrap;
    transition:all .14s; background:transparent; color:hsl(var(--muted-foreground));
  }
  .cat-chip:hover { border-color:hsl(var(--primary)/.5); color:hsl(var(--foreground)) }
  .cat-chip.on {
    background:linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/.82));
    border-color:hsl(var(--primary));
    color:hsl(var(--primary-foreground));
    box-shadow:0 10px 20px -12px hsl(var(--primary)/.7), inset 0 1px 0 hsl(0 0% 100%/.18);
    transform:translateY(-1px) scale(1.02);
  }

  /* Insight box */
  .insight-box {
    border-radius:10px; padding:12px 14px;
    background:hsl(var(--muted)/.4); border:1px solid hsl(var(--border));
    font-size:12px; line-height:1.6; color:hsl(var(--muted-foreground));
  }
  .insight-box strong { color:hsl(var(--foreground)) }

  /* Gauge arc */
  @keyframes arcDraw {
    from { stroke-dashoffset: 440; }
    to   { stroke-dashoffset: var(--arc-offset); }
  }
  .arc-fill { animation: arcDraw 1.4s cubic-bezier(0.16,1,0.3,1) both 0.3s }

  /* ROI status card */
  .roi-status {
    position: relative; overflow: hidden;
    transition: transform .2s; cursor: default;
  }
  .roi-status:hover { transform: scale(1.01) }
  .roi-status::before {
    content:''; position:absolute; inset:0;
    background: linear-gradient(135deg, hsl(var(--primary)/.04) 0%, transparent 60%);
    pointer-events:none;
  }

  /* Trend dot */
  .trend-dot { width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px }

  /* Profitability bar */
  .prof-bar-wrap { height:6px; background:hsl(var(--muted)); border-radius:99px; overflow:hidden; }
  .prof-bar { height:100%; border-radius:99px; transition: width 1s cubic-bezier(.16,1,.3,1) }

  /* tr hover */
  .tr-row { border-bottom:1px solid hsl(var(--border)/.5); transition:background .12s }
  .tr-row:last-child { border-bottom:none }
  .tr-row:hover { background:hsl(var(--muted)/.4) }

  /* input alert */
  .needs-input { animation: pulse 2s ease-in-out infinite }

  /* section label */
  .section-badge {
    display:inline-flex; align-items:center; gap:6px;
    padding:3px 10px; border-radius:99px; font-size:10.5px; font-weight:700;
    letter-spacing:.04em; text-transform:uppercase;
  }
`

// ─── ROI Gauge Component ──────────────────────────────────────────────────────
function ROIGauge({
  roi,
  hasData,
  accentColor,
  mutedColor,
}: {
  roi: number
  hasData: boolean
  accentColor: string
  mutedColor: string
}) {
  // Half arc (180deg) = circumference / 2 = 220
  const halfArc = 220
  // Clamp ROI: 0–200% range mapped to arc
  const clampedRoi = Math.min(Math.max(roi, 0), 200)
  const fillFraction = clampedRoi / 200
  const arcOffset = halfArc - fillFraction * halfArc
  const roiColor = roi >= 0 ? accentColor : "#DC2626"

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ position: "relative", width: 200, height: 110 }}>
        <svg width="200" height="120" viewBox="0 0 200 120">
          {/* Track */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none" stroke={mutedColor} strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Fill */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none" stroke={hasData ? roiColor : mutedColor}
            strokeWidth="14" strokeLinecap="round"
            strokeDasharray={`${halfArc} ${halfArc}`}
            className="arc-fill"
            style={{ "--arc-offset": `${arcOffset}` } as React.CSSProperties}
          />
          {/* Needle */}
          {hasData && (
            <line
              x1="100" y1="100"
              x2={100 + 60 * Math.cos(Math.PI + fillFraction * Math.PI)}
              y2={100 + 60 * Math.sin(Math.PI + fillFraction * Math.PI)}
              stroke={roiColor} strokeWidth="2.5" strokeLinecap="round"
              style={{ transition: "all 1.4s cubic-bezier(.16,1,.3,1)" }}
            />
          )}
          <circle cx="100" cy="100" r="5" fill={hasData ? roiColor : mutedColor} />
        </svg>
        {/* Center text */}
        <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center" }}>
          {hasData ? (
            <>
              <div style={{ fontSize: Math.abs(roi) >= 1000 ? 18 : 26, fontWeight: 800, color: roiColor, lineHeight: 1, fontFamily: "monospace" }}>
                {fROI(roi)}
              </div>
              <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>ROI</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: mutedColor }}>Input cost →</div>
          )}
        </div>
      </div>
      {/* Scale labels */}
      <div style={{ display: "flex", justifyContent: "space-between", width: 190, fontSize: 10, color: mutedColor }}>
        <span>0%</span>
        <span style={{ color: accentColor }}>50%</span>
        <span style={{ color: accentColor }}>100%</span>
        <span>200%</span>
      </div>
    </div>
  )
}

// ─── Chart configs (CSS-variable-based, always theme-accurate) ───────────────
const marginChartConfig = {
  margin: { label: "Margin DPP", color: "hsl(var(--primary))" },
} satisfies ChartConfig

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FinancialPerformancePage() {
  const { activeTheme } = useThemeConfig()
  const { invoices: raw, periodLabel } = useFilteredInvoices()
  const primaryColor = useThemeColor("--primary", activeTheme)
  const palette = useFinancialTheme(activeTheme)

  // ── Cost state — persisted in sessionStorage ──────────────────────────────
  const [costs, setCosts] = React.useState<Record<string, number>>({})
  const [costInputs, setCostInputs] = React.useState<Record<string, string>>({})
  const [showCostPanel, setShowCostPanel] = React.useState(true)
  const [activeCat, setActiveCat] = React.useState("Semua")

  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem("fp_costs")
      if (saved) {
        const parsed = JSON.parse(saved)
        setCosts(parsed)
        const inputs: Record<string, string> = {}
        Object.entries(parsed).forEach(([k, v]) => {
          if ((v as number) > 0) inputs[k] = (v as number).toLocaleString("id-ID")
        })
        setCostInputs(inputs)
      }
    } catch {}
  }, [])

  const handleCostChange = (id: string, raw: string) => {
    const digits = raw.replace(/[^\d]/g, "")
    const num = digits ? parseInt(digits) : 0
    setCostInputs(prev => ({ ...prev, [id]: num ? num.toLocaleString("id-ID") : "" }))
    setCosts(prev => {
      const next = { ...prev, [id]: num }
      try { sessionStorage.setItem("fp_costs", JSON.stringify(next)) } catch {}
      return next
    })
  }

  const resetCosts = () => {
    setCosts({})
    setCostInputs({})
    try { sessionStorage.removeItem("fp_costs") } catch {}
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = React.useMemo(() => {
    const totalRevenue    = raw.reduce((s, i) => s + (i.total || 0), 0)
    const totalDPP        = raw.reduce((s, i) => s + (i.dpp || 0), 0)
    const totalPPN        = raw.reduce((s, i) => s + (i.ppn || 0), 0)
    const totalCollected  = raw.reduce((s, i) => s + (i.payment_value || 0), 0)
    const totalUnpaid     = raw.filter(i => i.status === "UNPAID").reduce((s, i) => s + i.total, 0)
    const paidCount       = raw.filter(i => i.status === "PAID").length
    const totalSelisih    = raw.reduce((s, i) => s + (i.selisih || 0), 0)
    const collectionRate  = totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0

    // Gross Profit = DPP (nilai bersih sebelum pajak) yang sudah terkumpul
    // Lebih akurat: DPP adalah basis pendapatan bersih perusahaan
    const grossProfit     = totalDPP
    const grossMargin     = totalRevenue > 0 ? (totalDPP / totalRevenue) * 100 : 0

    // Category breakdown
    const catMap: Record<string, { rev: number; dpp: number; count: number; paid: number }> = {}
    raw.forEach(inv => {
      const cat = classify(inv.description)
      if (!catMap[cat]) catMap[cat] = { rev: 0, dpp: 0, count: 0, paid: 0 }
      catMap[cat].rev += inv.total || 0
      catMap[cat].dpp += inv.dpp || 0
      catMap[cat].count++
      if (inv.status === "PAID") catMap[cat].paid++
    })
    const byCategory = Object.entries(catMap)
      .map(([name, d]) => ({
        name,
        revenue: d.rev,
        dpp: d.dpp,
        margin: d.rev > 0 ? (d.dpp / d.rev) * 100 : 0,
        count: d.count,
        paid: d.paid,
        rate: d.count > 0 ? (d.paid / d.count) * 100 : 0,
        share: totalRevenue > 0 ? (d.rev / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    // Monthly: revenue, dpp, collected
    const monthly = MONTHS.map((month, idx) => {
      const rows = raw.filter(i => i.month === idx + 1)
      const rev  = rows.reduce((s, i) => s + i.total, 0)
      const dpp  = rows.reduce((s, i) => s + i.dpp, 0)
      const col  = rows.reduce((s, i) => s + i.payment_value, 0)
      const margin = rev > 0 ? (dpp / rev) * 100 : 0
      return { month, revenue: rev, dpp, collected: col, margin }
    })

    // Avg payment speed (days) from paid invoices
    const paidInvoices = raw.filter(i => i.status === "PAID" && i.date && i.payment_date)
    const avgDays = paidInvoices.length > 0
      ? Math.round(paidInvoices.reduce((s, i) => {
          const diff = (new Date(i.payment_date).getTime() - new Date(i.date).getTime()) / 86400000
          return s + Math.max(0, diff)
        }, 0) / paidInvoices.length)
      : 0

    // Outstanding risk
    const outstandingRisk = totalRevenue > 0 ? (totalUnpaid / totalRevenue) * 100 : 0

    // Top clients by DPP
    const clientMap: Record<string, { dpp: number; rev: number; count: number }> = {}
    raw.forEach(i => {
      const name = i.customer.split("(")[0].trim()
      if (!clientMap[name]) clientMap[name] = { dpp: 0, rev: 0, count: 0 }
      clientMap[name].dpp += i.dpp || 0
      clientMap[name].rev += i.total || 0
      clientMap[name].count++
    })
    const topByDpp = Object.entries(clientMap)
      .map(([name, d]) => ({ name, dpp: d.dpp, rev: d.rev, count: d.count, margin: d.rev > 0 ? (d.dpp/d.rev)*100 : 0 }))
      .sort((a, b) => b.dpp - a.dpp).slice(0, 6)

    return {
      totalRevenue, totalDPP, totalPPN, totalCollected, totalUnpaid,
      paidCount, totalInvoices: raw.length, totalSelisih,
      collectionRate, grossProfit, grossMargin,
      byCategory, monthly, avgDays, outstandingRisk, topByDpp,
    }
  }, [raw])

  // ── ROI Calculation ────────────────────────────────────────────────────────
  const costData = React.useMemo(() => {
    const totalCost = Object.values(costs).reduce((s, v) => s + (v || 0), 0)
    const hasData   = totalCost > 0

    // Net Profit = Collected Revenue - Total Cost
    const netProfit = hasData ? stats.totalCollected - totalCost : 0
    const roi       = hasData && totalCost > 0 ? (netProfit / totalCost) * 100 : 0
    const netMargin = hasData && stats.totalCollected > 0 ? (netProfit / stats.totalCollected) * 100 : 0

    // Payback: jika ROI positif, berapa bulan untuk recover cost
    // Asumsi: monthly collected = totalCollected / active months
    const activeMonths = stats.monthly.filter(m => m.collected > 0).length || 1
    const avgMonthlyCollected = stats.totalCollected / activeMonths
    const paybackMonths = hasData && avgMonthlyCollected > 0 ? totalCost / avgMonthlyCollected : 0

    // Breakeven point: bulan ke berapa collected = cost
    const breakEvenMonth = paybackMonths > 0 ? Math.ceil(paybackMonths) : null

    // Efficiency: collected revenue per IDR cost
    const revenuePerCost = hasData && totalCost > 0 ? stats.totalCollected / totalCost : 0

    // Monthly cumulative for ROI trend
    const cumulativeData = stats.monthly.map((m, idx) => {
      const cumCollected = stats.monthly.slice(0, idx + 1).reduce((s, x) => s + x.collected, 0)
      const monthCost    = hasData ? totalCost / 12 : 0
      const cumCost      = monthCost * (idx + 1)
      const cumROI       = hasData && cumCost > 0 ? ((cumCollected - cumCost) / cumCost) * 100 : 0
      return {
        month: m.month, collected: cumCollected,
        cost: Math.round(cumCost), profit: cumCollected - cumCost, roi: cumROI,
      }
    })

    return {
      totalCost, hasData, netProfit, roi, netMargin,
      paybackMonths, breakEvenMonth, revenuePerCost, cumulativeData,
    }
  }, [costs, stats])

  const CAT_COLORS: Record<string, string> = {
    "Maintenance":       "#3B82F6",
    "Material/PAC":      "#8B5CF6",
    "Project/Instalasi": "#F59E0B",
    "Jasa":              "#10B981",
  }

  const displayedCategories = activeCat === "Semua"
    ? stats.byCategory
    : stats.byCategory.filter(c => c.name === activeCat)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />

        <div className="flex flex-1 flex-col gap-6 p-6">

          {/* ── Header ────────────────────────────────────────────────── */}
          <div className="fp-u1 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-semibold">Financial Performance</h1>
                <span className="section-badge bg-primary/10 text-primary border border-primary/20">
                  <TrendingUp className="h-3 w-3" /> ROI Dashboard
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Analisis profitabilitas, margin, dan Return on Investment · {periodLabel}
              </p>
            </div>
            {!costData.hasData && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-600 font-medium needs-input">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Input biaya operasional di bawah untuk menghitung ROI sejati
              </div>
            )}
          </div>

          {/* ── 5 KPI CARDS ───────────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {/* Gross Revenue */}
            <div className="fp-s1">
              <Card className="kpi-card kpi-default">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Gross Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold leading-tight">{fIDRShort(stats.totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{fIDR(stats.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">{stats.totalInvoices} invoice · incl. PPN</p>
                </CardContent>
              </Card>
            </div>

            {/* Net Revenue (DPP) */}
            <div className="fp-s2">
              <Card className="kpi-card kpi-green">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Net Revenue (DPP)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold leading-tight text-green-600">{fIDRShort(stats.totalDPP)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{fIDR(stats.totalDPP)}</p>
                  <p className="text-xs text-green-600">{stats.grossMargin.toFixed(1)}% dari gross</p>
                </CardContent>
              </Card>
            </div>

            {/* Uang Terkumpul */}
            <div className="fp-s3">
              <Card className="kpi-card kpi-violet" style={{ "--kpi-color": "#8B5CF6" } as React.CSSProperties}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Uang Terkumpul</CardTitle>
                  <Zap className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold leading-tight text-violet-600">{fIDRShort(stats.totalCollected)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{fIDR(stats.totalCollected)}</p>
                  <p className="text-xs text-violet-600">{stats.collectionRate.toFixed(1)}% collection rate</p>
                </CardContent>
              </Card>
            </div>

            {/* ROI Estimasi */}
            <div className="fp-s4">
              <Card className={`kpi-card ${costData.hasData ? (costData.roi >= 0 ? "kpi-green" : "kpi-red") : "kpi-amber"}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">ROI</CardTitle>
                  <Target className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-bold leading-tight ${costData.hasData ? (costData.roi >= 0 ? "text-green-600" : "text-destructive") : "text-amber-500"}`}>
                    {costData.hasData ? fROI(costData.roi) : "Belum dihitung"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {costData.hasData
                      ? `Profit: ${fIDRShort(costData.netProfit)}`
                      : "Input biaya di bawah ↓"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Payback */}
            <div className="fp-s5">
              <Card className="kpi-card kpi-default">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Payback Period</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="break-words text-lg font-bold leading-tight lg:text-xl">
                    {costData.hasData
                      ? costData.paybackMonths < 1
                        ? "< 1 bln"
                        : `${costData.paybackMonths.toFixed(1)} bln`
                      : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {costData.hasData
                      ? costData.paybackMonths <= 6 ? "✓ Balik modal cepat" : costData.paybackMonths <= 12 ? "~ Dalam setahun" : "⚠ Perlu perhatian"
                      : "Avg bayar: " + stats.avgDays + " hari"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── ROI GAUGE + COST INPUT PANEL ──────────────────────────── */}
          <div className="fp-u2 grid gap-6 lg:grid-cols-5">

            {/* ROI Gauge — kiri */}
            <Card className="hv-card lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>ROI Overview</CardTitle>
                    <CardDescription>Return on Investment berdasarkan biaya yang diinput</CardDescription>
                  </div>
                  {costData.hasData && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${costData.roi >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                      {costData.roi >= 100 ? "EXCELLENT" : costData.roi >= 50 ? "BAIK" : costData.roi >= 0 ? "POSITIF" : "NEGATIF"}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <ROIGauge
                  roi={costData.hasData ? costData.roi : 0}
                  hasData={costData.hasData}
                  accentColor={primaryColor}
                  mutedColor={palette.muted}
                />

                {/* 3 metric pills */}
                <div className="grid grid-cols-3 gap-3 w-full border-t pt-4">
                  {[
                    { label: "Net Profit",   val: costData.hasData ? fIDR(costData.netProfit) : "—",              color: costData.hasData ? (costData.netProfit >= 0 ? "text-primary" : "text-destructive") : "text-muted-foreground" },
                    { label: "Net Margin",   val: costData.hasData ? `${costData.netMargin.toFixed(1)}%` : "—",    color: costData.hasData ? (costData.netMargin >= 0 ? "text-primary" : "text-destructive") : "text-muted-foreground" },
                    { label: "Efisiensi",    val: costData.hasData ? `${costData.revenuePerCost.toFixed(2)}x` : "—", color: costData.hasData ? (costData.revenuePerCost >= 1 ? "text-primary" : "text-destructive") : "text-muted-foreground" },
                  ].map(m => (
                    <div key={m.label} className="text-center rounded-lg bg-muted/40 p-3">
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">{m.label}</p>
                      <p className={`text-xs font-bold font-mono ${m.color}`}>{m.val}</p>
                    </div>
                  ))}
                </div>

                {costData.hasData && (
                  <div className="insight-box w-full">
                    <div className="flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                      <span>
                        Dari setiap <strong>Rp 1</strong> yang diinvestasikan, perusahaan menghasilkan{" "}
                        <strong className={costData.revenuePerCost >= 1 ? "text-primary" : "text-destructive"}>
                          Rp {costData.revenuePerCost.toFixed(2)}
                        </strong>.{" "}
                        {costData.roi >= 100
                          ? <span className="text-primary font-semibold">ROI di atas 100% — excellent performance. ↑</span>
                          : costData.roi >= 0
                          ? <span className="text-primary font-semibold">ROI positif, masih ada ruang untuk optimasi.</span>
                          : <span className="text-destructive font-semibold">ROI negatif — cost melebihi pendapatan terkumpul. Perlu evaluasi.</span>}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cost Input Panel — kanan */}
            <Card className="hv-card lg:col-span-3">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-primary" />
                      <CardTitle>Input Biaya Operasional</CardTitle>
                    </div>
                    <CardDescription className="mt-1">
                      Masukkan biaya bulanan rata-rata untuk menghitung ROI sejati perusahaan
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {costData.hasData && (
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">Total Cost</p>
                        <p className="text-sm font-bold text-destructive font-mono">{fIDR(costData.totalCost)}</p>
                      </div>
                    )}
                    <button
                      onClick={() => setShowCostPanel(p => !p)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border rounded-md px-2 py-1 transition-colors"
                    >
                      <Settings2 className="h-3 w-3" />
                      {showCostPanel ? "Sembunyikan" : "Tampilkan"}
                    </button>
                  </div>
                </div>
              </CardHeader>
              {showCostPanel && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {COST_CATEGORIES.map(cat => (
                      <div key={cat.id} className="space-y-1.5">
                        <label className="text-xs font-medium flex items-center gap-1.5">
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                          {costs[cat.id] > 0 && (
                            <span className="ml-auto text-[10px] text-green-600 font-semibold">✓</span>
                          )}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder={cat.placeholder}
                          value={costInputs[cat.id] || ""}
                          onChange={e => handleCostChange(cat.id, e.target.value)}
                          className="cost-input"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Cost breakdown bar */}
                  {costData.hasData && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground font-medium">Distribusi Biaya</p>
                      <div className="space-y-2">
                        {COST_CATEGORIES.filter(c => (costs[c.id] || 0) > 0).map(c => {
                          const pct = costData.totalCost > 0 ? ((costs[c.id] || 0) / costData.totalCost) * 100 : 0
                          return (
                            <div key={c.id} className="flex items-center gap-3">
                              <span className="text-xs w-32 shrink-0 text-muted-foreground">{c.label}</span>
                              <div className="flex-1 prof-bar-wrap">
                                <div className="prof-bar" style={{ width: `${pct}%`, background: c.color }} />
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                              <span className="text-[10px] font-mono w-24 text-right">{fShort(costs[c.id] || 0)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] text-muted-foreground">
                      * Angka ini digunakan untuk menghitung ROI, tidak tersimpan permanen
                    </p>
                    {costData.hasData && (
                      <button onClick={resetCosts} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                        <RotateCcw className="h-3 w-3" /> Reset
                      </button>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* ── ROI TREND CHART (cumulative) ───────────────────────────── */}
          {costData.hasData && (
            <div className="fp-u3">
              <Card className="hv-card">
                <CardHeader>
                  <CardTitle>ROI Trend Kumulatif {periodLabel}</CardTitle>
                  <CardDescription>Akumulasi uang terkumpul vs biaya operasional per bulan · titik ROI positif = break-even tercapai</CardDescription>
                </CardHeader>
                <CardContent>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={costData.cumulativeData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={palette.border} />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: palette.muted }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: palette.muted }} tickFormatter={fShort} width={60} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            const d = payload[0]?.payload
                            return (
                              <div className="min-w-[200px] rounded-xl border border-border px-3 py-2.5 text-xs shadow-md bg-popover text-popover-foreground">
                                <p className="mb-2 font-semibold">{label} {periodLabel} (Kumulatif)</p>
                                <p style={{ color: primaryColor }}>Terkumpul: <span className="font-mono font-bold">{fIDR(d?.collected || 0)}</span></p>
                                <p className="text-destructive">Biaya: <span className="font-mono font-bold">{fIDR(d?.cost || 0)}</span></p>
                                <p style={{ color: d?.profit >= 0 ? primaryColor : "#DC2626" }}>
                                  Profit: <span className="font-mono font-bold">{fIDR(d?.profit || 0)}</span>
                                </p>
                                <p className="mt-1 text-muted-foreground">ROI: <span className="font-bold text-foreground">{(d?.roi || 0).toFixed(1)}%</span></p>
                              </div>
                            )
                          }}
                        />
                        <ReferenceLine y={0} stroke={palette.border} strokeWidth={1.5} />
                        <Line dataKey="collected" stroke={primaryColor} strokeWidth={2.5} dot={false} name="Terkumpul" />
                        <Line dataKey="cost"      stroke="#DC2626" strokeWidth={2} dot={false} strokeDasharray="5 4" name="Biaya" />
                        <Line dataKey="profit"    stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3, fill: "#16A34A" }} name="Net Profit" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-5 mt-3 flex-wrap">
                    {[
                      { color: primaryColor,  label: "Uang Terkumpul (kumulatif)" },
                      { color: "#DC2626",     label: "Total Biaya (kumulatif)", dash: true },
                      { color: "#16A34A",     label: "Net Profit (kumulatif)" },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <span className="h-0.5 w-5 shrink-0 inline-block" style={{ background: l.color, borderTop: l.dash ? `2px dashed ${l.color}` : undefined }} />
                        <span className="text-xs text-muted-foreground">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── PROFITABILITY BY CATEGORY + MONTHLY MARGIN ─────────────── */}
          <div className="fp-u4 grid gap-6 lg:grid-cols-2">

            {/* By Category */}
            <Card className="hv-card">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle>Profitabilitas per Kategori</CardTitle>
                    <CardDescription>Revenue, margin DPP, dan collection rate per tipe layanan</CardDescription>
                  </div>
                </div>
                <div className="cat-bar mt-2">
                  {["Semua", ...stats.byCategory.map(c => c.name)].map(c => (
                    <button key={c} onClick={() => setActiveCat(c)} className={`cat-chip ${activeCat === c ? "on" : ""}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={displayedCategories} barCategoryGap="30%" margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={palette.border} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: palette.muted }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: palette.muted }} tickFormatter={fShort} width={50} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0]?.payload
                          return (
                            <div className="min-w-[180px] rounded-xl border border-border px-3 py-2.5 text-xs shadow-md bg-popover text-popover-foreground">
                              <p className="mb-1.5 font-semibold">{label}</p>
                              <p className="text-muted-foreground">Revenue: <span className="font-mono font-bold text-foreground">{fIDR(d?.revenue)}</span></p>
                              <p className="text-muted-foreground">DPP (Bersih): <span className="font-mono font-bold" style={{ color: primaryColor }}>{fIDR(d?.dpp)}</span></p>
                              <p className="text-muted-foreground">Margin: <span className="font-bold" style={{ color: primaryColor }}>{d?.margin?.toFixed(1)}%</span></p>
                              <p className="text-muted-foreground">Collection: <span className="font-bold text-foreground">{d?.rate?.toFixed(0)}%</span></p>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900}>
                        {displayedCategories.map((entry) => (
                          <Cell key={entry.name} fill={CAT_COLORS[entry.name] || "#94A3B8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Category detail table */}
                <div className="mt-4 border rounded-lg overflow-hidden">
                  {displayedCategories.map((cat, i) => (
                    <div key={cat.name} className={`tr-row flex items-center gap-3 px-3 py-2.5 ${i === 0 ? "" : ""}`}>
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CAT_COLORS[cat.name] || "#94A3B8" }} />
                      <span className="text-sm font-medium flex-1 min-w-0 truncate">{cat.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">{fShort(cat.revenue)}</span>
                      <span className="text-xs font-semibold text-primary w-12 text-right">{cat.margin.toFixed(0)}%</span>
                      <span className={`text-xs font-semibold w-10 text-right ${cat.share >= 30 ? "text-primary" : "text-muted-foreground"}`}>
                        {cat.share.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Margin Trend */}
            <Card className="hv-card">
              <CardHeader>
                <CardTitle>Margin DPP per Bulan</CardTitle>
                <CardDescription>Persentase nilai bersih (DPP) terhadap total revenue per bulan · target margin optimal 85%+</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={marginChartConfig} className="h-[220px] w-full">
                  <BarChart data={stats.monthly.filter(m => m.revenue > 0)} barCategoryGap="30%" margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={palette.border} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: palette.muted }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: palette.muted }} tickFormatter={v => `${v.toFixed(0)}%`} domain={[0, 100]} width={45} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0]?.payload
                        return (
                          <div className="min-w-[160px] rounded-xl border border-border px-3 py-2.5 text-xs shadow-md bg-popover text-popover-foreground">
                            <p className="mb-1 font-semibold">{label} {periodLabel}</p>
                            <p>Margin DPP: <span className="font-bold text-primary">{d?.margin?.toFixed(1)}%</span></p>
                            <p className="text-muted-foreground">Revenue: <span className="text-foreground">{fIDR(d?.revenue)}</span></p>
                            <p className="text-primary">DPP: {fIDR(d?.dpp)}</p>
                          </div>
                        )
                      }}
                    />
                    <ReferenceLine y={90.9} stroke="hsl(var(--primary))" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "91% (Target)", position: "right", fontSize: 9, fill: palette.muted }} />
                    <Bar dataKey="margin" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900} style={{ fill: "hsl(var(--primary))" }} />
                  </BarChart>
                </ChartContainer>
                <div className="insight-box mt-4">
                  <div className="flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                    <span>
                      Margin DPP mencerminkan proporsi nilai jasa bersih yang kita hasilkan sebelum pajak. Garis hijau menunjukkan target margin teoritis 90.9% (DPP = 100/110 dari total). Bulan dengan margin di bawah target bisa mengindikasikan lebih banyak invoice dengan skema berbeda atau diskon.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── TOP CLIENT PROFITABILITY ───────────────────────────────── */}
          <div className="fp-u5">
            <Card className="hv-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Top Client by DPP (Net Revenue)</CardTitle>
                    <CardDescription>Klien diranking berdasarkan nilai DPP bersih — lebih akurat dari gross revenue untuk analisis profitabilitas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'hsl(var(--primary) / 0.10)', borderBottom: '2px solid hsl(var(--primary) / 0.22)' }}>
                      <th className="px-6 py-3 text-left font-bold text-primary/80 text-xs uppercase tracking-wide w-8">#</th>
                      <th className="px-6 py-3 text-left font-bold text-primary/80 text-xs uppercase tracking-wide">Klien</th>
                      <th className="px-6 py-3 text-right font-bold text-primary/80 text-xs uppercase tracking-wide">Gross Revenue</th>
                      <th className="px-6 py-3 text-right font-bold text-primary/80 text-xs uppercase tracking-wide">Net DPP</th>
                      <th className="px-6 py-3 text-right font-bold text-primary/80 text-xs uppercase tracking-wide">Margin</th>
                      <th className="px-6 py-3 text-right font-bold text-primary/80 text-xs uppercase tracking-wide">% Kontribusi</th>
                      <th className="px-6 py-3 font-bold text-primary/80 text-xs uppercase tracking-wide">Porsi DPP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topByDpp.map((client, i) => {
                      const share = stats.totalDPP > 0 ? (client.dpp / stats.totalDPP) * 100 : 0
                      return (
                        <tr key={client.name} className="tr-row">
                          <td className="px-6 py-3 text-xs font-bold text-muted-foreground">{i + 1}</td>
                          <td className="px-6 py-3 font-semibold text-sm max-w-[200px] truncate">{client.name}</td>
                          <td className="px-6 py-3 text-right font-mono text-xs text-muted-foreground">{fIDR(client.rev)}</td>
                          <td className="px-6 py-3 text-right font-mono text-xs font-bold text-primary">{fIDR(client.dpp)}</td>
                          <td className="px-6 py-3 text-right">
                            <span className={`text-xs font-bold ${client.margin >= 88 ? "text-primary" : "text-amber-600"}`}>
                              {client.margin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right text-xs font-semibold text-primary">{share.toFixed(1)}%</td>
                          <td className="px-6 py-3 w-32">
                            <div className="prof-bar-wrap">
                              <div className="prof-bar bg-primary" style={{ width: `${share}%` }} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/40 border-t-2 font-semibold">
                      <td className="px-6 py-3" />
                      <td className="px-6 py-3 text-sm">Total (Top 6)</td>
                      <td className="px-6 py-3 text-right font-mono text-xs">{fIDR(stats.topByDpp.reduce((s, c) => s + c.rev, 0))}</td>
                      <td className="px-6 py-3 text-right font-mono text-xs text-primary">{fIDR(stats.topByDpp.reduce((s, c) => s + c.dpp, 0))}</td>
                      <td className="px-6 py-3 text-right text-xs">
                        {stats.topByDpp.length > 0
                          ? `${(stats.topByDpp.reduce((s, c) => s + c.margin, 0) / stats.topByDpp.length).toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="px-6 py-3 text-right text-xs">
                        {stats.totalDPP > 0
                          ? `${(stats.topByDpp.reduce((s, c) => s + c.dpp, 0) / stats.totalDPP * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="px-6 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* ── OUTSTANDING RISK + COLLECTION EFFICIENCY ──────────────── */}
          <div className="fp-u6 grid gap-6 lg:grid-cols-2">

            {/* Outstanding Risk */}
            <Card className="hv-card">
              <CardHeader>
                <CardTitle>Outstanding Risk Analysis</CardTitle>
                <CardDescription>Berapa persen revenue yang masih berisiko tidak tertagih</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Risk gauge */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Revenue at Risk</span>
                    <span className={`font-bold ${stats.outstandingRisk > 20 ? "text-destructive" : stats.outstandingRisk > 10 ? "text-amber-500" : "text-primary"}`}>
                      {stats.outstandingRisk.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="bar-fill h-full rounded-full"
                      style={{
                        "--bar-w": `${stats.outstandingRisk}%`,
                        background: stats.outstandingRisk > 20 ? "#DC2626" : stats.outstandingRisk > 10 ? "#F59E0B" : primaryColor,
                      } as React.CSSProperties}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0% (Ideal)</span>
                    <span className={stats.outstandingRisk > 20 ? "text-destructive font-medium" : stats.outstandingRisk > 10 ? "text-amber-500 font-medium" : "text-primary font-medium"}>
                      {stats.outstandingRisk > 20 ? "⚠ Risiko Tinggi" : stats.outstandingRisk > 10 ? "~ Perhatikan" : "✓ Aman"}
                    </span>
                    <span>30%+</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Total Revenue", val: fIDR(stats.totalRevenue), color: "" },
                    { label: "Sudah Terkumpul", val: fIDR(stats.totalCollected), color: "text-primary" },
                    { label: "Masih Outstanding", val: fIDR(stats.totalUnpaid), color: "text-destructive" },
                    { label: "Selisih/Diskon", val: fIDR(stats.totalSelisih), color: "text-amber-600" },
                  ].map(m => (
                    <div key={m.label} className="rounded-lg bg-muted/40 p-3">
                      <p className="text-[10px] text-muted-foreground mb-1">{m.label}</p>
                      <p className={`text-xs font-bold font-mono ${m.color}`}>{m.val}</p>
                    </div>
                  ))}
                </div>

                <div className="insight-box">
                  <div className="flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                    <span>
                      <strong>{stats.outstandingRisk.toFixed(1)}%</strong> dari total revenue masih dalam kondisi outstanding.
                      {stats.outstandingRisk <= 10
                        ? <span className="text-primary font-semibold"> Risiko rendah — cash flow sehat.</span>
                        : stats.outstandingRisk <= 20
                        ? <span className="text-amber-600 font-semibold"> Perlu monitoring — lakukan follow-up rutin.</span>
                        : <span className="text-destructive font-semibold"> Risiko tinggi — prioritaskan penagihan segera.</span>}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Collection Efficiency */}
            <Card className="hv-card">
              <CardHeader>
                <CardTitle>Collection Efficiency Metrics</CardTitle>
                <CardDescription>Kecepatan dan efisiensi proses penagihan invoice perusahaan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Rata-rata Waktu Bayar",
                      val: stats.avgDays > 0 ? `${stats.avgDays} Hari` : "—",
                      sub: stats.avgDays > 0
                        ? stats.avgDays <= 30 ? "✓ Sangat cepat" : stats.avgDays <= 60 ? "~ Normal" : "⚠ Lambat"
                        : "Belum ada data",
                      valColor: stats.avgDays > 0
                        ? stats.avgDays <= 30 ? "text-primary" : stats.avgDays <= 60 ? "text-primary" : "text-amber-500"
                        : "text-muted-foreground",
                    },
                    {
                      label: "Collection Rate",
                      val: `${stats.collectionRate.toFixed(1)}%`,
                      sub: stats.collectionRate >= 80 ? "✓ Sehat" : "⚠ Perlu perhatian",
                      valColor: stats.collectionRate >= 80 ? "text-primary" : "text-amber-500",
                    },
                    {
                      label: "Invoice Terbayar",
                      val: `${stats.paidCount} / ${stats.totalInvoices}`,
                      sub: `${(stats.totalInvoices > 0 ? (stats.paidCount / stats.totalInvoices) * 100 : 0).toFixed(0)}% invoice lunas`,
                      valColor: "text-primary",
                    },
                    {
                      label: "Revenue Efficiency",
                      val: stats.totalRevenue > 0 ? `${(stats.totalCollected / stats.totalRevenue * 100).toFixed(1)}%` : "—",
                      sub: "Collected / Gross Revenue",
                      valColor: stats.totalCollected >= stats.totalRevenue * 0.8 ? "text-primary" : "text-amber-500",
                    },
                  ].map(m => (
                    <div key={m.label} className="rounded-lg bg-muted/40 p-4 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{m.label}</p>
                      <p className={`text-xl font-bold ${m.valColor}`}>{m.val}</p>
                      <p className="text-[10px] text-muted-foreground">{m.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Monthly collection bars */}
                <div className="border-t pt-4 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Collection Rate per Bulan Aktif</p>
                  {stats.monthly.filter(m => m.revenue > 0).map(m => {
                    const rate = m.revenue > 0 ? (m.collected / m.revenue) * 100 : 0
                    return (
                      <div key={m.month} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-6 shrink-0">{m.month}</span>
                        <div className="flex-1 prof-bar-wrap">
                          <div
                            className="prof-bar"
                            style={{
                              width: `${rate}%`,
                              background: rate >= 80 ? primaryColor : rate >= 50 ? "#F59E0B" : "#DC2626",
                            }}
                          />
                        </div>
                        <span className={`text-xs font-semibold w-12 text-right ${rate >= 80 ? "text-primary" : rate >= 50 ? "text-amber-500" : "text-destructive"}`}>
                          {rate.toFixed(0)}%
                        </span>
                        <span className="text-[10px] text-muted-foreground w-20 text-right font-mono">{fShort(m.collected)}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
