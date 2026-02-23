"use client"

import * as React from "react"
import {
  FolderKanban, ChevronDown, ChevronUp, Search,
  CircleDot, CheckCircle2, AlertTriangle,
  CalendarDays, Receipt, TrendingUp,
  Package, Wrench, Briefcase, X, Filter,
  Hash,
} from "lucide-react"
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import invoicesRaw from "@/data/invoices-2025.json"

// ─── Types ────────────────────────────────────────────────────────────────────
type Invoice = {
  no: number; invoice_no: string; customer: string; description: string
  date: string; year: number; month: number; dpp: number; ppn: number
  total: number; payment_date: string; payment_value: number
  selisih: number; keterangan: string; status: "PAID" | "UNPAID"
}

type Project = {
  id: string
  poKey: string
  clientName: string
  clientFull: string
  category: "Maintenance" | "Material/PAC" | "Project/Instalasi" | "Jasa" | "Lainnya"
  invoices: Invoice[]
  totalValue: number
  totalPaid: number
  totalOutstanding: number
  progress: number
  status: "SELESAI" | "BERJALAN" | "TERTUNGGAK"
  firstDate: string
  lastDate: string
  invoiceCount: number
  paidCount: number
  unpaidCount: number
  termins: { label: string; invoice: Invoice; index: number }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

function classifyCategory(desc: string): Project["category"] {
  const d = desc.toLowerCase()
  if (d.includes("pemeliharaan") || d.includes("pemeliaharan") || d.includes("perbaikan") || d.includes("maintenance"))
    return "Maintenance"
  if (d.includes("material") || d.includes("supply") || d.includes("dp 30%") || d.includes("dp 50%"))
    return "Material/PAC"
  if (d.includes("instalasi") || d.includes("pemasangan") || d.includes("termin") || d.includes("project"))
    return "Project/Instalasi"
  if (d.includes("jasa"))
    return "Jasa"
  return "Lainnya"
}

function extractTerminLabel(desc: string, index: number): string {
  const d = desc.toLowerCase()
  const terminMatch = desc.match(/termin ke[- ]?(\d+)/i)
  if (terminMatch) return `T${terminMatch[1]}`
  if (d.includes("dp 30%")) return "DP30"
  if (d.includes("dp 50%")) return "DP50"
  if (d.includes("dp 40%")) return "DP40"
  if (d.includes("dp 60%")) return "DP60"
  if (d.includes("pelunasan") || d.includes("lunas")) return "Lunas"
  if (d.includes("progress") || d.includes("progres")) return "Progres"
  return `#${index + 1}`
}

function buildProjects(raw: Invoice[]): Project[] {
  const map = new Map<string, Invoice[]>()
  for (const inv of raw) {
    const clientBase = inv.customer.includes("(") ? inv.customer.split("(")[0].trim() : inv.customer.trim()
    const location   = inv.customer.includes("(") ? (inv.customer.split("(")[1]?.replace(")", "").trim() ?? "") : ""
    const cat        = classifyCategory(inv.description)
    let key: string
    if (cat === "Maintenance")                            key = `MAINT::${clientBase}::${location}`
    else if (cat === "Material/PAC" || cat === "Project/Instalasi") key = `PROJ::${clientBase}::${location}`
    else                                                  key = `SINGLE::${inv.invoice_no}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(inv)
  }

  const projects: Project[] = []
  for (const [key, invs] of map.entries()) {
    const sorted         = [...invs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const clientFull     = sorted[0].customer
    const clientName     = clientFull.includes("(") ? clientFull.split("(")[0].trim() : clientFull.trim()
    const cat            = classifyCategory(sorted[0].description)
    const totalValue     = sorted.reduce((s, i) => s + (i.total || 0), 0)
    const totalPaid      = sorted.reduce((s, i) => s + (i.payment_value || 0), 0)
    const totalOutstanding = sorted.filter(i => i.status === "UNPAID").reduce((s, i) => s + i.total, 0)
    const paidCount      = sorted.filter(i => i.status === "PAID").length
    const unpaidCount    = sorted.filter(i => i.status === "UNPAID").length
    // FIX: progress based on invoice count ratio (not payment value) so SELESAI always = 100%
    const progress       = sorted.length > 0 ? (paidCount / sorted.length) * 100 : 0
    const status: Project["status"] = unpaidCount === 0 ? "SELESAI" : totalPaid === 0 ? "TERTUNGGAK" : "BERJALAN"
    projects.push({
      id: key, poKey: key, clientName, clientFull, category: cat,
      invoices: sorted, totalValue, totalPaid, totalOutstanding, progress, status,
      firstDate: sorted[0].date, lastDate: sorted[sorted.length - 1].date,
      invoiceCount: sorted.length, paidCount, unpaidCount,
      termins: sorted.map((inv, idx) => ({ label: extractTerminLabel(inv.description, idx), invoice: inv, index: idx })),
    })
  }
  const order = { TERTUNGGAK: 0, BERJALAN: 1, SELESAI: 2 }
  return projects.sort((a, b) => order[a.status] - order[b.status] || b.totalValue - a.totalValue)
}

// ─── Style maps ───────────────────────────────────────────────────────────────
const CAT_STYLE: Record<Project["category"], string> = {
  "Maintenance":       "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800",
  "Material/PAC":      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800",
  "Project/Instalasi": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  "Jasa":              "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  "Lainnya":           "bg-muted text-muted-foreground border-border",
}
const CAT_ICON: Record<Project["category"], React.ReactNode> = {
  "Maintenance":       <Wrench className="h-3 w-3" />,
  "Material/PAC":      <Package className="h-3 w-3" />,
  "Project/Instalasi": <Briefcase className="h-3 w-3" />,
  "Jasa":              <TrendingUp className="h-3 w-3" />,
  "Lainnya":           <Hash className="h-3 w-3" />,
}
const STATUS_STYLE: Record<Project["status"], string> = {
  SELESAI:    "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
  BERJALAN:   "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  TERTUNGGAK: "bg-destructive/10 text-destructive border-destructive/30",
}
const STATUS_ICON: Record<Project["status"], React.ReactNode> = {
  SELESAI:    <CheckCircle2 className="h-3 w-3" />,
  BERJALAN:   <CircleDot className="h-3 w-3" />,
  TERTUNGGAK: <AlertTriangle className="h-3 w-3" />,
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* ── FIX: Progress bar animation ──────────────────────────────────────────
     Root cause of the bug: using 'width: 0 !important' in keyframe 'from'
     overrides the inline style={{ width: '...%' }} on some cards (browser
     specificity timing issue). Fix: use a CSS custom property --bar-w so the
     inline style sets the variable, and the animation reads from it.
     No !important needed. Works 100% consistently.
  ───────────────────────────────────────────────────────────────────────── */
  @keyframes growBar {
    from { width: 0; }
    to   { width: var(--bar-w); }
  }
  .bar-fill {
    width: var(--bar-w);
    animation: growBar 1s cubic-bezier(0.16,1,0.3,1) both;
    animation-delay: 0.4s;
  }

  .pj-up-1 { animation: fadeSlideUp 0.38s ease both 0.04s; }
  .pj-up-2 { animation: fadeSlideUp 0.38s ease both 0.10s; }
  .pj-up-3 { animation: fadeSlideUp 0.38s ease both 0.16s; }
  .pj-up-4 { animation: fadeSlideUp 0.38s ease both 0.22s; }

  .pj-sc-1 { animation: scaleIn 0.32s cubic-bezier(.22,.68,0,1.2) both 0.05s; }
  .pj-sc-2 { animation: scaleIn 0.32s cubic-bezier(.22,.68,0,1.2) both 0.11s; }
  .pj-sc-3 { animation: scaleIn 0.32s cubic-bezier(.22,.68,0,1.2) both 0.17s; }
  .pj-sc-4 { animation: scaleIn 0.32s cubic-bezier(.22,.68,0,1.2) both 0.23s; }

  .kpi-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .kpi-card:hover { transform: translateY(-2px) scale(1.01); box-shadow: 0 8px 24px -4px hsl(var(--primary)/.14); }

  .hv-card { transition: box-shadow 0.2s ease; }
  .hv-card:hover { box-shadow: 0 4px 18px -4px hsl(var(--primary)/.10); }

  /* ── Project card with visible separator ─────────────────────────────── */
  .proj-card {
    border: 1px solid hsl(var(--border));
    border-radius: 14px;
    background: hsl(var(--card));
    transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
    overflow: hidden;
    /* subtle shadow so cards look "lifted" and separated from each other */
    box-shadow: 0 1px 4px -1px hsl(var(--foreground)/.06), 0 0 0 0 transparent;
  }
  .proj-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px -6px hsl(var(--primary)/.14), 0 1px 4px -1px hsl(var(--foreground)/.06);
    border-color: hsl(var(--primary)/.3);
  }
  .proj-card.tertunggak { border-color: hsl(var(--destructive)/.25); }
  .proj-card.tertunggak:hover {
    border-color: hsl(var(--destructive)/.5);
    box-shadow: 0 8px 28px -6px hsl(var(--destructive)/.14);
  }
  .proj-card.selesai { border-color: hsl(142 70% 45% / 0.2); }

  .proj-header {
    cursor: pointer;
    padding: 18px 20px 16px;
    transition: background 0.12s;
  }
  .proj-header:hover { background: hsl(var(--muted)/.3); }

  /* ── Termin timeline (connector via ::before/::after) ────────────────── */
  .tl-wrap {
    display: flex;
    align-items: flex-start;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .tl-wrap::-webkit-scrollbar { height: 3px; }
  .tl-wrap::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 2px; }

  .tl-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 52px;
    position: relative;
  }
  /* Left half-line (from previous item) */
  .tl-item:not(:first-child)::before {
    content: '';
    position: absolute;
    top: 10px;
    left: 0;
    width: calc(50% - 11px);
    height: 2px;
    background: hsl(var(--border));
  }
  .tl-item.prev-paid:not(:first-child)::before {
    background: hsl(var(--primary));
  }
  /* Right half-line (to next item) */
  .tl-item:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 10px;
    right: 0;
    width: calc(50% - 11px);
    height: 2px;
    background: hsl(var(--border));
  }
  .tl-item.is-paid:not(:last-child)::after {
    background: hsl(var(--primary));
  }

  .tl-dot {
    width: 22px; height: 22px;
    border-radius: 50%;
    border: 2px solid;
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; font-weight: 700;
    position: relative; z-index: 1;
    transition: transform 0.14s, box-shadow 0.14s;
  }
  .tl-dot:hover { transform: scale(1.2); box-shadow: 0 2px 8px hsl(var(--foreground)/.15); }
  .tl-dot.is-paid   { background: hsl(var(--primary)); border-color: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
  .tl-dot.is-unpaid { background: hsl(var(--card)); border-color: hsl(var(--border)); color: hsl(var(--muted-foreground)); }
  .tl-dot.is-warn   { background: hsl(var(--destructive)/0.08); border-color: hsl(var(--destructive)); color: hsl(var(--destructive)); }

  .tl-label {
    font-size: 8px; color: hsl(var(--muted-foreground));
    margin-top: 5px; text-align: center; line-height: 1.2;
    max-width: 50px; word-break: break-word;
  }

  .inv-row-sm { transition: background 0.1s; border-radius: 6px; }
  .inv-row-sm:hover { background: hsl(var(--muted)/.4); }

  .search-box {
    background: hsl(var(--muted)/.5);
    border: 1px solid hsl(var(--border));
    border-radius: 8px;
    padding: 8px 12px 8px 36px;
    font-size: 13px;
    color: hsl(var(--foreground));
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .search-box::placeholder { color: hsl(var(--muted-foreground)); }
  .search-box:focus {
    border-color: hsl(var(--primary)/.5);
    box-shadow: 0 0 0 3px hsl(var(--primary)/.08);
    background: hsl(var(--card));
  }

  .chip {
    border: 1px solid hsl(var(--border));
    border-radius: 20px; padding: 4px 12px; font-size: 11.5px;
    cursor: pointer; transition: all 0.13s; background: transparent;
    color: hsl(var(--muted-foreground)); white-space: nowrap;
  }
  .chip:hover { border-color: hsl(var(--primary)/.5); color: hsl(var(--foreground)); }
  .chip.on { background: hsl(var(--primary)); border-color: hsl(var(--primary)); color: hsl(var(--primary-foreground)); font-weight: 600; }

  /* ── Grid: gap is the "gutter" separator between cards ──────────────── */
  .proj-grid { display: grid; gap: 20px; grid-template-columns: 1fr; }
  @media(min-width: 900px)  { .proj-grid { grid-template-columns: 1fr 1fr; } }
  @media(min-width: 1280px) { .proj-grid { grid-template-columns: 1fr 1fr 1fr; } }
`

// ─── ProjectCard ──────────────────────────────────────────────────────────────
function ProjectCard({ project }: { project: Project }) {
  const [expanded, setExpanded] = React.useState(false)

  const progressPct  = Math.round(project.progress)
  const progressColor =
    progressPct >= 100 ? "bg-green-500" :
    progressPct >= 50  ? "bg-primary"   :
    progressPct > 0    ? "bg-amber-500" : "bg-destructive/60"

  const MAX_TL = 8

  return (
    <div className={`proj-card ${project.status === "TERTUNGGAK" ? "tertunggak" : project.status === "SELESAI" ? "selesai" : ""}`}>

      {/* ── Clickable header ───────────────────────────────────── */}
      <div className="proj-header" onClick={() => setExpanded(p => !p)}>

        {/* Badges + chevron */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[project.status]}`}>
              {STATUS_ICON[project.status]} {project.status}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${CAT_STYLE[project.category]}`}>
              {CAT_ICON[project.category]} {project.category}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
            <span className="text-[10px]">{project.invoiceCount} inv</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </div>
        </div>

        {/* Client name + location */}
        <h3 className="text-sm font-bold leading-snug line-clamp-1 mb-0.5">{project.clientName}</h3>
        {project.clientFull.includes("(") && (
          <p className="text-[10px] text-muted-foreground mb-3">
            {project.clientFull.split("(")[1]?.replace(")", "").trim()}
          </p>
        )}

        {/* Value row */}
        <div className="flex items-end justify-between gap-2 mb-3">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Total Kontrak</p>
            <p className="text-base font-bold font-mono">{fIDR(project.totalValue)}</p>
          </div>
          <div className="text-right">
            {project.totalOutstanding > 0 ? (
              <>
                <p className="text-[10px] text-muted-foreground mb-0.5">Outstanding</p>
                <p className="text-sm font-bold font-mono text-destructive">{fIDR(project.totalOutstanding)}</p>
              </>
            ) : (
              <p className="text-xs font-semibold text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Lunas
              </p>
            )}
          </div>
        </div>

        {/* ── Progress bar ──────────────────────────────────────────────
            FIX: set CSS custom property --bar-w instead of inline width.
            Animation reads from --bar-w so no !important conflict.
        ─────────────────────────────────────────────────────────────── */}
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{project.paidCount}/{project.invoiceCount} invoice terbayar</span>
            <span className="font-semibold text-foreground">{progressPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`bar-fill h-full rounded-full ${progressColor}`}
              style={{ "--bar-w": `${progressPct}%` } as React.CSSProperties}
            />
          </div>
        </div>

        {/* ── Termin timeline ───────────────────────────────────────── */}
        {project.invoiceCount > 1 && (
          <div className="tl-wrap mb-3">
            {project.termins.slice(0, MAX_TL).map((t, idx) => {
              const isPaid  = t.invoice.status === "PAID"
              const isWarn  = !isPaid && project.status === "TERTUNGGAK"
              const prevPaid = idx > 0 && project.termins[idx - 1].invoice.status === "PAID"
              return (
                <div
                  key={t.invoice.invoice_no}
                  className={`tl-item ${isPaid ? "is-paid" : ""} ${prevPaid ? "prev-paid" : ""}`}
                  title={`${t.label} · ${fIDR(t.invoice.total)} · ${t.invoice.status}`}
                >
                  <div className={`tl-dot ${isPaid ? "is-paid" : isWarn ? "is-warn" : "is-unpaid"}`}>
                    {isPaid ? "✓" : idx + 1}
                  </div>
                  <p className="tl-label">{t.label}</p>
                </div>
              )
            })}
            {project.invoiceCount > MAX_TL && (
              <div className="tl-item" title={`+${project.invoiceCount - MAX_TL} invoice lainnya`}>
                <div className="tl-dot is-unpaid">+{project.invoiceCount - MAX_TL}</div>
                <p className="tl-label">lainnya</p>
              </div>
            )}
          </div>
        )}

        {/* Date */}
        <div className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground">
            {project.firstDate === project.lastDate
              ? project.firstDate
              : `${project.firstDate} — ${project.lastDate}`}
          </span>
        </div>
      </div>

      {/* ── Expanded detail ────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t px-5 py-4 space-y-1 bg-muted/20">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-3">
            Detail Invoice ({project.invoiceCount})
          </p>
          {project.invoices.map((inv, idx) => (
            <div key={inv.invoice_no} className="inv-row-sm px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    inv.status === "PAID" ? "bg-primary text-primary-foreground" : "bg-muted border text-muted-foreground"
                  }`}>
                    {inv.status === "PAID" ? "✓" : idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-muted-foreground">{inv.invoice_no}</p>
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mt-0.5">{inv.description}</p>
                    <p className="text-[9px] text-muted-foreground/50 mt-0.5">{inv.date}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold font-mono">{fIDR(inv.total)}</p>
                  <span className={`text-[10px] font-semibold ${inv.status === "PAID" ? "text-green-600" : "text-destructive"}`}>
                    {inv.status}
                  </span>
                  {inv.payment_value > 0 && (
                    <p className="text-[9px] text-muted-foreground">Bayar: {fIDR(inv.payment_value)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const raw         = invoicesRaw as Invoice[]
  const allProjects = React.useMemo(() => buildProjects(raw), [raw])

  const stats = React.useMemo(() => {
    const total      = allProjects.length
    const selesai    = allProjects.filter(p => p.status === "SELESAI").length
    const berjalan   = allProjects.filter(p => p.status === "BERJALAN").length
    const tertunggak = allProjects.filter(p => p.status === "TERTUNGGAK").length
    const totalValue = allProjects.reduce((s, p) => s + p.totalValue, 0)
    const totalOut   = allProjects.reduce((s, p) => s + p.totalOutstanding, 0)
    return { total, selesai, berjalan, tertunggak, totalValue, totalOut }
  }, [allProjects])

  const [search,       setSearch]       = React.useState("")
  const [filterStatus, setFilterStatus] = React.useState("Semua")
  const [filterCat,    setFilterCat]    = React.useState("Semua")

  const STATUSES = ["Semua", "TERTUNGGAK", "BERJALAN", "SELESAI"]
  const CATS     = ["Semua", "Maintenance", "Material/PAC", "Project/Instalasi", "Jasa"]

  const displayed = React.useMemo(() => {
    let list = [...allProjects]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.clientName.toLowerCase().includes(q))
    }
    if (filterStatus !== "Semua") list = list.filter(p => p.status   === filterStatus)
    if (filterCat    !== "Semua") list = list.filter(p => p.category === filterCat)
    return list
  }, [allProjects, search, filterStatus, filterCat])

  const hasFilter = !!search || filterStatus !== "Semua" || filterCat !== "Semua"

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />

        <div className="flex flex-1 flex-col gap-6 p-6">

          {/* Header */}
          <div className="pj-up-1 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-xl font-semibold">Projects</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Kontrak & proyek berdasarkan PO · {allProjects.length} proyek · 2025
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {stats.tertunggak > 0 && (
                <button
                  onClick={() => setFilterStatus(p => p === "TERTUNGGAK" ? "Semua" : "TERTUNGGAK")}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all
                    ${filterStatus === "TERTUNGGAK" ? "bg-destructive text-white border-destructive" : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"}`}
                >
                  <AlertTriangle className="h-3 w-3" /> {stats.tertunggak} tertunggak
                </button>
              )}
              <button
                onClick={() => setFilterStatus(p => p === "BERJALAN" ? "Semua" : "BERJALAN")}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all
                  ${filterStatus === "BERJALAN" ? "bg-blue-600 text-white border-blue-600" : "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20"}`}
              >
                <CircleDot className="h-3 w-3" /> {stats.berjalan} berjalan
              </button>
              <button
                onClick={() => setFilterStatus(p => p === "SELESAI" ? "Semua" : "SELESAI")}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all
                  ${filterStatus === "SELESAI" ? "bg-green-600 text-white border-green-600" : "bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20"}`}
              >
                <CheckCircle2 className="h-3 w-3" /> {stats.selesai} selesai
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {([
              { sc:"pj-sc-1", title:"Total Proyek",  val:String(stats.total),    sub:`${raw.length} invoice terkait`,         icon:<FolderKanban className="h-4 w-4 text-muted-foreground"/>,  valCls:"" },
              { sc:"pj-sc-2", title:"Nilai Kontrak", val:fIDR(stats.totalValue), sub:"gross semua proyek 2025",                icon:<Receipt className="h-4 w-4 text-muted-foreground"/>,        valCls:"" },
              { sc:"pj-sc-3", title:"Selesai",       val:String(stats.selesai),  sub:`${stats.total>0?((stats.selesai/stats.total)*100).toFixed(0):0}% dari total`, icon:<CheckCircle2 className="h-4 w-4 text-green-600"/>, valCls:"text-green-600" },
              { sc:"pj-sc-4", title:"Outstanding",   val:fIDR(stats.totalOut),   sub:`${stats.tertunggak+stats.berjalan} proyek belum lunas`, icon:<AlertTriangle className="h-4 w-4 text-destructive"/>, valCls:stats.totalOut>0?"text-destructive":"text-green-600" },
            ] as const).map(c => (
              <div key={c.title} className={c.sc}>
                <Card className="kpi-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm">{c.title}</CardTitle>
                    {c.icon}
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${c.valCls}`}>{c.val}</div>
                    <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* Status bar */}
          <div className="pj-up-2">
            <Card className="hv-card">
              <CardContent className="py-5 px-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 space-y-2 min-w-[200px]">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Distribusi status proyek</span>
                      <span className="font-semibold text-foreground">{stats.total} total</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden flex">
                      {[
                        { count: stats.tertunggak, cls: "bg-destructive" },
                        { count: stats.berjalan,   cls: "bg-primary" },
                        { count: stats.selesai,    cls: "bg-green-500" },
                      ].map((s, i) => s.count > 0 ? (
                        <div key={i}
                          className={`h-full ${s.cls} ${i===0?"rounded-l-full":""} ${i===2?"rounded-r-full":""}`}
                          style={{ width: `${(s.count/stats.total)*100}%` }}
                        />
                      ) : null)}
                    </div>
                  </div>
                  <div className="flex gap-5 shrink-0 flex-wrap">
                    {[
                      { label:"Tertunggak", count:stats.tertunggak, cls:"bg-destructive", s:"TERTUNGGAK" },
                      { label:"Berjalan",   count:stats.berjalan,   cls:"bg-primary",     s:"BERJALAN" },
                      { label:"Selesai",    count:stats.selesai,    cls:"bg-green-500",   s:"SELESAI" },
                    ].map(s => (
                      <button key={s.label}
                        onClick={() => setFilterStatus(p => p === s.s ? "Semua" : s.s)}
                        className={`flex items-center gap-1.5 text-xs transition-colors ${filterStatus===s.s ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${s.cls}`} />
                        {s.label} <span className="font-semibold text-foreground ml-0.5">{s.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter bar */}
          <div className="pj-up-3">
            <Card className="hv-card">
              <CardContent className="py-5 px-6 space-y-4">
                <div className="flex gap-3 flex-wrap items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input type="text" placeholder="Cari nama klien..."
                      value={search} onChange={e => setSearch(e.target.value)}
                      className="search-box w-full" />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1"><Filter className="h-3 w-3" /> Status:</span>
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)} className={`chip ${filterStatus===s?"on":""}`}>
                      {s === "Semua" ? `Semua (${stats.total})` : s}
                    </button>
                  ))}
                  <span className="w-px h-4 bg-border mx-1" />
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1"><FolderKanban className="h-3 w-3" /> Tipe:</span>
                  {CATS.map(c => (
                    <button key={c} onClick={() => setFilterCat(c)} className={`chip ${filterCat===c?"on":""}`}>{c}</button>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{displayed.length}</span> proyek ditampilkan
                  </p>
                  {hasFilter && (
                    <button onClick={() => { setSearch(""); setFilterStatus("Semua"); setFilterCat("Semua") }}
                      className="text-xs text-primary hover:underline">Reset filter</button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Project Grid */}
          <div className="pj-up-4">
            {displayed.length === 0 ? (
              <Card className="hv-card">
                <CardContent className="py-20 text-center text-muted-foreground">
                  <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">Tidak ada proyek ditemukan</p>
                  <p className="text-xs mt-1 opacity-60">Coba ubah filter atau kata kunci pencarian</p>
                  {hasFilter && (
                    <button onClick={() => { setSearch(""); setFilterStatus("Semua"); setFilterCat("Semua") }}
                      className="mt-3 text-xs text-primary hover:underline">Reset semua filter</button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="proj-grid">
                {displayed.map((project, i) => (
                  <div key={project.id} style={{ animationDelay: `${Math.min(i * 0.03, 0.4)}s` }} className="pj-up-4">
                    <ProjectCard project={project} />
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}