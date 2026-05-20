"use client"

import * as React from "react"
import {
  FolderKanban, Search, CircleDot, CheckCircle2, AlertTriangle,
  CalendarDays, Receipt, Package, Wrench, Briefcase, X, Filter,
  Hash, Plus, Trash2, TrendingUp, MapPin, ChevronRight,
  ClipboardList, BarChart3, DollarSign, Save, CheckCheck,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useFilteredInvoices } from "@/lib/use-filtered-invoices"
import { useCurrentUser } from "@/components/providers/current-user-provider"
import type { InvoiceRecord as Invoice } from "@/types/invoice"

// ─── Types ────────────────────────────────────────────────────────────────────
type Project = {
  id: string
  clientName: string
  clientFull: string
  location: string
  category: "Maintenance" | "Material/PAC" | "Project/Instalasi" | "Jasa" | "Lainnya"
  invoices: Invoice[]
  totalValue: number
  totalPaid: number
  totalOutstanding: number
  billingProgress: number
  status: "SELESAI" | "BERJALAN" | "TERTUNGGAK"
  firstDate: string
  lastDate: string
  invoiceCount: number
  paidCount: number
  unpaidCount: number
  termins: { label: string; invoice: Invoice; index: number }[]
  poValue: number
}

type ProjectDetail = {
  project_key: string
  display_name?: string
  physical_progress?: number
  notes?: string
  site_location?: string
  description?: string
  po_value_manual?: number
  op_gaji?: number
  op_material?: number
  op_transport?: number
  op_operasional?: number
  op_sewa?: number
  op_lainnya?: number
}

type ProjectCost = {
  id: string
  project_key: string
  category: string
  description: string
  amount: number
  cost_date: string | null
  input_by: string
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

const fShort = (n: number) => {
  if (n >= 1_000_000_000) return `Rp ${(n / 1e9).toFixed(1)}M`
  if (n >= 1_000_000)     return `Rp ${(n / 1e6).toFixed(1)}Jt`
  if (n >= 1_000)         return `Rp ${(n / 1e3).toFixed(0)}Rb`
  return `Rp ${Math.round(n)}`
}

function parseNum(s: string) { return Number(String(s).replace(/[^\d]/g, "")) || 0 }
function fNum(n: number)     { return n > 0 ? n.toLocaleString("id-ID") : "" }

function classifyCategory(desc: string): Project["category"] {
  const d = desc.toLowerCase()
  if (d.includes("pemeliharaan") || d.includes("pemeliaharan") || d.includes("perbaikan") ||
    d.includes("maintenance") || d.includes("inspection") || d.includes("service") ||
    d.includes("recovery work") || d.includes("refrigerant") || d.includes("teknisi"))
    return "Maintenance"
  if (d.includes("material") || d.includes("supply") || d.includes("dp 20%") ||
    d.includes("dp 30%") || d.includes("dp 50%") || d.includes("sensor") ||
    d.includes("panel") || d.includes("battery") || d.includes("baterai") ||
    d.includes("compressor") || d.includes("module") || d.includes("kit") ||
    d.includes("frame") || d.includes("ups") || d.includes("bcb") ||
    d.includes("dau") || d.includes("sau"))
    return "Material/PAC"
  if (d.includes("instalasi") || d.includes("installation") || d.includes("install ") ||
    d.includes("pemasangan") || d.includes("termin") || d.includes("project") ||
    d.includes("delivery") || d.includes("unloading") || d.includes("assembly") ||
    d.includes("positioning") || d.includes("cabling") || d.includes("transportation") ||
    d.includes("transportasi") || d.includes("akomodasi") || d.includes("pelunasan"))
    return "Project/Instalasi"
  return "Jasa"
}

function extractTerminLabel(desc: string, index: number): string {
  const terminMatch = desc.match(/termin ke[- ]?(\d+)/i)
  if (terminMatch) return `T${terminMatch[1]}`
  const d = desc.toLowerCase()
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
    const loc = inv.customer.includes("(") ? (inv.customer.split("(")[1]?.replace(")", "").trim() ?? "") : ""
    const cat = classifyCategory(inv.description)
    const key = cat === "Maintenance" ? `MAINT::${clientBase}::${loc}`
      : (cat === "Material/PAC" || cat === "Project/Instalasi") ? `PROJ::${clientBase}::${loc}`
      : `SINGLE::${inv.invoice_no}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(inv)
  }
  const projects: Project[] = []
  for (const [key, invs] of map.entries()) {
    const sorted = [...invs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const clientFull = sorted[0].customer
    const clientName = clientFull.includes("(") ? clientFull.split("(")[0].trim() : clientFull.trim()
    const location   = clientFull.includes("(") ? (clientFull.split("(")[1]?.replace(")", "").trim() ?? "") : ""
    const cat = classifyCategory(sorted[0].description)
    const totalValue = sorted.reduce((s, i) => s + (i.total || 0), 0)
    const totalPaid  = sorted.reduce((s, i) => s + (i.payment_value || 0), 0)
    const totalOut   = sorted.filter(i => i.status === "UNPAID").reduce((s, i) => s + i.total, 0)
    const paidCount  = sorted.filter(i => i.status === "PAID").length
    const unpaidCount = sorted.filter(i => i.status === "UNPAID").length
    const billingProgress = sorted.length > 0 ? (paidCount / sorted.length) * 100 : 0
    const status: Project["status"] = unpaidCount === 0 ? "SELESAI" : totalPaid === 0 ? "TERTUNGGAK" : "BERJALAN"
    const poValue = Math.max(...sorted.map(i => i.po_value || 0), 0) || totalValue
    projects.push({
      id: key, clientName, clientFull, location, category: cat,
      invoices: sorted, totalValue, totalPaid, totalOutstanding: totalOut,
      billingProgress, status, poValue,
      firstDate: sorted[0].date, lastDate: sorted[sorted.length - 1].date,
      invoiceCount: sorted.length, paidCount, unpaidCount,
      termins: sorted.map((inv, idx) => ({ label: extractTerminLabel(inv.description, idx), invoice: inv, index: idx })),
    })
  }
  const order = { TERTUNGGAK: 0, BERJALAN: 1, SELESAI: 2 }
  return projects.sort((a, b) => order[a.status] - order[b.status] || b.totalValue - a.totalValue)
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CAT_LABEL: Record<Project["category"], string> = {
  Maintenance: "Maintenance", "Material/PAC": "Material/PAC",
  "Project/Instalasi": "Project", Jasa: "Jasa", Lainnya: "Lainnya",
}
const CAT_ICON: Record<Project["category"], React.ReactNode> = {
  Maintenance: <Wrench className="h-3 w-3" />,
  "Material/PAC": <Package className="h-3 w-3" />,
  "Project/Instalasi": <Briefcase className="h-3 w-3" />,
  Jasa: <TrendingUp className="h-3 w-3" />,
  Lainnya: <Hash className="h-3 w-3" />,
}

const OP_FIELDS = [
  { key: "op_gaji",        label: "Gaji & Tunjangan",     icon: "👤", ex: 150_000_000 },
  { key: "op_operasional", label: "Biaya Operasional",    icon: "⚙️", ex: 50_000_000  },
  { key: "op_material",    label: "Biaya Material/Bahan", icon: "🧱", ex: 80_000_000  },
  { key: "op_sewa",        label: "Sewa & Utilitas",      icon: "🏢", ex: 20_000_000  },
  { key: "op_transport",   label: "Transport & Logistik", icon: "🚛", ex: 15_000_000  },
  { key: "op_lainnya",     label: "Biaya Lainnya",        icon: "📦", ex: 10_000_000  },
] as const

const PROGRESS_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

// ─── ROI Gauge ────────────────────────────────────────────────────────────────
function ROIGauge({ costPct }: { costPct: number }) {
  const clamped = Math.min(200, Math.max(0, costPct))
  const angleDeg = (clamped / 200) * 180 - 180
  const rad = (angleDeg * Math.PI) / 180
  const cx = 110, cy = 95, r = 78

  function arcPath(startPct: number, endPct: number) {
    const a1 = ((startPct / 200) * 180 - 180) * (Math.PI / 180)
    const a2 = ((endPct   / 200) * 180 - 180) * (Math.PI / 180)
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
    const large = endPct - startPct > 100 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  const nx = cx + r * Math.cos(rad), ny = cy + r * Math.sin(rad)

  return (
    <svg viewBox="0 0 220 110" className="w-full max-w-[220px] mx-auto" aria-label="ROI Gauge">
      <path d={arcPath(0, 200)} fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
      <path d={arcPath(0, 70)}   fill="none" stroke="#22c55e" strokeWidth="10" />
      <path d={arcPath(70, 100)} fill="none" stroke="#f59e0b" strokeWidth="10" />
      <path d={arcPath(100, 200)} fill="none" stroke="#ef4444" strokeWidth="10" />
      {costPct > 0 && (
        <>
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="5" fill="#64748b" />
          <circle cx={nx} cy={ny} r="3.5" fill="#64748b" />
        </>
      )}
      <text x="22"  y="107" fontSize="9" fill="#94a3b8" textAnchor="middle">0%</text>
      <text x="110" y="12"  fontSize="9" fill="#94a3b8" textAnchor="middle">100%</text>
      <text x="200" y="107" fontSize="9" fill="#94a3b8" textAnchor="middle">200%</text>
      {costPct > 0 ? (
        <>
          <text x={cx} y={cy + 18} fontSize="12" fontWeight="bold" fill="#1e293b" textAnchor="middle" className="dark-gauge-text">{costPct.toFixed(0)}%</text>
          <text x={cx} y={cy + 29} fontSize="7.5" fill="#94a3b8" textAnchor="middle">rasio biaya</text>
        </>
      ) : (
        <text x={cx} y={cy + 18} fontSize="9" fill="#94a3b8" textAnchor="middle">Input cost →</text>
      )}
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// NOTE: Use var(--X) directly — Tailwind v4 CSS vars are full oklch() values,
// NOT HSL components. hsl(var(--X)) is invalid here.
const STYLES = `
  @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes scaleIn { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
  @keyframes fadeBg  { from{opacity:0} to{opacity:1} }
  @keyframes modalIn { from{opacity:0;transform:scale(.96) translateY(14px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes growW   { from{width:0} to{width:var(--w)} }

  .u1{animation:fadeUp .3s ease both .04s}  .u2{animation:fadeUp .3s ease both .09s}
  .u3{animation:fadeUp .3s ease both .14s}  .u4{animation:fadeUp .3s ease both .19s}
  .s1{animation:scaleIn .28s cubic-bezier(.22,.68,0,1.2) both .05s}
  .s2{animation:scaleIn .28s cubic-bezier(.22,.68,0,1.2) both .10s}
  .s3{animation:scaleIn .28s cubic-bezier(.22,.68,0,1.2) both .15s}
  .s4{animation:scaleIn .28s cubic-bezier(.22,.68,0,1.2) both .20s}

  /* ════ PROJECT CARD ══════════════════════════════════════════════════════════ */
  .pcard {
    background: var(--card);
    border-radius: 14px;
    border: 1px solid var(--border);
    box-shadow: 0 1px 8px -3px rgba(0,0,0,.12), 0 2px 16px -6px rgba(0,0,0,.1);
    overflow: hidden;
    transition: transform .18s ease, box-shadow .18s ease;
    cursor: pointer;
    position: relative;
  }
  .dark .pcard {
    box-shadow: 0 1px 8px -3px rgba(0,0,0,.5), 0 2px 16px -6px rgba(0,0,0,.45);
  }
  /* Colored left accent per status */
  .pcard::before {
    content: '';
    position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
    border-radius: 14px 0 0 14px;
  }
  .pcard.st-berjalan::before   { background: var(--primary); }
  .pcard.st-selesai::before    { background: #22c55e; }
  .pcard.st-tertunggak::before { background: var(--destructive); }

  .pcard:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px -6px rgba(0,0,0,.18), 0 2px 8px -3px rgba(0,0,0,.1);
  }
  .dark .pcard:hover {
    box-shadow: 0 6px 24px -6px rgba(0,0,0,.65), 0 2px 8px -3px rgba(0,0,0,.4);
  }

  /* Card sections */
  .pcard-top     { padding: 14px 18px 10px 22px; }
  .pcard-section { padding: 10px 18px 10px 22px; border-top: 1px solid var(--border); }
  .pcard-footer  {
    padding: 8px 18px 12px 22px; border-top: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }

  /* Section label: small uppercase colored label per divisi */
  .sec-lbl {
    font-size: 9.5px; font-weight: 800; letter-spacing: 0.07em;
    text-transform: uppercase; margin-bottom: 7px;
    display: flex; align-items: center; gap: 5px;
  }
  .sec-lbl-proj { color: #3b82f6; }
  .sec-lbl-fin  { color: #22c55e; }
  .sec-lbl-cost { color: #f59e0b; }
  .dark .sec-lbl-proj { color: #60a5fa; }
  .dark .sec-lbl-fin  { color: #4ade80; }
  .dark .sec-lbl-cost { color: #fbbf24; }

  /* Metric mini boxes inside card sections */
  .mbox-sm {
    border-radius: 8px; border: 1px solid var(--border);
    padding: 7px 10px;
    background: color-mix(in oklch, var(--muted) 40%, transparent);
  }

  /* ════ MODAL ════════════════════════════════════════════════════════════════ */
  .modal-bg {
    position: fixed; inset: 0; z-index: 50;
    background: rgba(0,0,0,.75);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    animation: fadeBg .2s ease both;
  }
  .modal {
    background: var(--card);
    border: 1.5px solid var(--border);
    border-radius: 20px;
    box-shadow: 0 32px 80px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.25);
    width: min(960px, 100%);
    max-height: calc(100vh - 32px);
    display: flex; flex-direction: column;
    animation: modalIn .25s cubic-bezier(.16,1,.3,1) both;
    overflow: hidden;
  }
  .dark .modal {
    box-shadow: 0 32px 80px rgba(0,0,0,.7), 0 8px 24px rgba(0,0,0,.5);
  }
  /* Modal header stripe - slightly different shade */
  .modal-hdr {
    background: color-mix(in oklch, var(--muted) 60%, var(--card));
    border-bottom: 1px solid var(--border);
  }
  /* Modal tab bar */
  .modal-tabs {
    background: var(--card);
    border-bottom: 1px solid var(--border);
    display: flex;
  }
  /* Modal tab button */
  .mtab {
    flex: 1; padding: 11px 8px 11px; font-size: 12.5px; font-weight: 600;
    border-bottom: 2.5px solid transparent; transition: all .14s;
    color: var(--muted-foreground); cursor: pointer;
    background: transparent; text-align: center;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .mtab:hover { color: var(--foreground); }
  .mtab.on    { color: var(--primary); border-bottom-color: var(--primary);
                background: color-mix(in oklch, var(--primary) 5%, transparent); }

  /* Input fields inside modal */
  .minput {
    width: 100%; background: color-mix(in oklch, var(--muted) 30%, transparent);
    border: 1.5px solid var(--border); border-radius: 9px;
    padding: 9px 12px; font-size: 13px; color: var(--foreground);
    outline: none; transition: all .14s;
  }
  .minput::placeholder { color: var(--muted-foreground); opacity: .7; }
  .minput:focus {
    border-color: color-mix(in oklch, var(--primary) 50%, transparent);
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 8%, transparent);
    background: var(--card);
  }
  textarea.minput { resize: vertical; min-height: 72px; }

  /* Progress buttons */
  .pbtn {
    width: 46px; height: 32px; border-radius: 8px;
    font-size: 11px; font-weight: 700; border: 1.5px solid var(--border);
    cursor: pointer; transition: all .12s;
    background: color-mix(in oklch, var(--muted) 50%, transparent);
    color: var(--muted-foreground);
  }
  .pbtn:hover { border-color: var(--primary); color: var(--primary); }
  .pbtn.on {
    background: var(--primary); border-color: var(--primary);
    color: var(--primary-foreground);
    box-shadow: 0 3px 10px -3px color-mix(in oklch, var(--primary) 50%, transparent);
  }

  /* Progress bars */
  .pbar-bg   { height: 6px; border-radius: 99px; background: var(--muted); overflow: hidden; }
  .pbar-fill { height: 100%; border-radius: 99px; width: var(--w);
               animation: growW .85s cubic-bezier(.16,1,.3,1) both .25s; }
  .pbar-blue  { background: var(--primary); }
  .pbar-green { background: #22c55e; }
  .pbar-red   { background: var(--destructive); }

  /* Termin timeline dots */
  .tl{display:flex;align-items:flex-start;overflow-x:auto;padding-bottom:2px;gap:0}
  .tl::-webkit-scrollbar{height:2px}
  .tl::-webkit-scrollbar-thumb{background:var(--border);border-radius:1px}
  .tl-item{display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:44px;position:relative}
  .tl-item:not(:first-child)::before{content:'';position:absolute;top:9px;left:0;width:calc(50% - 9px);height:2px;background:var(--border)}
  .tl-item.prev-ok:not(:first-child)::before{background:var(--primary)}
  .tl-item:not(:last-child)::after{content:'';position:absolute;top:9px;right:0;width:calc(50% - 9px);height:2px;background:var(--border)}
  .tl-item.is-ok:not(:last-child)::after{background:var(--primary)}
  .tl-dot{width:20px;height:20px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:800;position:relative;z-index:1}
  .tl-dot.ok  {background:var(--primary);border-color:var(--primary);color:var(--primary-foreground)}
  .tl-dot.no  {background:var(--card);border-color:var(--muted-foreground);color:var(--muted-foreground)}
  .tl-dot.warn{background:color-mix(in oklch,var(--destructive) 8%,transparent);border-color:var(--destructive);color:var(--destructive)}
  .tl-lbl{font-size:8px;color:var(--muted-foreground);margin-top:4px;text-align:center;line-height:1.1;max-width:42px;word-break:break-word}

  /* Search input */
  .sbox {
    background: color-mix(in oklch, var(--muted) 40%, transparent);
    border: 1.5px solid var(--border); border-radius: 10px;
    padding: 9px 12px 9px 38px; font-size: 13px; color: var(--foreground);
    outline: none; transition: all .15s; width: 100%;
  }
  .sbox::placeholder { color: var(--muted-foreground); opacity: .7; }
  .sbox:focus {
    border-color: color-mix(in oklch, var(--primary) 50%, transparent);
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 8%, transparent);
    background: var(--card);
  }

  /* Filter chips */
  .chip {
    border: 1.5px solid var(--border); border-radius: 20px; padding: 4px 12px;
    font-size: 11.5px; cursor: pointer; transition: all .12s;
    background: transparent; color: var(--muted-foreground); white-space: nowrap;
  }
  .chip:hover { border-color: var(--primary); color: var(--foreground); }
  .chip.on {
    background: var(--primary); border-color: var(--primary);
    color: var(--primary-foreground); font-weight: 700;
  }

  /* Project grid */
  .pgrid { display: grid; gap: 16px; grid-template-columns: 1fr; }
  @media(min-width:760px) { .pgrid { grid-template-columns: 1fr 1fr; } }
  @media(min-width:1200px){ .pgrid { grid-template-columns: 1fr 1fr 1fr; } }

  /* Invoice / cost rows inside modal */
  .inv-row {
    padding: 10px 14px; border-radius: 10px;
    border: 1.5px solid var(--border);
    background: color-mix(in oklch, var(--muted) 15%, transparent);
    margin-bottom: 6px; transition: all .13s;
  }
  .inv-row:hover { border-color: var(--primary); }
  .inv-row:last-child { margin-bottom: 0; }

  /* KPI card hover */
  .kcard { transition: box-shadow .18s, transform .18s; }
  .kcard:hover { transform: translateY(-1px); }

  /* Division badges */
  .div-badge-proj {
    background: color-mix(in oklch, #3b82f6 10%, transparent);
    border: 1px solid color-mix(in oklch, #3b82f6 25%, transparent);
    color: #2563eb;
  }
  .dark .div-badge-proj { color: #60a5fa; }
  .div-badge-fin {
    background: color-mix(in oklch, #22c55e 10%, transparent);
    border: 1px solid color-mix(in oklch, #22c55e 25%, transparent);
    color: #16a34a;
  }
  .dark .div-badge-fin { color: #4ade80; }

  /* Save button */
  .savebtn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 20px; border-radius: 10px; font-size: 13px; font-weight: 700;
    cursor: pointer; transition: all .14s; border: none;
  }
  .savebtn-primary {
    background: var(--primary); color: var(--primary-foreground);
  }
  .savebtn-primary:hover   { opacity: .88; }
  .savebtn-primary:disabled{ opacity: .45; cursor: not-allowed; }

  /* Mbox inside modal */
  .mbox {
    border-radius: 10px; border: 1px solid var(--border);
    padding: 10px 14px;
    background: color-mix(in oklch, var(--muted) 30%, transparent);
  }

  /* dark gauge text */
  .dark .dark-gauge-text { fill: #e2e8f0; }
`

// ─── Cost helpers ─────────────────────────────────────────────────────────────
function calcCC(det: ProjectDetail | null | undefined, fallbackPO: number) {
  if (!det) return { totalOp: 0, hasCC: false, netMargin: 0, efisiensi: 0, contractVal: fallbackPO }
  const contractVal = (det.po_value_manual ?? 0) > 0 ? (det.po_value_manual ?? 0) : fallbackPO
  const totalOp = (det.op_gaji ?? 0) + (det.op_material ?? 0) + (det.op_transport ?? 0) +
                  (det.op_operasional ?? 0) + (det.op_sewa ?? 0) + (det.op_lainnya ?? 0)
  const hasCC     = totalOp > 0
  const netProfit = contractVal - totalOp
  const netMargin = contractVal > 0 ? (netProfit / contractVal) * 100 : 0
  const efisiensi = totalOp > 0 ? (contractVal / totalOp) * 100 : 0
  const costPct   = contractVal > 0 ? (totalOp / contractVal) * 100 : 0
  return { totalOp, hasCC, netMargin, efisiensi, contractVal, netProfit, costPct }
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ project, initDetail, onClose, onDetailSaved }: {
  project: Project
  initDetail: ProjectDetail | null
  onClose: () => void
  onDetailSaved: (d: ProjectDetail) => void
}) {
  const { user } = useCurrentUser()
  const [tab, setTab] = React.useState<"project" | "costcontrol" | "invoice">("project")
  const [detail, setDetail] = React.useState<ProjectDetail | null>(initDetail)
  const [costs, setCosts]   = React.useState<ProjectCost[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving]  = React.useState(false)
  const [savedOk, setSavedOk] = React.useState(false)

  const [editName,     setEditName]     = React.useState("")
  const [editSite,     setEditSite]     = React.useState("")
  const [editDesc,     setEditDesc]     = React.useState("")
  const [editProg,     setEditProg]     = React.useState(0)
  const [editNotes,    setEditNotes]    = React.useState("")
  const [editPOManual, setEditPOManual] = React.useState("")
  const [opVals, setOpVals] = React.useState<Record<string, string>>({
    op_gaji: "", op_material: "", op_transport: "", op_operasional: "", op_sewa: "", op_lainnya: ""
  })

  const [ccat,   setCcat]   = React.useState("material")
  const [cdesc,  setCdesc]  = React.useState("")
  const [camt,   setCamt]   = React.useState("")
  const [cdate,  setCdate]  = React.useState("")
  const [adding, setAdding] = React.useState(false)

  function applyDetail(det: ProjectDetail) {
    setDetail(det)
    setEditName(det.display_name || project.clientName)
    setEditSite(det.site_location || project.location)
    setEditDesc(det.description || "")
    setEditProg(det.physical_progress || 0)
    setEditNotes(det.notes || "")
    setEditPOManual(fNum(det.po_value_manual || 0))
    setOpVals({
      op_gaji:        fNum(det.op_gaji || 0),
      op_material:    fNum(det.op_material || 0),
      op_transport:   fNum(det.op_transport || 0),
      op_operasional: fNum(det.op_operasional || 0),
      op_sewa:        fNum(det.op_sewa || 0),
      op_lainnya:     fNum(det.op_lainnya || 0),
    })
  }

  React.useEffect(() => {
    setLoading(true)
    if (initDetail) applyDetail(initDetail)
    Promise.all([
      fetch(`/api/project-details/${encodeURIComponent(project.id)}`).then(r => r.json()),
      fetch(`/api/project-costs?key=${encodeURIComponent(project.id)}`).then(r => r.json()),
    ]).then(([d, c]) => {
      const det: ProjectDetail = d.data ?? { project_key: project.id }
      applyDetail(det)
      setCosts(c.data ?? [])
    }).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  React.useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  async function save() {
    setSaving(true); setSavedOk(false)
    try {
      const body = {
        display_name: editName, physical_progress: editProg,
        notes: editNotes, site_location: editSite, description: editDesc,
        po_value_manual: parseNum(editPOManual),
        op_gaji:        parseNum(opVals.op_gaji),
        op_material:    parseNum(opVals.op_material),
        op_transport:   parseNum(opVals.op_transport),
        op_operasional: parseNum(opVals.op_operasional),
        op_sewa:        parseNum(opVals.op_sewa),
        op_lainnya:     parseNum(opVals.op_lainnya),
      }
      const r = await fetch(`/api/project-details/${encodeURIComponent(project.id)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      const d = await r.json()
      if (d.data) { setDetail(d.data); onDetailSaved(d.data) }
      setSavedOk(true); setTimeout(() => setSavedOk(false), 2500)
    } finally { setSaving(false) }
  }

  async function addCost() {
    if (!cdesc.trim() || !camt) return
    const amt = parseNum(camt)
    if (!amt) return
    setAdding(true)
    try {
      const r = await fetch("/api/project-costs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_key: project.id, category: ccat, description: cdesc.trim(), amount: amt, cost_date: cdate || null, input_by: user?.email || "" }),
      })
      const d = await r.json()
      if (d.data) { setCosts(p => [...p, d.data]); setCdesc(""); setCamt(""); setCdate("") }
    } finally { setAdding(false) }
  }

  async function delCost(id: string) {
    await fetch(`/api/project-costs/${id}`, { method: "DELETE" })
    setCosts(p => p.filter(c => c.id !== id))
  }

  const cc = calcCC(detail, project.poValue || project.totalValue)
  const bilPct = Math.round(project.billingProgress)
  const barCls = project.status === "SELESAI" ? "pbar-green" : project.status === "TERTUNGGAK" ? "pbar-red" : "pbar-blue"

  // op vals for Cost Control section
  const contractVal = parseNum(editPOManual) || project.poValue || project.totalValue
  const totalOpLive = Object.keys(opVals).reduce((s, k) => s + parseNum(opVals[k]), 0)
  const netProfitLive = contractVal - totalOpLive
  const netMarginLive = contractVal > 0 ? (netProfitLive / contractVal) * 100 : 0
  const efisiensiLive = totalOpLive > 0 ? (contractVal / totalOpLive) * 100 : 0
  const costPctLive   = contractVal > 0 ? (totalOpLive / contractVal) * 100 : 0

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">

        {/* ── Header ─────────────────────────────── */}
        <div className="modal-hdr relative px-7 pt-6 pb-4 shrink-0">
          <button type="button" onClick={onClose} aria-label="Tutup"
            className="absolute top-5 right-5 h-8 w-8 flex items-center justify-center rounded-full bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground transition-all z-10">
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4 pr-10">
            <div className={`mt-0.5 shrink-0 h-12 w-12 rounded-xl flex items-center justify-center text-xl border
              ${project.status === "SELESAI"    ? "bg-green-500/15 border-green-500/25"
              : project.status === "TERTUNGGAK" ? "bg-destructive/12 border-destructive/25"
              :                                   "bg-primary/10 border-primary/20"}`}>
              {project.status === "SELESAI" ? "✅" : project.status === "TERTUNGGAK" ? "⚠️" : "🔵"}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold leading-tight text-foreground mb-1">
                {editName || project.clientName}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {(editSite || project.location) && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {editSite || project.location}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border
                  ${project.status === "SELESAI"    ? "bg-green-500/10 text-green-700 border-green-500/25 dark:text-green-400"
                  : project.status === "TERTUNGGAK" ? "bg-destructive/10 text-destructive border-destructive/25"
                  :                                   "bg-primary/10 text-primary border-primary/20"}`}>
                  {project.status === "SELESAI" ? <CheckCircle2 className="h-2.5 w-2.5" /> : project.status === "TERTUNGGAK" ? <AlertTriangle className="h-2.5 w-2.5" /> : <CircleDot className="h-2.5 w-2.5" />}
                  {project.status}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {CAT_ICON[project.category]} {CAT_LABEL[project.category]}
                </span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              { label: "Nilai Kontrak",  val: fShort(contractVal),                           cls: "text-foreground" },
              { label: "Invoice Lunas",  val: `${project.paidCount}/${project.invoiceCount}`, cls: project.paidCount === project.invoiceCount ? "text-green-600" : "text-foreground" },
              { label: "Outstanding",    val: project.totalOutstanding > 0 ? fShort(project.totalOutstanding) : "Lunas ✓", cls: project.totalOutstanding > 0 ? "text-destructive" : "text-green-600" },
              { label: "Progres Fisik",  val: loading ? "…" : `${editProg}%`, cls: editProg >= 80 ? "text-green-600" : editProg >= 40 ? "text-primary" : "text-foreground" },
            ].map(s => (
              <div key={s.label} className="text-center bg-card/50 rounded-xl p-2.5 border border-border/60">
                <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{s.label}</p>
                <p className={`text-sm font-black font-mono ${s.cls}`}>{s.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────── */}
        <div className="modal-tabs shrink-0">
          <button type="button" className={`mtab ${tab === "project" ? "on" : ""}`} onClick={() => setTab("project")}>
            <ClipboardList className="h-3.5 w-3.5" /> Document Control
          </button>
          <button type="button" className={`mtab ${tab === "costcontrol" ? "on" : ""}`} onClick={() => setTab("costcontrol")}>
            <BarChart3 className="h-3.5 w-3.5" /> Cost Control
          </button>
          <button type="button" className={`mtab ${tab === "invoice" ? "on" : ""}`} onClick={() => setTab("invoice")}>
            <Receipt className="h-3.5 w-3.5" /> Invoice ({project.invoiceCount})
          </button>
        </div>

        {/* ── Tab Content ────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-background">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Memuat data…</div>
          ) : tab === "project" ? (

            /* ═══ DOCUMENT CONTROL ═══ */
            <div className="p-7">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-5 div-badge-proj">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Divisi Project — Document Control
              </span>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Nama Project / Klien</label>
                    <input className="minput" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nama project atau klien" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Site / Lokasi</label>
                    <input className="minput" value={editSite} onChange={e => setEditSite(e.target.value)} placeholder="Lokasi pekerjaan" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Deskripsi Pekerjaan</label>
                    <textarea className="minput" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Uraian singkat lingkup pekerjaan…" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Catatan Internal</label>
                    <textarea className="minput" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Catatan internal tim…" style={{ minHeight: 56 }} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Nilai PO / Kontrak (Rp)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold pointer-events-none">Rp</span>
                      <input className="minput" style={{ paddingLeft: 32 }} value={editPOManual}
                        onChange={e => setEditPOManual(e.target.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, "."))}
                        placeholder="Contoh: 500.000.000" />
                    </div>
                    {project.poValue > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">Dari invoice: <span className="font-semibold">{fIDR(project.poValue)}</span></p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                      Progres Fisik di Lapangan <span className="text-primary font-black ml-1">{editProg}%</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PROGRESS_STEPS.map(p => (
                        <button key={p} type="button" className={`pbtn ${editProg === p ? "on" : ""}`} onClick={() => setEditProg(p)}>
                          {p}%
                        </button>
                      ))}
                    </div>
                    {editProg > 0 && (
                      <div className="mt-3 pbar-bg">
                        <div className={`pbar-fill ${editProg === 100 ? "pbar-green" : "pbar-blue"}`} style={{ "--w": `${editProg}%` } as React.CSSProperties} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3 pt-5 border-t border-border">
                <button type="button" onClick={save} disabled={saving} className="savebtn savebtn-primary">
                  {saving ? "Menyimpan…" : savedOk ? <><CheckCheck className="h-4 w-4" /> Tersimpan!</> : <><Save className="h-4 w-4" /> Simpan Perubahan</>}
                </button>
                {savedOk && <span className="text-xs text-green-600 font-semibold">✓ Berhasil disimpan</span>}
              </div>
            </div>

          ) : tab === "costcontrol" ? (

            /* ═══ COST CONTROL ═══ */
            <div className="p-7">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-5 div-badge-fin">
                <span className="h-2 w-2 rounded-full bg-green-500" /> Divisi Finance — Cost Control
              </span>

              {/* Project info summary */}
              <div className="grid grid-cols-3 gap-3 mb-6 p-4 rounded-2xl border border-border bg-muted/20">
                {[
                  { label: "Nilai PO / Kontrak", val: fIDR(contractVal),       cls: "text-foreground font-black" },
                  { label: "Total Invoice",       val: fIDR(project.totalValue),cls: "text-foreground font-semibold" },
                  { label: "Sudah Terbayar",      val: fIDR(project.totalPaid), cls: "text-green-600 font-semibold" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">{s.label}</p>
                    <p className={`text-sm font-mono ${s.cls}`}>{s.val}</p>
                  </div>
                ))}
              </div>

              {/* ROI + Input two-column */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* ROI Gauge */}
                <div className="rounded-2xl border border-border bg-muted/10 p-5">
                  <p className="text-sm font-bold text-foreground mb-1">ROI Overview</p>
                  <p className="text-[11px] text-muted-foreground mb-3">Return on Investment berdasarkan biaya yang diinput</p>
                  <ROIGauge costPct={costPctLive} />
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {[
                      { label: "NET PROFIT",  val: totalOpLive > 0 ? fShort(netProfitLive)          : "—", cls: netProfitLive >= 0 ? "text-green-600" : "text-destructive" },
                      { label: "NET MARGIN",  val: totalOpLive > 0 ? `${netMarginLive.toFixed(1)}%` : "—", cls: netMarginLive >= 0 ? "text-green-600" : "text-destructive" },
                      { label: "EFISIENSI",   val: totalOpLive > 0 ? `${efisiensiLive.toFixed(0)}%` : "—", cls: efisiensiLive >= 100 ? "text-green-600" : "text-destructive" },
                    ].map(m => (
                      <div key={m.label} className="text-center p-2.5 rounded-xl border border-border bg-card">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{m.label}</p>
                        <p className={`text-base font-black font-mono ${m.cls}`}>{m.val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Op Cost Input */}
                <div className="rounded-2xl border border-border bg-muted/10 p-5">
                  <p className="text-sm font-bold text-foreground mb-1">Input Biaya Operasional</p>
                  <p className="text-[11px] text-muted-foreground mb-4">Masukkan biaya rata-rata untuk menghitung ROI sejati</p>
                  <div className="grid grid-cols-2 gap-3">
                    {OP_FIELDS.map(f => (
                      <div key={f.key}>
                        <label className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                          <span>{f.icon}</span> {f.label}
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none font-semibold">Rp</span>
                          <input className="minput" style={{ fontSize: 12, paddingLeft: 28, paddingTop: 7, paddingBottom: 7 }}
                            value={opVals[f.key]}
                            placeholder={`Cth: ${(f.ex / 1_000_000).toFixed(0)}Jt`}
                            onChange={e => {
                              const raw = e.target.value.replace(/[^\d]/g, "")
                              const fmt = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
                              setOpVals(p => ({ ...p, [f.key]: fmt }))
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3">* Klik Simpan untuk menyimpan data cost control</p>
                </div>
              </div>

              {/* Actual cost log */}
              <div className="mt-6">
                <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" /> Log Biaya Aktual
                </p>

                <div className="rounded-xl border border-border bg-muted/15 p-4 mb-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">Tambah Biaya Aktual</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Kategori</label>
                      <select className="minput" title="Kategori biaya" style={{ fontSize: 12 }} value={ccat} onChange={e => setCcat(e.target.value)}>
                        <option value="material">Material</option>
                        <option value="subkon">Subkon</option>
                        <option value="harian">Orang Harian</option>
                        <option value="pengiriman">Pengiriman</option>
                        <option value="lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Tanggal</label>
                      <input type="date" className="minput" title="Tanggal biaya" style={{ fontSize: 12 }} value={cdate} onChange={e => setCdate(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Deskripsi</label>
                      <input className="minput" style={{ fontSize: 12 }} value={cdesc} onChange={e => setCdesc(e.target.value)} placeholder="Keterangan biaya" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Jumlah (Rp)</label>
                      <input className="minput" style={{ fontSize: 12 }} value={camt}
                        onChange={e => setCamt(e.target.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, "."))}
                        placeholder="Contoh: 5.000.000" />
                    </div>
                  </div>
                  <button type="button" disabled={adding || !cdesc || !camt} onClick={addCost}
                    className="savebtn savebtn-primary" style={{ fontSize: 12, padding: "7px 16px" }}>
                    <Plus className="h-3.5 w-3.5" /> {adding ? "Menambahkan…" : "Tambah"}
                  </button>
                </div>

                {costs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Belum ada biaya aktual tercatat</p>
                ) : (
                  <>
                    {costs.map(c => (
                      <div key={c.id} className="inv-row flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">{c.category}</span>
                            {c.cost_date && <span className="text-[10px] text-muted-foreground">{c.cost_date}</span>}
                          </div>
                          <p className="text-xs text-foreground font-medium truncate">{c.description}</p>
                          <p className="text-[10px] text-muted-foreground">by {c.input_by}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-sm font-bold font-mono text-foreground">{fIDR(c.amount)}</p>
                          <button type="button" title="Hapus biaya" aria-label="Hapus biaya" onClick={() => delCost(c.id)}
                            className="text-muted-foreground/40 hover:text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="mt-3 p-3 rounded-xl border border-border bg-muted/20 flex justify-between items-center">
                      <span className="text-xs font-semibold text-muted-foreground">Total Biaya Aktual</span>
                      <span className="text-sm font-black font-mono text-destructive">{fIDR(costs.reduce((s, c) => s + c.amount, 0))}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6 flex items-center gap-3 pt-5 border-t border-border">
                <button type="button" onClick={save} disabled={saving} className="savebtn savebtn-primary">
                  {saving ? "Menyimpan…" : savedOk ? <><CheckCheck className="h-4 w-4" /> Tersimpan!</> : <><Save className="h-4 w-4" /> Simpan Cost Control</>}
                </button>
                {savedOk && <span className="text-xs text-green-600 font-semibold">✓ Berhasil disimpan</span>}
              </div>
            </div>

          ) : (

            /* ═══ INVOICE ═══ */
            <div className="p-7">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-5 div-badge-fin">
                <span className="h-2 w-2 rounded-full bg-green-500" /> Divisi Finance — Invoice
              </span>

              {/* Billing progress */}
              <div className="rounded-2xl border border-border bg-muted/15 p-4 mb-5">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-muted-foreground font-medium">Billing Progress</span>
                  <span className="font-bold text-foreground">{project.paidCount}/{project.invoiceCount} terbayar · {bilPct}%</span>
                </div>
                <div className="pbar-bg">
                  <div className={`pbar-fill ${barCls}`} style={{ "--w": `${bilPct}%` } as React.CSSProperties} />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                  <span>Total: <span className="font-semibold text-foreground">{fIDR(project.totalValue)}</span></span>
                  <span>Terbayar: <span className="font-semibold text-green-600">{fIDR(project.totalPaid)}</span></span>
                  {project.totalOutstanding > 0 && <span>Outstanding: <span className="font-semibold text-destructive">{fIDR(project.totalOutstanding)}</span></span>}
                </div>
              </div>

              {/* Termin dots */}
              {project.invoiceCount > 1 && (
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Timeline Termin</p>
                  <div className="tl">
                    {project.termins.slice(0, 12).map((t, idx) => {
                      const ok = t.invoice.status === "PAID"
                      const warn = !ok && project.status === "TERTUNGGAK"
                      const prevOk = idx > 0 && project.termins[idx - 1].invoice.status === "PAID"
                      return (
                        <div key={t.invoice.invoice_no}
                          className={`tl-item ${ok ? "is-ok" : ""} ${prevOk ? "prev-ok" : ""}`}
                          title={`${t.label} · ${fIDR(t.invoice.total)} · ${t.invoice.status}`}>
                          <div className={`tl-dot ${ok ? "ok" : warn ? "warn" : "no"}`}>{ok ? "✓" : idx + 1}</div>
                          <p className="tl-lbl">{t.label}</p>
                        </div>
                      )
                    })}
                    {project.invoiceCount > 12 && (
                      <div className="tl-item">
                        <div className="tl-dot no">+{project.invoiceCount - 12}</div>
                        <p className="tl-lbl">lagi</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {project.invoices.map((inv, idx) => (
                <div key={inv.invoice_no} className="inv-row">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-[10px] font-black
                      ${inv.status === "PAID" ? "bg-green-500 text-white" : "bg-muted border border-border text-muted-foreground"}`}>
                      {inv.status === "PAID" ? "✓" : idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs font-mono font-semibold text-muted-foreground">{inv.invoice_no}</span>
                        {inv.po_number && <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded">PO: {inv.po_number}</span>}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${inv.status === "PAID" ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}>
                          {inv.status === "PAID" ? "LUNAS" : "UNPAID"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">{inv.description}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">{inv.date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold font-mono text-foreground">{fShort(inv.total)}</p>
                      {inv.payment_value > 0 && <p className="text-[10px] text-green-600">Bayar: {fShort(inv.payment_value)}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Project Card (3 sections) ────────────────────────────────────────────────
function ProjectCard({ project, detail, onClick }: {
  project: Project
  detail: ProjectDetail | null
  onClick: () => void
}) {
  const bilPct  = Math.round(project.billingProgress)
  const barCls  = project.status === "SELESAI" ? "pbar-green" : project.status === "TERTUNGGAK" ? "pbar-red" : "pbar-blue"
  const stCls   = project.status === "SELESAI" ? "st-selesai" : project.status === "TERTUNGGAK" ? "st-tertunggak" : "st-berjalan"
  const physProg = detail?.physical_progress ?? 0
  const hasProg  = physProg > 0
  const cc = calcCC(detail, project.poValue || project.totalValue)
  const MAX = 5

  return (
    <div className={`pcard ${stCls}`} onClick={onClick}>

      {/* ── TOP: Name & Status ─────────────────── */}
      <div className="pcard-top">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {project.status === "SELESAI" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/12 text-green-700 border border-green-500/25 px-2 py-0.5 text-[10px] font-bold dark:text-green-400">
                <CheckCircle2 className="h-2.5 w-2.5" /> SELESAI
              </span>
            )}
            {project.status === "BERJALAN" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[10px] font-bold">
                <CircleDot className="h-2.5 w-2.5" /> BERJALAN
              </span>
            )}
            {project.status === "TERTUNGGAK" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive border border-destructive/25 px-2 py-0.5 text-[10px] font-bold">
                <AlertTriangle className="h-2.5 w-2.5" /> TERTUNGGAK
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {CAT_ICON[project.category]} {CAT_LABEL[project.category]}
            </span>
          </div>
          <span className="shrink-0 text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5 border border-border">
            {project.invoiceCount} inv
          </span>
        </div>
        <h3 className="text-[15px] font-bold leading-snug line-clamp-1 tracking-tight text-foreground">{project.clientName}</h3>
        {project.location && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
            <MapPin className="h-2.5 w-2.5 shrink-0" /> {project.location}
          </p>
        )}
      </div>

      {/* ── SECTION 1: Divisi Project – Progres Fisik ── */}
      <div className="pcard-section">
        <div className="sec-lbl sec-lbl-proj">
          🏗️ Progres Project
          <span className="ml-auto font-black text-xs" style={{ color: "inherit" }}>
            {hasProg ? `${physProg}%` : "—"}
          </span>
        </div>
        {hasProg ? (
          <div>
            <div className="pbar-bg">
              <div className={`pbar-fill ${physProg === 100 ? "pbar-green" : "pbar-blue"}`}
                style={{ "--w": `${physProg}%` } as React.CSSProperties} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {physProg === 100 ? "✅ Pekerjaan selesai 100%" : `Fisik di lapangan ${physProg}% selesai`}
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground italic">Belum ada data dari Divisi Project</p>
        )}
      </div>

      {/* ── SECTION 2: Divisi Finance – Tagihan ── */}
      <div className="pcard-section">
        <div className="sec-lbl sec-lbl-fin">
          💰 Tagihan &amp; Billing
          <span className="ml-auto font-black text-xs" style={{ color: "inherit" }}>{bilPct}%</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="mbox-sm">
            <p className="text-[10px] text-muted-foreground mb-0.5">Total Kontrak</p>
            <p className="text-xs font-black font-mono text-foreground">{fShort(project.totalValue)}</p>
          </div>
          <div className={`mbox-sm ${project.totalOutstanding > 0 ? "border-destructive/30" : "border-green-500/30"}`}>
            <p className={`text-[10px] mb-0.5 ${project.totalOutstanding > 0 ? "text-destructive/70" : "text-green-600/70"}`}>
              {project.totalOutstanding > 0 ? "Outstanding" : "Status"}
            </p>
            <p className={`text-xs font-black font-mono ${project.totalOutstanding > 0 ? "text-destructive" : "text-green-600"}`}>
              {project.totalOutstanding > 0 ? fShort(project.totalOutstanding) : "Lunas ✓"}
            </p>
          </div>
        </div>
        <div className="pbar-bg">
          <div className={`pbar-fill ${barCls}`} style={{ "--w": `${bilPct}%` } as React.CSSProperties} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          {project.paidCount}/{project.invoiceCount} invoice terbayar
          {project.invoiceCount > 1 && (
            <span className="ml-2">
              {project.termins.slice(0, MAX).map(t => (
                <span key={t.invoice.invoice_no}
                  className={`inline-block w-2 h-2 rounded-full mr-0.5 ${t.invoice.status === "PAID" ? "bg-green-500" : project.status === "TERTUNGGAK" ? "bg-destructive/70" : "bg-muted-foreground/30"}`}
                  title={`${t.label}: ${t.invoice.status}`} />
              ))}
              {project.invoiceCount > MAX && <span className="text-muted-foreground/50">+{project.invoiceCount - MAX}</span>}
            </span>
          )}
        </p>
      </div>

      {/* ── SECTION 3: Cost Control ── */}
      <div className="pcard-section">
        <div className="sec-lbl sec-lbl-cost">
          📊 Cost Control
          <span className="ml-auto font-black text-xs" style={{ color: "inherit" }}>
            {cc.hasCC ? `${cc.netMargin.toFixed(1)}%` : "—"}
          </span>
        </div>
        {cc.hasCC ? (
          <div className="grid grid-cols-3 gap-1.5">
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Net Profit</p>
              <p className={`text-[11px] font-black font-mono ${cc.netProfit! >= 0 ? "text-green-600" : "text-destructive"}`}>{fShort(cc.netProfit!)}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Margin</p>
              <p className={`text-[11px] font-black ${cc.netMargin >= 0 ? "text-green-600" : "text-destructive"}`}>{cc.netMargin.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Efisiensi</p>
              <p className={`text-[11px] font-black ${cc.efisiensi >= 100 ? "text-green-600" : "text-amber-500"}`}>{cc.efisiensi.toFixed(0)}%</p>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground italic">Belum ada data dari Divisi Cost Control</p>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div className="pcard-footer">
        <div className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground">
            {project.firstDate === project.lastDate ? project.firstDate : `${project.firstDate} — ${project.lastDate}`}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-primary flex items-center gap-0.5">
          Detail <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { invoices: raw, periodLabel } = useFilteredInvoices()
  const allProjects = React.useMemo(() => buildProjects(raw), [raw])
  const [detailMap, setDetailMap] = React.useState<Map<string, ProjectDetail>>(new Map())
  const [search,       setSearch]       = React.useState("")
  const [filterStatus, setFilterStatus] = React.useState("Semua")
  const [filterCat,    setFilterCat]    = React.useState("Semua")
  const [selected,     setSelected]     = React.useState<Project | null>(null)

  // Fetch all project details in one bulk request
  React.useEffect(() => {
    fetch("/api/project-details")
      .then(r => r.json())
      .then(d => {
        const map = new Map<string, ProjectDetail>()
        for (const det of (d.data ?? [])) map.set(det.project_key, det)
        setDetailMap(map)
      })
      .catch(() => {})
  }, [])

  function handleDetailSaved(det: ProjectDetail) {
    setDetailMap(prev => {
      const next = new Map(prev)
      next.set(det.project_key, det)
      return next
    })
  }

  const stats = React.useMemo(() => ({
    total:      allProjects.length,
    selesai:    allProjects.filter(p => p.status === "SELESAI").length,
    berjalan:   allProjects.filter(p => p.status === "BERJALAN").length,
    tertunggak: allProjects.filter(p => p.status === "TERTUNGGAK").length,
    totalValue: allProjects.reduce((s, p) => s + p.totalValue, 0),
    totalOut:   allProjects.reduce((s, p) => s + p.totalOutstanding, 0),
  }), [allProjects])

  const displayed = React.useMemo(() => {
    let list = [...allProjects]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.clientName.toLowerCase().includes(q) ||
        p.clientFull.toLowerCase().includes(q) ||
        p.invoices.some(i =>
          (i.site_name ?? "").toLowerCase().includes(q) ||
          (i.po_number ?? "").toLowerCase().includes(q) ||
          (i.invoice_no ?? "").toLowerCase().includes(q)
        )
      )
    }
    if (filterStatus !== "Semua") list = list.filter(p => p.status === filterStatus)
    if (filterCat    !== "Semua") list = list.filter(p => p.category === filterCat)
    return list
  }, [allProjects, search, filterStatus, filterCat])

  const hasFilter = !!search || filterStatus !== "Semua" || filterCat !== "Semua"
  const STATUSES  = ["Semua", "TERTUNGGAK", "BERJALAN", "SELESAI"]
  const CATS      = ["Semua", "Maintenance", "Material/PAC", "Project/Instalasi", "Jasa"]

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />

        <div className="flex flex-1 flex-col gap-5 p-6">

          {/* ── Header ─────────────────────────────────── */}
          <div className="u1 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-sm">
                <FolderKanban className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Projects</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {allProjects.length} proyek · {raw.length} invoice · {periodLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {stats.tertunggak > 0 && (
                <button type="button" onClick={() => setFilterStatus(p => p === "TERTUNGGAK" ? "Semua" : "TERTUNGGAK")}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all
                    ${filterStatus === "TERTUNGGAK" ? "bg-destructive text-destructive-foreground border-destructive shadow-md" : "bg-destructive/8 text-destructive border-destructive/25 hover:bg-destructive/15"}`}>
                  <AlertTriangle className="h-3 w-3" /> {stats.tertunggak} tertunggak
                </button>
              )}
              <button type="button" onClick={() => setFilterStatus(p => p === "BERJALAN" ? "Semua" : "BERJALAN")}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all
                  ${filterStatus === "BERJALAN" ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-primary/8 text-primary border-primary/20 hover:bg-primary/15"}`}>
                <CircleDot className="h-3 w-3" /> {stats.berjalan} berjalan
              </button>
              <button type="button" onClick={() => setFilterStatus(p => p === "SELESAI" ? "Semua" : "SELESAI")}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all
                  ${filterStatus === "SELESAI" ? "bg-green-600 text-white border-green-600 shadow-md" : "bg-green-500/8 text-green-700 border-green-500/20 hover:bg-green-500/15 dark:text-green-400"}`}>
                <CheckCircle2 className="h-3 w-3" /> {stats.selesai} selesai
              </button>
            </div>
          </div>

          {/* ── KPI Cards ───────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {([
              { sc: "s1", title: "Total Proyek",  val: stats.total,      fmt: (v: number) => String(v), sub: `${raw.length} invoice`,                   icon: <FolderKanban className="h-4 w-4 text-muted-foreground" />, cls: "" },
              { sc: "s2", title: "Nilai Kontrak", val: stats.totalValue, fmt: fShort,                   sub: `gross ${periodLabel}`,                    icon: <Receipt className="h-4 w-4 text-muted-foreground" />,     cls: "text-lg font-bold" },
              { sc: "s3", title: "Selesai",       val: stats.selesai,    fmt: (v: number) => String(v), sub: `${stats.total > 0 ? ((stats.selesai / stats.total) * 100).toFixed(0) : 0}% dari total`, icon: <CheckCircle2 className="h-4 w-4 text-green-600" />, cls: "text-green-600" },
              { sc: "s4", title: "Outstanding",   val: stats.totalOut,   fmt: fShort,                   sub: `${stats.tertunggak + stats.berjalan} proyek belum lunas`, icon: <AlertTriangle className="h-4 w-4 text-destructive" />, cls: stats.totalOut > 0 ? "text-destructive text-lg font-bold" : "text-green-600" },
            ] as const).map(c => (
              <div key={c.title} className={c.sc}>
                <Card className="kcard">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-foreground">{c.title}</CardTitle>
                    {c.icon}
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-black ${c.cls}`}>{c.fmt(c.val)}</div>
                    <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* ── Status distribution ─────────────────────── */}
          <div className="u2">
            <Card>
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-[180px] space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Distribusi status</span>
                      <span className="font-semibold text-foreground">{stats.total} proyek</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden flex gap-0.5 bg-muted">
                      {stats.tertunggak > 0 && <div className="h-full bg-destructive" style={{ width: `${(stats.tertunggak / stats.total) * 100}%` }} />}
                      {stats.berjalan   > 0 && <div className="h-full bg-primary"     style={{ width: `${(stats.berjalan   / stats.total) * 100}%` }} />}
                      {stats.selesai    > 0 && <div className="h-full bg-green-500"   style={{ width: `${(stats.selesai    / stats.total) * 100}%` }} />}
                    </div>
                  </div>
                  <div className="flex gap-5 shrink-0 flex-wrap">
                    {[
                      { l: "Tertunggak", c: stats.tertunggak, bg: "bg-destructive", s: "TERTUNGGAK" },
                      { l: "Berjalan",   c: stats.berjalan,   bg: "bg-primary",     s: "BERJALAN"   },
                      { l: "Selesai",    c: stats.selesai,    bg: "bg-green-500",   s: "SELESAI"    },
                    ].map(x => (
                      <button key={x.l} type="button" onClick={() => setFilterStatus(p => p === x.s ? "Semua" : x.s)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all
                          ${filterStatus === x.s ? "bg-primary/10 text-primary font-black ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground"}`}>
                        <span className={`h-2 w-2 rounded-full ${x.bg}`} />
                        {x.l} <span className="font-bold text-foreground ml-0.5">{x.c}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Filter & Search ─────────────────────────── */}
          <div className="u3">
            <Card className="overflow-hidden">
              <div className="px-6 py-3 border-b bg-primary/5 flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-[11px] font-black uppercase tracking-wider text-primary/80">Filter &amp; Cari</span>
              </div>
              <CardContent className="py-4 px-6 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Cari klien, no. invoice, no. PO, site…" className="sbox" />
                  {search && (
                    <button type="button" title="Hapus pencarian" aria-label="Hapus pencarian" onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-muted-foreground font-medium">Status:</span>
                  {STATUSES.map(s => (
                    <button key={s} type="button" onClick={() => setFilterStatus(s)} className={`chip ${filterStatus === s ? "on" : ""}`}>
                      {s === "Semua" ? `Semua (${stats.total})` : s}
                    </button>
                  ))}
                  <span className="mx-1 h-4 w-px bg-border" />
                  <span className="text-muted-foreground font-medium">Tipe:</span>
                  {CATS.map(c => (
                    <button key={c} type="button" onClick={() => setFilterCat(c)} className={`chip ${filterCat === c ? "on" : ""}`}>{c}</button>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Menampilkan <span className="font-bold text-foreground">{displayed.length}</span> proyek
                    {detailMap.size > 0 && <span className="ml-2 text-muted-foreground/60">· {detailMap.size} sudah ada data project</span>}
                  </p>
                  {hasFilter && (
                    <button type="button" onClick={() => { setSearch(""); setFilterStatus("Semua"); setFilterCat("Semua") }}
                      className="text-xs text-primary hover:underline font-medium">Reset filter</button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Project Grid ────────────────────────────── */}
          <div className="u4">
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <FolderKanban className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">Tidak ada proyek ditemukan</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Coba ubah filter atau kata kunci</p>
                {hasFilter && (
                  <button type="button" onClick={() => { setSearch(""); setFilterStatus("Semua"); setFilterCat("Semua") }}
                    className="mt-4 text-xs font-semibold text-primary hover:underline">Reset semua filter</button>
                )}
              </div>
            ) : (
              <div className="pgrid">
                {displayed.map((p, i) => (
                  <div key={p.id} style={{ animationDelay: `${Math.min(i * 0.025, 0.35)}s` }} className="u4">
                    <ProjectCard
                      project={p}
                      detail={detailMap.get(p.id) ?? null}
                      onClick={() => setSelected(p)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail Modal */}
        {selected && (
          <DetailModal
            project={selected}
            initDetail={detailMap.get(selected.id) ?? null}
            onClose={() => setSelected(null)}
            onDetailSaved={handleDetailSaved}
          />
        )}

      </SidebarInset>
    </SidebarProvider>
  )
}
