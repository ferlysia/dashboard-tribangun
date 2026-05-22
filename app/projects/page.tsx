"use client"

import * as React from "react"
import {
  FolderKanban, Search, CircleDot, CheckCircle2, AlertTriangle,
  CalendarDays, Receipt, Package, Wrench, Briefcase, X, Filter,
  Hash, Plus, Trash2, TrendingUp, MapPin, ChevronRight,
  ClipboardList, BarChart3, DollarSign, Save, CheckCheck,
  Link2, FolderOpen, Camera, ListChecks, RotateCcw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useFilteredInvoices } from "@/lib/use-filtered-invoices"
import { useCurrentUser } from "@/components/providers/current-user-provider"
import { useInvoices } from "@/components/providers/invoices-provider"
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

type VOEntry = {
  id: string
  po_number: string
  description: string
  nilai_po: number
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
  onedrive_folder_url?: string | null
  created_manually?: boolean
  customer_name?: string
  project_status?: string
  op_budget_vo?: number
  po_number?: string | null
  op_vo_gaji?: number
  op_vo_material?: number
  op_vo_transport?: number
  op_vo_operasional?: number
  op_vo_sewa?: number
  op_vo_lainnya?: number
  vo_entries?: VOEntry[] | null
}

type WeeklyLog = {
  id: string
  project_key: string
  week_number: number
  description: string
  photo_url: string
  created_by: string
  created_at: string
}

type ScheduleItem = {
  id: string
  project_key: string
  week_number: number
  task_description: string
  progress_weight: number
  is_done: boolean
  completed_at: string | null
  created_at: string
}

type FinanceInvoiceForm = {
  invoice_no: string
  project_type: string
  customer: string
  site_name: string
  description: string
  date: string
  invoice_sent_date: string
  terms_of_payment: string
  po_number: string
  po_date: string
  po_value: string
  tax_type: "PPN" | "NON_PPN"
  dpp: string
  ppn: string
  total: string
  payment_date: string
  payment_value: string
  selisih: string
  status: "PAID" | "UNPAID"
  keterangan: string
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
  cost_stream?: string
}

type Escalation = {
  id: string
  project_key: string
  escalation_type: string
  threshold_pct: number
  triggered_at: string
  acknowledged_by: string | null
  acknowledged_at: string | null
  notes: string | null
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
  { key: "op_gaji",        voKey: "op_vo_gaji",        label: "Gaji & Tunjangan",     icon: "👤", ex: 150_000_000 },
  { key: "op_operasional", voKey: "op_vo_operasional", label: "Biaya Operasional",    icon: "⚙️", ex: 50_000_000  },
  { key: "op_material",    voKey: "op_vo_material",    label: "Biaya Material/Bahan", icon: "🧱", ex: 80_000_000  },
  { key: "op_sewa",        voKey: "op_vo_sewa",        label: "Sewa & Utilitas",      icon: "🏢", ex: 20_000_000  },
  { key: "op_transport",   voKey: "op_vo_transport",   label: "Transport & Logistik", icon: "🚛", ex: 15_000_000  },
  { key: "op_lainnya",     voKey: "op_vo_lainnya",     label: "Biaya Lainnya",        icon: "📦", ex: 10_000_000  },
] as const

const PROGRESS_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

const EMPTY_FINANCE_FORM: FinanceInvoiceForm = {
  invoice_no: "", project_type: "", customer: "", site_name: "",
  description: "", date: "", invoice_sent_date: "", terms_of_payment: "",
  po_number: "", po_date: "", po_value: "", tax_type: "PPN",
  dpp: "", ppn: "", total: "", payment_date: "", payment_value: "",
  selisih: "", status: "UNPAID", keterangan: "",
}

// ─── ROI Gauge ────────────────────────────────────────────────────────────────
function ROIGauge({ costPct }: { costPct: number }) {
  // cx=110 cy=82 r=70 — flat diameter at y=82, needle always sweeps ABOVE y=82.
  // All display text lives BELOW y=82: permanently outside the needle's reach.
  const cx = 110, cy = 82, r = 70
  const clamped   = Math.min(200, Math.max(0, costPct))
  const angleDeg  = (clamped / 200) * 180 - 180
  const rad       = (angleDeg * Math.PI) / 180
  const nx = cx + r * Math.cos(rad)
  const ny = cy + r * Math.sin(rad)

  function arcPath(startPct: number, endPct: number) {
    const a1 = ((startPct / 200) * 180 - 180) * (Math.PI / 180)
    const a2 = ((endPct   / 200) * 180 - 180) * (Math.PI / 180)
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
    return `M ${x1} ${y1} A ${r} ${r} 0 ${endPct - startPct > 100 ? 1 : 0} 1 ${x2} ${y2}`
  }

  return (
    // viewBox height=122 gives 40 px of safe space below cy=82 for text
    <svg viewBox="0 0 220 122" className="w-full max-w-[220px] mx-auto" aria-label="ROI Gauge">
      {/* Track + colour zones */}
      <path d={arcPath(0, 200)}   fill="none" stroke="#e2e8f0" strokeWidth="11" strokeLinecap="round" />
      <path d={arcPath(0, 70)}    fill="none" stroke="#22c55e" strokeWidth="11" />
      <path d={arcPath(70, 100)}  fill="none" stroke="#f59e0b" strokeWidth="11" />
      <path d={arcPath(100, 200)} fill="none" stroke="#ef4444" strokeWidth="11" />

      {/* Needle — sweeps only above cy; never crosses below */}
      {costPct > 0 && (
        <>
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="5.5" fill="#1e293b" />
          <circle cx={nx} cy={ny} r="3"   fill="#475569" />
        </>
      )}

      {/* Scale tick labels — flanking outside arc endpoints */}
      <text x="12"  y="96" fontSize="8.5" fill="#94a3b8" textAnchor="middle">0%</text>
      <text x="110" y="11" fontSize="8.5" fill="#94a3b8" textAnchor="middle">100%</text>
      <text x="208" y="96" fontSize="8.5" fill="#94a3b8" textAnchor="middle">200%</text>

      {/* ── Value display — BELOW flat diameter, zero collision risk ── */}
      {costPct > 0 ? (
        <>
          <text x={cx} y={cy + 22} fontSize="19" fontWeight="800" textAnchor="middle"
                fill="#0f172a" className="dark-gauge-text">
            {costPct.toFixed(0)}%
          </text>
          <text x={cx} y={cy + 35} fontSize="8" fill="#94a3b8" textAnchor="middle">
            rasio biaya / PO
          </text>
        </>
      ) : (
        <text x={cx} y={cy + 22} fontSize="9" fill="#94a3b8" textAnchor="middle">
          input estimasi →
        </text>
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

  /* ════ FINANCE TAB ══════════════════════════════════════════════════════════ */
  /* PO Reference Panel */
  .po-ref-panel {
    border-radius: 10px;
    border: 1.5px solid color-mix(in oklch, #3b82f6 30%, transparent);
    background: color-mix(in oklch, #3b82f6 5%, transparent);
    padding: 10px 14px; margin-top: 8px;
  }
  .dark .po-ref-panel {
    background: color-mix(in oklch, #3b82f6 8%, transparent);
    border-color: color-mix(in oklch, #3b82f6 25%, transparent);
  }
  /* Billing Lock Banner */
  .billing-lock-banner {
    border-radius: 10px;
    border: 1.5px solid color-mix(in oklch, var(--destructive) 35%, transparent);
    background: color-mix(in oklch, var(--destructive) 6%, transparent);
    padding: 10px 14px; margin-bottom: 16px;
  }
  /* Finance form section box */
  .fin-section {
    border-radius: 12px; border: 1.5px solid var(--border);
    padding: 14px 16px; margin-bottom: 14px;
    background: color-mix(in oklch, var(--muted) 10%, transparent);
  }
  .fin-section-lbl {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em;
    text-transform: uppercase; margin-bottom: 12px;
    color: var(--muted-foreground);
  }
  /* Status toggle */
  .stat-opt {
    flex: 1; padding: 8px 10px; border-radius: 9px;
    border: 2px solid var(--border); text-align: center;
    font-size: 12px; font-weight: 700; cursor: pointer;
    transition: all .14s; background: transparent;
  }
  .stat-opt.paid   { border-color: #16a34a; background: #16a34a10; color: #16a34a; }
  .stat-opt.unpaid { border-color: hsl(var(--destructive)); background: hsl(var(--destructive)/.08); color: hsl(var(--destructive)); }
  .stat-opt.inact  { border-color: var(--border); color: var(--muted-foreground); }
  .stat-opt.inact:hover { background: color-mix(in oklch,var(--muted) 40%,transparent); }

  /* ════ DOCUMENT CONTROL SUB-TABS ════════════════════════════════════════════ */
  .dtab {
    padding: 7px 14px; border-radius: 9px; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all .14s; border: none;
    color: var(--muted-foreground); background: transparent;
    display: flex; align-items: center; gap: 5px; white-space: nowrap;
  }
  .dtab:hover { color: var(--foreground); background: color-mix(in oklch, var(--muted) 50%, transparent); }
  .dtab.on {
    background: var(--card); color: var(--primary); font-weight: 700;
    box-shadow: 0 1px 4px rgba(0,0,0,.10);
  }
  .dark .dtab.on { box-shadow: 0 1px 4px rgba(0,0,0,.35); }

  /* Weekly log card */
  .log-card {
    padding: 12px 14px; border-radius: 10px;
    border: 1.5px solid var(--border);
    background: color-mix(in oklch, var(--muted) 15%, transparent);
    transition: border-color .13s;
  }
  .log-card:hover { border-color: color-mix(in oklch, var(--primary) 40%, transparent); }

  /* ════ COST CONTROL DUAL-STREAM ════════════════════════════════════════════ */
  .cc-seg {
    display: flex; gap: 3px; padding: 3px; border-radius: 11px;
    background: color-mix(in oklch, var(--muted) 60%, transparent);
    border: 1.5px solid var(--border);
  }
  .cc-seg-btn {
    flex: 1; padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: none; background: transparent; color: var(--muted-foreground);
    transition: all .14s; text-align: center; white-space: nowrap;
  }
  .cc-seg-btn:hover { color: var(--foreground); background: color-mix(in oklch, var(--muted) 50%, transparent); }
  .cc-seg-btn.on.stream-main {
    background: #f97316; color: #fff;
    box-shadow: 0 2px 8px -2px rgba(249,115,22,.45);
  }
  .cc-seg-btn.on.stream-vo {
    background: #8b5cf6; color: #fff;
    box-shadow: 0 2px 8px -2px rgba(139,92,246,.45);
  }

  /* Stream badges in cost log */
  .badge-main {
    display: inline-flex; align-items: center;
    font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 5px;
    background: color-mix(in oklch, #f97316 12%, transparent);
    border: 1px solid color-mix(in oklch, #f97316 30%, transparent);
    color: #ea580c; white-space: nowrap;
  }
  .badge-vo {
    display: inline-flex; align-items: center;
    font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 5px;
    background: color-mix(in oklch, #8b5cf6 12%, transparent);
    border: 1px solid color-mix(in oklch, #8b5cf6 30%, transparent);
    color: #7c3aed; white-space: nowrap;
  }
  .dark .badge-main { color: #fb923c; }
  .dark .badge-vo   { color: #a78bfa; }

  /* Schedule checklist row */
  .sched-row {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; border-radius: 10px;
    border: 1.5px solid var(--border);
    background: color-mix(in oklch, var(--muted) 10%, transparent);
    transition: all .13s;
  }
  .sched-row:hover { border-color: var(--primary); }
  .sched-row.done {
    background: color-mix(in oklch, #22c55e 5%, transparent);
    border-color: color-mix(in oklch, #22c55e 25%, transparent);
    opacity: .82;
  }
`

// ─── Cost helpers ─────────────────────────────────────────────────────────────
function calcCC(det: ProjectDetail | null | undefined, fallbackPO: number) {
  if (!det) return { totalOp: 0, hasCC: false, netMargin: 0, contractVal: fallbackPO, netProfit: 0, costPct: 0 }
  // Combined Nilai PO = PO Utama + VO contract value
  const basePO      = (det.po_value_manual ?? 0) > 0 ? (det.po_value_manual ?? 0) : fallbackPO
  const contractVal = basePO + (det.op_budget_vo ?? 0)
  // Combined PM budget estimate = main OP fields + VO OP fields
  const totalOp =
    (det.op_gaji ?? 0) + (det.op_material ?? 0) + (det.op_transport ?? 0) +
    (det.op_operasional ?? 0) + (det.op_sewa ?? 0) + (det.op_lainnya ?? 0) +
    (det.op_vo_gaji ?? 0) + (det.op_vo_material ?? 0) + (det.op_vo_transport ?? 0) +
    (det.op_vo_operasional ?? 0) + (det.op_vo_sewa ?? 0) + (det.op_vo_lainnya ?? 0)
  const hasCC     = totalOp > 0
  const netProfit = contractVal - totalOp
  const netMargin = contractVal > 0 ? (netProfit / contractVal) * 100 : 0
  const costPct   = contractVal > 0 ? (totalOp / contractVal) * 100 : 0
  return { totalOp, hasCC, netMargin, contractVal, netProfit, costPct }
}

function buildManualProject(det: ProjectDetail): Project {
  const totalNilaiPO = (det.po_value_manual || 0) + (det.op_budget_vo || 0)
  return {
    id: det.project_key,
    clientName: det.display_name || det.customer_name || "Proyek Baru",
    clientFull: det.customer_name || det.display_name || "",
    location: det.site_location || "",
    category: "Jasa",
    invoices: [],
    totalValue: totalNilaiPO,
    totalPaid: 0,
    totalOutstanding: totalNilaiPO,
    billingProgress: 0,
    status: (det.project_status as Project["status"]) || "BERJALAN",
    firstDate: new Date().toISOString().slice(0, 10),
    lastDate: new Date().toISOString().slice(0, 10),
    invoiceCount: 0, paidCount: 0, unpaidCount: 0,
    termins: [],
    poValue: totalNilaiPO,
  }
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ project, initDetail, onClose, onDetailSaved }: {
  project: Project
  initDetail: ProjectDetail | null
  onClose: () => void
  onDetailSaved: (d: ProjectDetail) => void
}) {
  const { user } = useCurrentUser()
  const [tab, setTab] = React.useState<"project" | "costcontrol" | "finance">("project")
  const [detail, setDetail] = React.useState<ProjectDetail | null>(initDetail)
  const [costs, setCosts]   = React.useState<ProjectCost[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving,   setSaving]   = React.useState(false)
  const [savedOk,  setSavedOk]  = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  const [editName,     setEditName]     = React.useState("")
  const [editSite,     setEditSite]     = React.useState("")
  const [editDesc,     setEditDesc]     = React.useState("")
  const [editProg,     setEditProg]     = React.useState(0)
  const [editNotes,    setEditNotes]    = React.useState("")
  const [editPOManual, setEditPOManual] = React.useState("")
  const [editPoNumber, setEditPoNumber] = React.useState("")
  const [opVals, setOpVals] = React.useState<Record<string, string>>({
    op_gaji: "", op_material: "", op_transport: "", op_operasional: "", op_sewa: "", op_lainnya: ""
  })
  const [activeStream, setActiveStream] = React.useState<string>("main")
  const [opVOVals, setOpVOVals] = React.useState<Record<string, string>>({
    op_vo_gaji: "", op_vo_material: "", op_vo_transport: "", op_vo_operasional: "", op_vo_sewa: "", op_vo_lainnya: ""
  })

  const [ccat,      setCcat]      = React.useState("material")
  const [cdesc,     setCdesc]     = React.useState("")
  const [camt,      setCamt]      = React.useState("")
  const [cdate,     setCdate]     = React.useState("")
  const [adding,    setAdding]    = React.useState(false)
  const [voEntries,   setVoEntries]   = React.useState<VOEntry[]>([])
  const [voForm,      setVoForm]      = React.useState({ po_number: "", description: "", nilai_po: "" })
  const [showVOForm,  setShowVOForm]  = React.useState(false)
  const [escalations,      setEscalations]      = React.useState<Escalation[]>([])
  const [escalationWarning, setEscalationWarning] = React.useState<string | null>(null)

  // ── Document Control extra state ──────────────────────────────────────────
  const [docSubTab,      setDocSubTab]      = React.useState<"log" | "schedule">("log")
  const [editOneDrive,   setEditOneDrive]   = React.useState("")
  const [weeklyLogs,     setWeeklyLogs]     = React.useState<WeeklyLog[]>([])
  const [schedItems,     setSchedItems]     = React.useState<ScheduleItem[]>([])
  const [docDataLoading, setDocDataLoading] = React.useState(false)
  const [showAddLog,     setShowAddLog]     = React.useState(false)
  const [logWeek,        setLogWeek]        = React.useState(1)
  const [logDesc,        setLogDesc]        = React.useState("")
  const [logPhoto,       setLogPhoto]       = React.useState<File | null>(null)
  const [addingLog,      setAddingLog]      = React.useState(false)
  const [showAddSched,   setShowAddSched]   = React.useState(false)
  const [schedWeek,      setSchedWeek]      = React.useState(1)
  const [schedTask,      setSchedTask]      = React.useState("")
  const [schedWeight,    setSchedWeight]    = React.useState(10)
  const [addingSched,    setAddingSched]    = React.useState(false)

  // ── Finance Tab state ─────────────────────────────────────────────────────
  const [financeForm,       setFinanceForm]       = React.useState<FinanceInvoiceForm>(EMPTY_FINANCE_FORM)
  const [financeSubmitting, setFinanceSubmitting] = React.useState(false)
  const [financeResult,     setFinanceResult]     = React.useState<{ type: "success" | "error"; message: string } | null>(null)
  const [financeShowSugg,   setFinanceShowSugg]   = React.useState(false)

  const setF = React.useCallback(<K extends keyof FinanceInvoiceForm>(field: K, val: FinanceInvoiceForm[K]) => {
    setFinanceForm(curr => ({ ...curr, [field]: val }))
  }, [])

  // Customer autocomplete for Finance form
  const { invoices: allInvoices } = useInvoices()
  const financeCustomers = React.useMemo(() => {
    const seen = new Set<string>()
    return allInvoices.map(i => i.customer).filter(c => { if (seen.has(c)) return false; seen.add(c); return true }).sort()
  }, [allInvoices])
  const financeSuggestions = React.useMemo(() => {
    if (!financeForm.customer.trim() || !financeShowSugg) return []
    const q = financeForm.customer.toLowerCase()
    return financeCustomers.filter(c => c.toLowerCase().includes(q)).slice(0, 8)
  }, [financeForm.customer, financeCustomers, financeShowSugg])

  function applyDetail(det: ProjectDetail) {
    setDetail(det)
    setEditName(det.display_name || project.clientName)
    setEditSite(det.site_location || project.location)
    setEditDesc(det.description || "")
    setEditProg(det.physical_progress || 0)
    setEditNotes(det.notes || "")
    setEditPOManual(fNum(det.po_value_manual || 0))
    setEditOneDrive(det.onedrive_folder_url || "")
    setEditPoNumber(det.po_number || "")
    // Load VO entries: prefer JSONB, fall back to scalar op_budget_vo for legacy data
    if (det.vo_entries && det.vo_entries.length > 0) {
      setVoEntries(det.vo_entries)
    } else if ((det.op_budget_vo ?? 0) > 0) {
      setVoEntries([{ id: "vo", po_number: "", description: "Kerja Tambah", nilai_po: Number(det.op_budget_vo ?? 0) }])
    } else {
      setVoEntries([])
    }
    setOpVals({
      op_gaji:        fNum(det.op_gaji || 0),
      op_material:    fNum(det.op_material || 0),
      op_transport:   fNum(det.op_transport || 0),
      op_operasional: fNum(det.op_operasional || 0),
      op_sewa:        fNum(det.op_sewa || 0),
      op_lainnya:     fNum(det.op_lainnya || 0),
    })
    setOpVOVals({
      op_vo_gaji:        fNum(det.op_vo_gaji || 0),
      op_vo_material:    fNum(det.op_vo_material || 0),
      op_vo_transport:   fNum(det.op_vo_transport || 0),
      op_vo_operasional: fNum(det.op_vo_operasional || 0),
      op_vo_sewa:        fNum(det.op_vo_sewa || 0),
      op_vo_lainnya:     fNum(det.op_vo_lainnya || 0),
    })
  }

  React.useEffect(() => {
    setLoading(true)
    setDocDataLoading(true)
    if (initDetail) applyDetail(initDetail)
    Promise.all([
      fetch(`/api/project-details/${encodeURIComponent(project.id)}`).then(r => r.json()),
      fetch(`/api/project-costs?key=${encodeURIComponent(project.id)}`).then(r => r.json()),
      fetch(`/api/project-weekly-logs/${encodeURIComponent(project.id)}`).then(r => r.json()),
      fetch(`/api/project-schedule/${encodeURIComponent(project.id)}`).then(r => r.json()),
      fetch(`/api/project-escalations/${encodeURIComponent(project.id)}`).then(r => r.json()),
    ]).then(([d, c, logs, sched, esc]) => {
      const det: ProjectDetail = d.data ?? { project_key: project.id }
      applyDetail(det)
      setCosts(c.data ?? [])
      setWeeklyLogs(logs.data ?? [])
      setSchedItems(sched.data ?? [])
      setEscalations(esc.data ?? [])
    }).finally(() => {
      setLoading(false)
      setDocDataLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  React.useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  // Finance form auto-calc: PPN & Total from DPP
  React.useEffect(() => {
    const dpp = Number(financeForm.dpp) || 0
    if (financeForm.tax_type === "PPN" && dpp > 0) {
      const ppn = Math.round(dpp * 0.11)
      setFinanceForm(c => ({ ...c, ppn: String(ppn), total: String(dpp + ppn) }))
    } else if (financeForm.tax_type === "NON_PPN" && dpp > 0) {
      setFinanceForm(c => ({ ...c, ppn: "0", total: String(dpp) }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financeForm.dpp, financeForm.tax_type])

  // Finance form auto-calc: Selisih from Total & Payment
  React.useEffect(() => {
    const total = Number(financeForm.total) || 0
    const paid  = Number(financeForm.payment_value) || 0
    if (total > 0 && paid > 0) setFinanceForm(c => ({ ...c, selisih: String(total - paid) }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financeForm.total, financeForm.payment_value])

  async function save() {
    setSaving(true); setSavedOk(false)
    try {
      const body: Record<string, unknown> = {
        display_name: editName, physical_progress: editProg,
        notes: editNotes, site_location: editSite, description: editDesc,
        po_value_manual: parseNum(editPOManual),
        onedrive_folder_url: editOneDrive.trim() || null,
        po_number: editPoNumber.trim() || null,
        op_gaji:        parseNum(opVals.op_gaji),
        op_material:    parseNum(opVals.op_material),
        op_transport:   parseNum(opVals.op_transport),
        op_operasional: parseNum(opVals.op_operasional),
        op_sewa:        parseNum(opVals.op_sewa),
        op_lainnya:        parseNum(opVals.op_lainnya),
        // Multi-VO: serialize entries + keep scalar op_budget_vo as aggregate
        vo_entries:        voEntries,
        op_budget_vo:      voEntries.reduce((s, e) => s + e.nilai_po, 0),
        // Keep legacy op_vo_* scalars from opVOVals (first-VO PM estimates)
        op_vo_gaji:        parseNum(opVOVals.op_vo_gaji),
        op_vo_material:    parseNum(opVOVals.op_vo_material),
        op_vo_transport:   parseNum(opVOVals.op_vo_transport),
        op_vo_operasional: parseNum(opVOVals.op_vo_operasional),
        op_vo_sewa:        parseNum(opVOVals.op_vo_sewa),
        op_vo_lainnya:     parseNum(opVOVals.op_vo_lainnya),
        ...(project.id.startsWith("MANUAL::") && { created_manually: true }),
      }
      const r = await fetch(`/api/project-details/${encodeURIComponent(project.id)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      const d = await r.json()
      if (d.error || !d.data) throw new Error(d.error || "Data tidak dikembalikan dari server")
      setDetail(d.data); onDetailSaved(d.data)
      setSaveError(null)
      setSavedOk(true); setTimeout(() => setSavedOk(false), 2500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Gagal menyimpan")
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
        body: JSON.stringify({ project_key: project.id, category: ccat, description: cdesc.trim(), amount: amt, cost_date: cdate || null, input_by: user?.email || "", cost_stream: activeStream }),
      })
      const d = await r.json()
      if (d.data) {
        setCosts(p => [...p, d.data])
        setCdesc(""); setCamt(""); setCdate("")
        if (d.escalationWarning) {
          setEscalationWarning(d.escalationWarning)
          // Reload escalations so the banner shows immediately
          fetch(`/api/project-escalations/${encodeURIComponent(project.id)}`).then(r => r.json()).then(e => setEscalations(e.data ?? []))
        }
      }
    } finally { setAdding(false) }
  }

  async function delCost(id: string) {
    await fetch(`/api/project-costs/${id}`, { method: "DELETE" })
    setCosts(p => p.filter(c => c.id !== id))
  }

  async function acknowledgeEscalation(id: string) {
    await fetch(`/api/project-escalations/${encodeURIComponent(project.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, acknowledged_by: user?.email || "unknown" }),
    })
    setEscalations(p => p.map(e =>
      e.id === id ? { ...e, acknowledged_at: new Date().toISOString(), acknowledged_by: user?.email || "unknown" } : e
    ))
  }

  // ── Weekly Log handlers ───────────────────────────────────────────────────
  async function addLog() {
    if (!logDesc.trim()) return
    setAddingLog(true)
    try {
      let photoUrl = ""
      if (logPhoto) {
        const fd = new FormData()
        fd.append("file", logPhoto)
        fd.append("path", `${project.id}/week${logWeek}_${Date.now()}.${logPhoto.name.split(".").pop() ?? "jpg"}`)
        const up = await fetch("/api/upload-photo", { method: "POST", body: fd })
        const upData = await up.json()
        photoUrl = upData.url || ""
      }
      const r = await fetch(`/api/project-weekly-logs/${encodeURIComponent(project.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_number: logWeek, description: logDesc.trim(), photo_url: photoUrl, created_by: user?.email || "" }),
      })
      const d = await r.json()
      if (d.data) {
        setWeeklyLogs(p => [...p, d.data].sort((a, b) => a.week_number - b.week_number))
        setLogDesc(""); setLogPhoto(null); setLogWeek(1); setShowAddLog(false)
      }
    } finally { setAddingLog(false) }
  }

  // ── Schedule Item handlers ────────────────────────────────────────────────
  async function addSchedItem() {
    if (!schedTask.trim()) return
    setAddingSched(true)
    try {
      const r = await fetch(`/api/project-schedule/${encodeURIComponent(project.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_number: schedWeek, task_description: schedTask.trim(), progress_weight: schedWeight }),
      })
      const d = await r.json()
      if (d.data) {
        setSchedItems(p => [...p, d.data].sort((a, b) => a.week_number - b.week_number))
        setSchedTask(""); setSchedWeek(1); setSchedWeight(10); setShowAddSched(false)
      }
    } finally { setAddingSched(false) }
  }

  async function toggleSchedItem(id: string, isDone: boolean) {
    const r = await fetch(`/api/project-schedule/item/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: isDone }),
    })
    const d = await r.json()
    if (d.data) {
      const updated = schedItems.map(s => s.id === id ? d.data : s)
      setSchedItems(updated)
      // Auto-calculate progress by weighted completion
      const totalW = updated.reduce((s, i) => s + i.progress_weight, 0)
      const doneW  = updated.filter(i => i.is_done).reduce((s, i) => s + i.progress_weight, 0)
      if (totalW > 0) {
        const raw = Math.round(Math.min(100, (doneW / totalW) * 100))
        // Snap to nearest PROGRESS_STEPS value
        const snapped = PROGRESS_STEPS.reduce((prev, curr) =>
          Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
        )
        setEditProg(snapped)
      }
    }
  }

  async function delSchedItem(id: string) {
    await fetch(`/api/project-schedule/item/${id}`, { method: "DELETE" })
    setSchedItems(p => p.filter(s => s.id !== id))
  }

  // ── Finance Invoice Submit ────────────────────────────────────────────────
  async function submitFinanceInvoice() {
    const missing = [
      !financeForm.invoice_no.trim() && "No. Invoice",
      !financeForm.customer.trim()   && "Nama Customer",
      !financeForm.description.trim() && "Deskripsi",
      !financeForm.date              && "Tanggal Invoice",
    ].filter(Boolean)
    if (missing.length > 0) {
      setFinanceResult({ type: "error", message: `Field wajib belum diisi: ${missing.join(", ")}` })
      return
    }
    setFinanceSubmitting(true); setFinanceResult(null)
    try {
      const payload = {
        ...financeForm,
        invoice_no:        financeForm.invoice_no.trim(),
        customer:          financeForm.customer.trim(),
        site_name:         financeForm.site_name.trim(),
        description:       financeForm.description.trim(),
        keterangan:        financeForm.keterangan.trim(),
        po_number:         financeForm.po_number.trim(),
        po_date:           financeForm.po_date || null,
        invoice_sent_date: financeForm.invoice_sent_date || null,
        terms_of_payment:  financeForm.terms_of_payment ? Number(financeForm.terms_of_payment) : null,
        po_value:          Number(financeForm.po_value   || 0),
        dpp:               Number(financeForm.dpp        || 0),
        ppn:               Number(financeForm.ppn        || 0),
        total:             Number(financeForm.total      || 0),
        payment_value:     Number(financeForm.payment_value || 0),
        selisih:           Number(financeForm.selisih    || 0),
        actor_email:       user?.email || "",
      }
      const res = await fetch("/api/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal membuat invoice")
      setFinanceResult({ type: "success", message: `✓ Invoice ${financeForm.invoice_no} berhasil dibuat dan tersimpan ke database.` })
      setFinanceForm(EMPTY_FINANCE_FORM)
    } catch (err) {
      setFinanceResult({ type: "error", message: err instanceof Error ? err.message : "Gagal membuat invoice." })
    } finally { setFinanceSubmitting(false) }
  }

  const cc = calcCC(detail, project.poValue || project.totalValue)
  const bilPct = Math.round(project.billingProgress)
  const barCls = project.status === "SELESAI" ? "pbar-green" : project.status === "TERTUNGGAK" ? "pbar-red" : "pbar-blue"

  // op vals for Cost Control section
  const contractVal   = parseNum(editPOManual) || project.poValue || project.totalValue
  const totalOpLive   = Object.keys(opVals).reduce((s, k) => s + parseNum(opVals[k]), 0)

  const netProfitLive = contractVal - totalOpLive
  const netMarginLive = contractVal > 0 ? (netProfitLive / contractVal) * 100 : 0
  const costPctLive   = contractVal > 0 ? (totalOpLive / contractVal) * 100 : 0

  // Cost Control dual-stream computed values
  const costsMain   = costs.filter(c => !c.cost_stream || c.cost_stream === "main")
  const totalMain   = costsMain.reduce((s, c) => s + Number(c.amount), 0)

  // Multi-VO: find active entry + compute totals per entry
  const activeVOEntry  = voEntries.find(e => e.id === activeStream) ?? null
  const budgetVO       = activeVOEntry?.nilai_po ?? 0
  const totalVONilai   = voEntries.reduce((s, e) => s + e.nilai_po, 0)
  const totalNilaiPO   = contractVal + totalVONilai

  // Costs for the currently-active VO stream
  const costsActiveVO  = activeVOEntry ? costs.filter(c => c.cost_stream === activeStream) : []
  const totalActiveVO  = costsActiveVO.reduce((s, c) => s + Number(c.amount), 0)

  // Per-entry totals map for the cost log summary
  const voStreamTotals = Object.fromEntries(
    voEntries.map(e => [e.id, costs.filter(c => c.cost_stream === e.id).reduce((s, c) => s + Number(c.amount), 0)])
  )

  // VO PM estimates — still tracked as scalars for the first ("vo") entry
  const totalOpVOLive   = Object.keys(opVOVals).reduce((s, k) => s + parseNum(opVOVals[k]), 0)
  const netProfitVOLive = budgetVO - totalOpVOLive
  const netMarginVOLive = budgetVO > 0 ? (netProfitVOLive / budgetVO) * 100 : 0
  const costPctVOLive   = budgetVO > 0 ? (totalOpVOLive / budgetVO) * 100 : 0

  // Active-stream vars driven by activeStream toggle
  const activeCostPct   = activeStream === "main" ? costPctLive   : costPctVOLive
  const activeNetProfit = activeStream === "main" ? netProfitLive : netProfitVOLive
  const activeNetMargin = activeStream === "main" ? netMarginLive : netMarginVOLive
  const activeTotalOp   = activeStream === "main" ? totalOpLive   : totalOpVOLive

  // ── Function 1: Burn-Rate Index (BRI) ────────────────────────────────────
  // BRI = (actual_cost / progress%) / (pm_budget / 100)
  // BRI > 1.0 → burning faster than plan; project will overrun at this pace.
  const briMain = editProg > 0 && totalOpLive > 0
    ? (totalMain * 100) / (editProg * totalOpLive) : null
  // BRI for VO: only for first entry ("vo") which has PM estimates
  const briVO = activeStream === "vo" && editProg > 0 && totalOpVOLive > 0
    ? (totalActiveVO * 100) / (editProg * totalOpVOLive) : null
  const activeBRI           = activeStream === "main" ? briMain    : briVO
  const activeActualCost    = activeStream === "main" ? totalMain  : totalActiveVO
  const activeContractVal   = activeStream === "main" ? contractVal : budgetVO
  const projectedFinalCost  = activeBRI !== null && activeTotalOp > 0
    ? activeBRI * activeTotalOp : null
  const projectedOverrun    = projectedFinalCost !== null && projectedFinalCost > activeContractVal
    ? projectedFinalCost - activeContractVal : null

  // ── Function 2: unacknowledged escalations ────────────────────────────────
  const openEscalations = escalations.filter(e => !e.acknowledged_at)

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
                {editName || project.clientName || "Proyek Baru"}
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
              { label: "Nilai Kontrak",  val: fShort(totalNilaiPO),                          cls: "text-foreground" },
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
          <button type="button" className={`mtab ${tab === "finance" ? "on" : ""}`} onClick={() => setTab("finance")}>
            <DollarSign className="h-3.5 w-3.5" /> Finance
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

              {/* ── Basic Project Info (2-col) ── */}
              <div className="grid gap-5 md:grid-cols-2 mb-0">
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
                  {/* ── Nomor PO — Anchor ID ── */}
                  <div className="rounded-xl p-3"
                    style={{ background: "color-mix(in oklch, #3b82f6 6%, transparent)", border: "2px solid color-mix(in oklch, #3b82f6 30%, transparent)" }}>
                    <label className="text-xs font-black mb-1.5 flex items-center gap-1.5" style={{ color: "#2563eb" }}>
                      <Hash className="h-3.5 w-3.5" /> Nomor PO
                      <span className="ml-auto font-normal text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: "color-mix(in oklch, #3b82f6 12%, transparent)", color: "#2563eb" }}>
                        Anchor ID
                      </span>
                    </label>
                    <input className="minput" value={editPoNumber} onChange={e => setEditPoNumber(e.target.value)}
                      placeholder="Contoh: PO/TBUP/2025/001"
                      style={{ borderColor: "color-mix(in oklch, #3b82f6 35%, transparent)", fontSize: 13, fontWeight: 600 }} />
                    <p className="text-[10px] mt-1.5" style={{ color: "color-mix(in oklch, #2563eb 70%, var(--muted-foreground))" }}>
                      ID unik penghubung antara Doc Con, Cost Control, dan Finance
                    </p>
                  </div>
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

                  {/* ── OneDrive URL ── */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Link2 className="h-3 w-3" /> Link Folder OneDrive
                    </label>
                    <input
                      className="minput"
                      value={editOneDrive}
                      onChange={e => setEditOneDrive(e.target.value)}
                      placeholder="Paste share link OneDrive proyek…"
                    />
                    {editOneDrive.trim() && (
                      <div className="mt-2">
                        <a
                          href={editOneDrive.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          📁 Buka Dokumen Pendukung (OneDrive)
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Data Kerja Tambah (VO) ── */}
              <div className="mt-6 mb-1 rounded-2xl border-2 p-4"
                style={{ borderColor: "color-mix(in oklch, #8b5cf6 30%, transparent)", background: "color-mix(in oklch, #8b5cf6 4%, transparent)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black" style={{ color: "#7c3aed" }}>
                    🔷 Data Kerja Tambah / Variation Order (VO)
                  </p>
                  <span className="text-[10px] text-muted-foreground">{voEntries.length} item</span>
                </div>

                {/* Existing VO entries list */}
                {voEntries.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {voEntries.map((entry, idx) => (
                      <div key={entry.id} className="flex items-start gap-2 p-2.5 rounded-xl border border-border bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="badge-vo">KT {idx + 1}</span>
                            <p className="text-xs font-bold text-foreground truncate">{entry.description || "—"}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono">{entry.po_number || "No PO belum diisi"}</p>
                          <p className="text-[11px] font-black text-violet-600 dark:text-violet-400 mt-0.5">{fIDR(entry.nilai_po)}</p>
                        </div>
                        <button type="button" title="Hapus KT"
                          onClick={() => setVoEntries(prev => prev.filter(e => e.id !== entry.id))}
                          className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors mt-0.5">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new VO form */}
                {showVOForm ? (
                  <div className="rounded-xl border border-border p-3 bg-card space-y-3">
                    <p className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 text-violet-500" /> Form Kerja Tambah Baru
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Nomor PO Kerja Tambah</label>
                        <input className="minput" style={{ fontSize: 12 }}
                          value={voForm.po_number}
                          onChange={e => setVoForm(f => ({ ...f, po_number: e.target.value }))}
                          placeholder="Cth: PO/TBUP/2026/VO-01" />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Nilai PO Kerja Tambah (Rp) <span className="text-destructive">*</span></label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold pointer-events-none">Rp</span>
                          <input className="minput" style={{ fontSize: 12, paddingLeft: 28 }}
                            value={voForm.nilai_po}
                            onChange={e => setVoForm(f => ({ ...f, nilai_po: e.target.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".") }))}
                            placeholder="Cth: 19.532.000" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Keterangan / Nama Kerja Tambah <span className="text-destructive">*</span></label>
                      <input className="minput" style={{ fontSize: 12 }}
                        value={voForm.description}
                        onChange={e => setVoForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Cth: Penambahan unit PAC 30kW Banjarmasin Centrum" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button"
                        disabled={!voForm.description.trim() || !voForm.nilai_po}
                        onClick={() => {
                          const isFirst = voEntries.length === 0
                          const newId = isFirst ? "vo" : `vo_${Date.now()}`
                          setVoEntries(prev => [...prev, {
                            id: newId,
                            po_number: voForm.po_number.trim(),
                            description: voForm.description.trim(),
                            nilai_po: parseNum(voForm.nilai_po),
                          }])
                          setVoForm({ po_number: "", description: "", nilai_po: "" })
                          setShowVOForm(false)
                        }}
                        className="savebtn savebtn-primary" style={{ fontSize: 12, padding: "7px 16px" }}>
                        <Plus className="h-3.5 w-3.5" /> Tambah
                      </button>
                      <button type="button"
                        onClick={() => { setShowVOForm(false); setVoForm({ po_number: "", description: "", nilai_po: "" }) }}
                        className="savebtn" style={{ fontSize: 12, padding: "7px 16px", background: "var(--muted)", color: "var(--muted-foreground)" }}>
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowVOForm(true)}
                    className="savebtn w-full justify-center text-violet-700 dark:text-violet-400"
                    style={{ fontSize: 12, padding: "8px 16px", border: "1.5px dashed color-mix(in oklch, #8b5cf6 40%, transparent)", background: "color-mix(in oklch, #8b5cf6 5%, transparent)" }}>
                    <Plus className="h-3.5 w-3.5" /> Tambah Data Kerja Tambah (VO)
                  </button>
                )}

                {voEntries.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Total Nilai VO:</span>
                    <span className="text-sm font-black font-mono" style={{ color: "#7c3aed" }}>
                      {fIDR(voEntries.reduce((s, e) => s + e.nilai_po, 0))}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Save Basic Info ── */}
              <div className="mt-6 pb-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => { setSaveError(null); save() }} disabled={saving} className="savebtn savebtn-primary">
                    {saving ? "Menyimpan…" : savedOk ? <><CheckCheck className="h-4 w-4" /> Tersimpan!</> : <><Save className="h-4 w-4" /> Simpan Info Proyek</>}
                  </button>
                  {savedOk && <span className="text-xs text-green-600 font-semibold">✓ Berhasil disimpan</span>}
                </div>
                {saveError && (
                  <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/6 px-3 py-2 text-xs text-destructive font-medium">
                    ⚠️ Gagal menyimpan: {saveError}
                  </div>
                )}
              </div>

              {/* ── Dual Sub-Tab: Log Mingguan | Jadwal & Rencana ── */}
              <div className="mt-6">
                <div className="flex gap-1 mb-5 p-1 rounded-xl border border-border w-fit" style={{ background: "color-mix(in oklch, var(--muted) 30%, transparent)" }}>
                  <button type="button" onClick={() => setDocSubTab("log")} className={`dtab ${docSubTab === "log" ? "on" : ""}`}>
                    <ClipboardList className="h-3.5 w-3.5" /> 📋 Log Mingguan
                  </button>
                  <button type="button" onClick={() => setDocSubTab("schedule")} className={`dtab ${docSubTab === "schedule" ? "on" : ""}`}>
                    <ListChecks className="h-3.5 w-3.5" /> 📅 Jadwal &amp; Rencana
                  </button>
                </div>

                {/* ────── SUB-TAB A: LOG MINGGUAN ────── */}
                {docSubTab === "log" && (
                  <div>
                    {!showAddLog ? (
                      <button type="button" onClick={() => setShowAddLog(true)}
                        className="savebtn savebtn-primary mb-5" style={{ fontSize: 12, padding: "8px 16px" }}>
                        <Plus className="h-3.5 w-3.5" /> Tambah Log Mingguan
                      </button>
                    ) : (
                      <div className="rounded-xl border border-border p-4 mb-5" style={{ background: "color-mix(in oklch, var(--muted) 15%, transparent)" }}>
                        <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                          <Plus className="h-3.5 w-3.5 text-primary" /> Form Log Mingguan Baru
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 mb-3">
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block font-semibold">Minggu ke-</label>
                            <select className="minput" title="Pilih minggu" style={{ fontSize: 12 }}
                              value={logWeek} onChange={e => setLogWeek(Number(e.target.value))}>
                              {Array.from({ length: 20 }, (_, i) => i + 1).map(w => (
                                <option key={w} value={w}>Week {w}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block font-semibold flex items-center gap-1">
                              <Camera className="h-3 w-3" /> Foto Bukti Lapangan
                            </label>
                            <input type="file" accept="image/*" title="Upload foto bukti"
                              className="minput" style={{ fontSize: 12, padding: "6px 10px" }}
                              onChange={e => setLogPhoto(e.target.files?.[0] ?? null)} />
                            {logPhoto && <p className="text-[10px] text-green-600 mt-1">✓ {logPhoto.name}</p>}
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="text-[11px] text-muted-foreground mb-1 block font-semibold">Deskripsi Aktual (apa yang sudah selesai)</label>
                          <textarea className="minput" style={{ fontSize: 12, minHeight: 80 }}
                            value={logDesc} onChange={e => setLogDesc(e.target.value)}
                            placeholder="Contoh: Done replace air filter dari 64 unit PAC. Semua filter sudah diganti dan diuji." />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" disabled={addingLog || !logDesc.trim()} onClick={addLog}
                            className="savebtn savebtn-primary" style={{ fontSize: 12, padding: "7px 16px" }}>
                            {addingLog ? "Menyimpan…" : <><Save className="h-3.5 w-3.5" /> Simpan Log</>}
                          </button>
                          <button type="button"
                            onClick={() => { setShowAddLog(false); setLogDesc(""); setLogPhoto(null); setLogWeek(1) }}
                            className="savebtn" style={{ fontSize: 12, padding: "7px 16px", background: "var(--muted)", color: "var(--muted-foreground)" }}>
                            Batal
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Log list */}
                    {docDataLoading ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">Memuat log…</p>
                    ) : weeklyLogs.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p className="text-xs">Belum ada log mingguan. Mulai tambah laporan pertama!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {weeklyLogs.map(log => (
                          <div key={log.id} className="log-card">
                            <div className="flex items-start gap-3">
                              <span className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-[11px] font-black"
                                style={{ background: "color-mix(in oklch, #3b82f6 12%, transparent)", border: "1px solid color-mix(in oklch, #3b82f6 25%, transparent)", color: "#2563eb" }}>
                                W{log.week_number}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-foreground mb-0.5">Week {log.week_number}</p>
                                <p className="text-xs text-muted-foreground leading-relaxed">{log.description}</p>
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                  {log.photo_url && (
                                    <a href={log.photo_url} target="_blank" rel="noopener noreferrer"
                                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 font-semibold">
                                      <Camera className="h-2.5 w-2.5" /> Lihat Foto
                                    </a>
                                  )}
                                  <span className="text-[10px] text-muted-foreground/50">
                                    {log.created_by ? `by ${log.created_by} · ` : ""}
                                    {new Date(log.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ────── SUB-TAB B: JADWAL & RENCANA ────── */}
                {docSubTab === "schedule" && (
                  <div>
                    {!showAddSched ? (
                      <button type="button" onClick={() => setShowAddSched(true)}
                        className="savebtn savebtn-primary mb-5" style={{ fontSize: 12, padding: "8px 16px" }}>
                        <Plus className="h-3.5 w-3.5" /> Tambah Rencana Tugas
                      </button>
                    ) : (
                      <div className="rounded-xl border border-border p-4 mb-5" style={{ background: "color-mix(in oklch, var(--muted) 15%, transparent)" }}>
                        <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                          <ListChecks className="h-3.5 w-3.5 text-primary" /> Tambah Rencana Tugas Mingguan
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 mb-3">
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block font-semibold">Minggu ke-</label>
                            <select className="minput" title="Pilih minggu" style={{ fontSize: 12 }}
                              value={schedWeek} onChange={e => setSchedWeek(Number(e.target.value))}>
                              {Array.from({ length: 20 }, (_, i) => i + 1).map(w => (
                                <option key={w} value={w}>Week {w}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block font-semibold">Bobot Progress (%)</label>
                            <input type="number" className="minput" style={{ fontSize: 12 }} min={1} max={100}
                              value={schedWeight} onChange={e => setSchedWeight(Number(e.target.value))} />
                            <p className="text-[10px] text-muted-foreground mt-0.5">Total bobot semua tugas idealnya = 100%</p>
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="text-[11px] text-muted-foreground mb-1 block font-semibold">Deskripsi Rencana Tugas</label>
                          <input className="minput" style={{ fontSize: 12 }} value={schedTask}
                            onChange={e => setSchedTask(e.target.value)}
                            placeholder="Contoh: Pengadaan material pipa tembaga PAC" />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" disabled={addingSched || !schedTask.trim()} onClick={addSchedItem}
                            className="savebtn savebtn-primary" style={{ fontSize: 12, padding: "7px 16px" }}>
                            {addingSched ? "Menambahkan…" : <><Plus className="h-3.5 w-3.5" /> Tambah</>}
                          </button>
                          <button type="button"
                            onClick={() => { setShowAddSched(false); setSchedTask(""); setSchedWeek(1); setSchedWeight(10) }}
                            className="savebtn" style={{ fontSize: 12, padding: "7px 16px", background: "var(--muted)", color: "var(--muted-foreground)" }}>
                            Batal
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Checklist */}
                    {docDataLoading ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">Memuat jadwal…</p>
                    ) : schedItems.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <ListChecks className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p className="text-xs">Belum ada rencana tugas. Tambahkan jadwal kerja mingguan!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Progress summary bar */}
                        <div className="flex items-center justify-between mb-3 p-3 rounded-xl border border-border" style={{ background: "color-mix(in oklch, var(--muted) 20%, transparent)" }}>
                          <span className="text-xs text-muted-foreground">
                            {schedItems.filter(s => s.is_done).length} / {schedItems.length} tugas selesai
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 pbar-bg">
                              <div className="pbar-fill pbar-blue" style={{ "--w": `${schedItems.length > 0 ? Math.round(schedItems.filter(s => s.is_done).length / schedItems.length * 100) : 0}%` } as React.CSSProperties} />
                            </div>
                            <span className="text-xs font-bold text-primary">
                              {schedItems.length > 0 ? Math.round(schedItems.filter(s => s.is_done).length / schedItems.length * 100) : 0}%
                            </span>
                          </div>
                        </div>
                        {schedItems.map(item => (
                          <div key={item.id} className={`sched-row ${item.is_done ? "done" : ""}`}>
                            <button
                              type="button"
                              title={item.is_done ? "Tandai belum selesai" : "Tandai selesai"}
                              aria-label={item.is_done ? "Tandai belum selesai" : "Tandai selesai"}
                              onClick={() => toggleSchedItem(item.id, !item.is_done)}
                              className="shrink-0 mt-0.5 h-5 w-5 rounded flex items-center justify-center border transition-all"
                              style={{
                                background: item.is_done ? "var(--primary)" : "transparent",
                                borderColor: item.is_done ? "var(--primary)" : "var(--muted-foreground)",
                              }}
                            >
                              {item.is_done && <CheckCheck className="h-3 w-3" style={{ color: "var(--primary-foreground)" }} />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: "color-mix(in oklch, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
                                  Week {item.week_number}
                                </span>
                                <span className={`text-xs font-medium ${item.is_done ? "line-through text-muted-foreground/50" : "text-foreground"}`}>
                                  {item.task_description}
                                </span>
                              </div>
                              {item.is_done && item.completed_at && (
                                <p className="text-[10px] text-green-600 mt-0.5">
                                  ✓ Selesai {new Date(item.completed_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground/60 font-mono">{item.progress_weight}%</span>
                              <button type="button" title="Hapus tugas" aria-label="Hapus tugas"
                                onClick={() => delSchedItem(item.id)}
                                className="text-muted-foreground/30 hover:text-destructive transition-colors">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
                  { label: "Nilai PO / Kontrak", val: fIDR(totalNilaiPO),      cls: "text-foreground font-black" },
                  { label: "Total Invoice",       val: fIDR(project.totalValue),cls: "text-foreground font-semibold" },
                  { label: "Sudah Terbayar",      val: fIDR(project.totalPaid), cls: "text-green-600 font-semibold" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">{s.label}</p>
                    <p className={`text-sm font-mono ${s.cls}`}>{s.val}</p>
                  </div>
                ))}
              </div>

              {/* ── Escalation warning toast (baru ditrigger) ── */}
              {escalationWarning && (
                <div className="mb-4 p-4 rounded-2xl border border-destructive/40 bg-destructive/8 flex items-start gap-3">
                  <span className="text-xl shrink-0">🚨</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-destructive mb-0.5">
                      {escalationWarning === "vo_budget_exceeded" ? "Budget VO Terlampaui!" : "Peringatan: Budget VO Hampir Habis (80%)"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {escalationWarning === "vo_budget_exceeded"
                        ? "Biaya Kerja Tambah aktual sudah melebihi budget VO yang disetujui. Diperlukan persetujuan Owner sebelum menambah biaya lebih lanjut."
                        : "Biaya Kerja Tambah aktual sudah mencapai 80% dari budget VO. Segera review bersama Owner."
                      }
                    </p>
                  </div>
                  <button type="button" onClick={() => setEscalationWarning(null)}
                    className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-border hover:border-destructive/40 transition-colors">
                    OK
                  </button>
                </div>
              )}

              {/* ── Open escalation banners (dari DB, belum di-acknowledge) ── */}
              {openEscalations.map(esc => (
                <div key={esc.id} className="mb-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/8 flex items-start gap-3">
                  <span className="text-base shrink-0">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-0.5">
                      {esc.escalation_type === "vo_budget_exceeded" ? "Budget VO Terlampaui" : "VO Hampir Habis (≥80%)"}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{esc.notes}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(esc.triggered_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => acknowledgeEscalation(esc.id)}
                    className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 transition-colors border border-amber-500/25">
                    Acknowledge
                  </button>
                </div>
              ))}

              {/* ── BRI Alert (Burn-Rate Index) ── */}
              {activeBRI !== null && activeBRI > 1.0 && activeActualCost > 0 && (
                <div className={`mb-4 p-4 rounded-2xl border flex items-start gap-3 ${
                  activeBRI > 1.2
                    ? "bg-destructive/8 border-destructive/30"
                    : "bg-amber-500/8 border-amber-500/25"
                }`}>
                  <span className="text-xl shrink-0">{activeBRI > 1.2 ? "🔴" : "🟡"}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-black mb-0.5 ${activeBRI > 1.2 ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>
                      {activeBRI > 1.2 ? "BAHAYA: Trajetori Jebol Budget" : "WASPADA: Burn Rate Tinggi"}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Biaya aktual {activeStream === "main" ? "PO Utama" : (activeVOEntry?.description || "Kerja Tambah")} berjalan{" "}
                      <span className="font-bold text-foreground">{((activeBRI - 1) * 100).toFixed(0)}% lebih cepat</span>{" "}
                      dari estimasi PM (progress {editProg}%).
                      {projectedFinalCost !== null && (
                        <> Proyeksi biaya akhir: <span className="font-bold text-foreground">{fIDR(projectedFinalCost)}</span>
                        {projectedOverrun !== null && (
                          <span className="text-destructive font-bold"> (+{fIDR(projectedOverrun)} overrun)</span>
                        )}</>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* ROI + Input two-column */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* ROI Gauge */}
                <div className="rounded-2xl border border-border bg-muted/10 p-5">
                  <p className="text-sm font-bold text-foreground mb-1">
                    ROI Overview —{" "}
                    <span className={activeStream === "main" ? "text-amber-500" : "text-violet-500"}>
                      {activeStream === "main" ? "PO Utama" : (activeVOEntry?.description || "Kerja Tambah")}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mb-3">Berdasarkan estimasi biaya operasional PM</p>
                  <ROIGauge costPct={activeCostPct} />
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {/* NET PROFIT */}
                    <div className="text-center p-2.5 rounded-xl border border-border bg-card">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">NET PROFIT</p>
                      <p className={`text-base font-black font-mono ${activeTotalOp > 0 ? (activeNetProfit >= 0 ? "text-green-600" : "text-destructive") : "text-muted-foreground"}`}>
                        {activeTotalOp > 0 ? fShort(activeNetProfit) : "—"}
                      </p>
                    </div>
                    {/* NET MARGIN */}
                    <div className="text-center p-2.5 rounded-xl border border-border bg-card">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">NET MARGIN</p>
                      <p className={`text-base font-black font-mono ${activeTotalOp > 0 ? (activeNetMargin >= 0 ? "text-green-600" : "text-destructive") : "text-muted-foreground"}`}>
                        {activeTotalOp > 0 ? `${activeNetMargin.toFixed(1)}%` : "—"}
                      </p>
                    </div>
                    {/* MARGIN SAFETY LEVEL */}
                    <div className="text-center p-2.5 rounded-xl border border-border bg-card flex flex-col items-center justify-center">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">SAFETY</p>
                      {activeTotalOp > 0 ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black ${
                            activeNetMargin > 25  ? "bg-green-500/15 text-green-700 dark:text-green-400"
                            : activeNetMargin >= 10 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-destructive/12 text-destructive"
                          }`}>
                            {activeNetMargin > 25 ? "AMAN" : activeNetMargin >= 10 ? "WASPADA" : "BAHAYA"}
                          </span>
                          <span className={`text-[8px] font-semibold ${
                            activeNetMargin > 25  ? "text-green-600"
                            : activeNetMargin >= 10 ? "text-amber-500"
                            : "text-destructive"
                          }`}>
                            {activeNetMargin > 25 ? "Low Risk" : activeNetMargin >= 10 ? "Mid Risk" : "High Risk"}
                          </span>
                        </div>
                      ) : (
                        <p className="text-base font-black font-mono text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Op Cost Input */}
                <div className="rounded-2xl border border-border bg-muted/10 p-5">
                  <p className="text-sm font-bold text-foreground mb-1">Input Biaya Operasional</p>
                  <p className="text-[11px] text-muted-foreground mb-3">Estimasi biaya PM per stream untuk hitung ROI</p>

                  {/* Stream toggle for OP budget — dynamic per voEntries */}
                  <div className="cc-seg mb-4 flex-wrap gap-1">
                    <button type="button"
                      className={`cc-seg-btn ${activeStream === "main" ? "on stream-main" : ""}`}
                      onClick={() => setActiveStream("main")}>
                      🔶 PO Utama
                    </button>
                    {voEntries.map((entry, idx) => (
                      <button key={entry.id} type="button"
                        className={`cc-seg-btn ${activeStream === entry.id ? "on stream-vo" : ""}`}
                        onClick={() => setActiveStream(entry.id)}>
                        🔷 KT {idx + 1}
                      </button>
                    ))}
                  </div>

                  {activeStream === "main" ? (
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
                                const fmt = e.target.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
                                setOpVals(p => ({ ...p, [f.key]: fmt }))
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activeVOEntry ? (
                    <div>
                      {/* Nilai PO Kontrak for this VO — read-only, set from Doc Con */}
                      <div className="mb-3 p-2.5 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5">
                          <span className="badge-vo">VO</span> Nilai Kontrak Kerja Tambah
                        </span>
                        <span className="text-sm font-black font-mono text-foreground">{fIDR(activeVOEntry.nilai_po)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-3">Ubah nilai kontrak di tab <strong>Doc Con → Data Kerja Tambah</strong></p>
                      {/* OP estimates only available for first VO ("vo") */}
                      {activeVOEntry.id === "vo" ? (
                        <div className="grid grid-cols-2 gap-3">
                          {OP_FIELDS.map(f => (
                            <div key={f.voKey}>
                              <label className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                                <span>{f.icon}</span> {f.label}
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none font-semibold">Rp</span>
                                <input className="minput" style={{ fontSize: 12, paddingLeft: 28, paddingTop: 7, paddingBottom: 7 }}
                                  value={opVOVals[f.voKey]}
                                  placeholder={`Cth: ${(f.ex / 1_000_000).toFixed(0)}Jt`}
                                  onChange={e => {
                                    const fmt = e.target.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
                                    setOpVOVals(p => ({ ...p, [f.voKey]: fmt }))
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground py-3 text-center rounded-xl border border-border bg-muted/10">
                          Estimasi biaya PM (ROI) belum tersedia untuk Kerja Tambah tambahan — hanya log biaya aktual yang dicatat.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground py-3 text-center">
                      Tambah Kerja Tambah di tab Doc Con terlebih dahulu.
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-3">* Klik Simpan untuk menyimpan data cost control</p>
                </div>
              </div>

              {/* Actual cost log — dual stream */}
              <div className="mt-6">
                <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" /> Log Biaya Aktual
                </p>

                {/* Segmented stream control — dynamic per voEntries */}
                <div className="cc-seg mb-4 flex-wrap gap-1">
                  <button type="button"
                    className={`cc-seg-btn ${activeStream === "main" ? "on stream-main" : ""}`}
                    onClick={() => setActiveStream("main")}>
                    🔶 Log PO Utama
                  </button>
                  {voEntries.map((entry, idx) => (
                    <button key={entry.id} type="button"
                      className={`cc-seg-btn ${activeStream === entry.id ? "on stream-vo" : ""}`}
                      onClick={() => setActiveStream(entry.id)}>
                      🔷 KT {idx + 1}{entry.description ? ` — ${entry.description.slice(0, 12)}${entry.description.length > 12 ? "…" : ""}` : ""}
                    </button>
                  ))}
                </div>

                {/* Budget check panel — Budget PM = sum of OP fields (not contract value) */}
                {activeStream === "main" ? (
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs mb-4 p-3 rounded-xl"
                    style={{ background: "color-mix(in oklch, #f97316 5%, transparent)", border: "1.5px solid color-mix(in oklch, #f97316 20%, transparent)" }}>
                    <span className="badge-main">PO Utama</span>
                    <span className="text-muted-foreground">
                      Budget PM: <span className="font-bold text-foreground">{totalOpLive > 0 ? fIDR(totalOpLive) : "—"}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Terpakai: <span className="font-bold" style={{ color: "#ea580c" }}>{fIDR(totalMain)}</span>
                    </span>
                    {totalOpLive > 0 && (
                      <span className={`font-bold ml-auto ${totalOpLive - totalMain < 0 ? "text-destructive" : "text-green-600"}`}>
                        Sisa: {fIDR(totalOpLive - totalMain)}{totalOpLive - totalMain < 0 ? " ⚠️" : ""}
                      </span>
                    )}
                  </div>
                ) : activeVOEntry ? (() => {
                  const voIdx = voEntries.findIndex(e => e.id === activeStream)
                  const label = activeVOEntry.description || `Kerja Tambah ${voIdx + 1}`
                  const hasEstimate = activeVOEntry.id === "vo" && totalOpVOLive > 0
                  return (
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs mb-4 p-3 rounded-xl"
                      style={{ background: "color-mix(in oklch, #8b5cf6 5%, transparent)", border: "1.5px solid color-mix(in oklch, #8b5cf6 20%, transparent)" }}>
                      <span className="badge-vo">{label}</span>
                      {hasEstimate ? (
                        <>
                          <span className="text-muted-foreground">Budget PM: <span className="font-bold text-foreground">{fIDR(totalOpVOLive)}</span></span>
                          <span className="text-muted-foreground">Terpakai: <span className="font-bold" style={{ color: "#7c3aed" }}>{fIDR(totalActiveVO)}</span></span>
                          <span className={`font-bold ml-auto ${totalOpVOLive - totalActiveVO < 0 ? "text-destructive" : "text-green-600"}`}>
                            Sisa: {fIDR(totalOpVOLive - totalActiveVO)}{totalOpVOLive - totalActiveVO < 0 ? " ⚠️" : ""}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground">Nilai Kontrak: <span className="font-bold text-foreground">{fIDR(activeVOEntry.nilai_po)}</span></span>
                          <span className="text-muted-foreground">Terpakai: <span className="font-bold" style={{ color: "#7c3aed" }}>{fIDR(totalActiveVO)}</span></span>
                          <span className={`font-bold ml-auto ${activeVOEntry.nilai_po > 0 ? (activeVOEntry.nilai_po - totalActiveVO < 0 ? "text-destructive" : "text-green-600") : "text-muted-foreground"}`}>
                            {activeVOEntry.nilai_po > 0 ? `Sisa: ${fIDR(activeVOEntry.nilai_po - totalActiveVO)}` : "Estimasi PM belum diisi"}
                          </span>
                        </>
                      )}
                    </div>
                  )
                })() : null}

                {/* Form: Tambah Biaya Aktual */}
                <div className="rounded-xl border bg-muted/15 p-4 mb-4"
                  style={{ borderColor: activeStream === "vo" ? "color-mix(in oklch, #8b5cf6 25%, var(--border))" : "color-mix(in oklch, #f97316 20%, var(--border))" }}>
                  <p className="text-xs font-semibold mb-3 flex items-center gap-2">
                    <span className={activeStream === "main" ? "badge-main" : "badge-vo"}>
                      {activeStream === "main" ? "PO Utama" : (() => { const e = voEntries.find(x => x.id === activeStream); const i = voEntries.findIndex(x => x.id === activeStream); return e ? `KT ${i + 1}${e.description ? ` — ${e.description.slice(0, 14)}` : ""}` : "Kerja Tambah" })()}
                    </span>
                    Tambah Biaya Aktual
                  </p>
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

                {/* Cost list with stream badges */}
                {costs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Belum ada biaya aktual tercatat</p>
                ) : (
                  <>
                    {costs.map(c => (
                      <div key={c.id} className="inv-row flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={(!c.cost_stream || c.cost_stream === "main") ? "badge-main" : "badge-vo"}>
                              {(!c.cost_stream || c.cost_stream === "main") ? "PO Utama" : (() => { const idx = voEntries.findIndex(e => e.id === c.cost_stream); const entry = voEntries[idx]; return entry ? `KT ${idx + 1}${entry.description ? ` — ${entry.description.slice(0, 12)}` : ""}` : "Kerja Tambah" })()}
                            </span>
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
                    {/* Split totals per stream */}
                    <div className="mt-3 p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                      {totalMain > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                            <span className="badge-main">PO Utama</span> Total
                          </span>
                          <span className="text-sm font-bold font-mono" style={{ color: "#ea580c" }}>{fIDR(totalMain)}</span>
                        </div>
                      )}
                      {voEntries.map((entry, idx) => {
                        const t = voStreamTotals[entry.id] ?? 0
                        if (t <= 0) return null
                        return (
                          <div key={entry.id} className="flex justify-between items-center">
                            <span className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                              <span className="badge-vo">KT {idx + 1}</span>
                              <span className="truncate max-w-[120px]">{entry.description || `Kerja Tambah ${idx + 1}`}</span>
                            </span>
                            <span className="text-sm font-bold font-mono" style={{ color: "#7c3aed" }}>{fIDR(t)}</span>
                          </div>
                        )
                      })}
                      <div className="flex justify-between items-center pt-1.5 border-t border-border/60">
                        <span className="text-xs font-semibold text-muted-foreground">Grand Total Biaya Aktual</span>
                        <span className="text-sm font-black font-mono text-destructive">{fIDR(costs.reduce((s, c) => s + Number(c.amount), 0))}</span>
                      </div>
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

          ) : (() => {
            /* ═══ FINANCE — INPUT INVOICE ═══ */
            const finDpp   = Number(financeForm.dpp)           || 0
            const finTotal = Number(financeForm.total)         || 0
            const finPaid  = Number(financeForm.payment_value) || 0

            // Billing lock: both conditions must be true to enable submit
            const canSubmit  = editProg >= 100 && !!editOneDrive.trim()
            const lockReason = editProg < 100 && !editOneDrive.trim()
              ? `Progress fisik ${editProg}% (butuh 100%) dan OneDrive link belum diisi`
              : editProg < 100
              ? `Progress fisik ${editProg}% — butuh 100% sebelum Finance bisa generate invoice`
              : "OneDrive link Doc Con belum diisi — wajib ada sebelum invoice digenerate"

            return (
              <div className="p-7">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-4 div-badge-fin">
                  <span className="h-2 w-2 rounded-full bg-green-500" /> Divisi Finance — Input Invoice Baru
                </span>

                {/* Billing Lock Banner */}
                {!canSubmit && (
                  <div className="billing-lock-banner flex items-start gap-2.5">
                    <span className="text-lg shrink-0">🔒</span>
                    <div>
                      <p className="text-xs font-bold text-destructive mb-0.5">Invoice terkunci — syarat belum terpenuhi</p>
                      <p className="text-[11px] text-muted-foreground">{lockReason}</p>
                    </div>
                  </div>
                )}

                {/* Result Banner */}
                {financeResult && (
                  <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-xs font-medium mb-4 ${
                    financeResult.type === "success"
                      ? "border-green-500/25 bg-green-500/8 text-green-700 dark:text-green-400"
                      : "border-destructive/25 bg-destructive/6 text-destructive"
                  }`}>
                    {financeResult.message}
                  </div>
                )}

                <div className="grid gap-5 xl:grid-cols-[1fr_260px]">

                  {/* ── LEFT: Form Sections ── */}
                  <div>

                    {/* Section 1: Identitas Invoice */}
                    <div className="fin-section">
                      <div className="fin-section-lbl">📄 Identitas Invoice</div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">No. Invoice <span className="text-destructive">*</span></label>
                          <input className="minput" style={{ fontSize: 12 }} placeholder="INV/2025/001"
                            value={financeForm.invoice_no} onChange={e => setF("invoice_no", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Tanggal Invoice <span className="text-destructive">*</span></label>
                          <input type="date" className="minput" title="Tanggal Invoice" style={{ fontSize: 12 }}
                            value={financeForm.date} onChange={e => setF("date", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Tanggal Kirim Invoice</label>
                          <input type="date" className="minput" title="Tanggal Kirim Invoice" style={{ fontSize: 12 }}
                            value={financeForm.invoice_sent_date} onChange={e => setF("invoice_sent_date", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Tipe Proyek</label>
                          <select className="minput" title="Tipe Proyek" style={{ fontSize: 12 }}
                            value={financeForm.project_type} onChange={e => setF("project_type", e.target.value)}>
                            <option value="">— Pilih Tipe —</option>
                            <option value="Maintenance">🔧 Maintenance</option>
                            <option value="Material/PAC">📦 Material / PAC</option>
                            <option value="Project/Instalasi">🏗️ Project / Instalasi</option>
                            <option value="Jasa">⚙️ Jasa</option>
                            <option value="Lainnya">📋 Lainnya</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Terms of Payment</label>
                          <select className="minput" title="Terms of Payment" style={{ fontSize: 12 }}
                            value={financeForm.terms_of_payment} onChange={e => setF("terms_of_payment", e.target.value)}>
                            <option value="">— Pilih TOP —</option>
                            <option value="15">15 hari</option>
                            <option value="30">30 hari</option>
                            <option value="45">45 hari</option>
                            <option value="60">60 hari</option>
                            <option value="90">90 hari</option>
                            <option value="120">120 hari</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Tipe Pajak</label>
                          <select className="minput" title="Tipe Pajak" style={{ fontSize: 12 }}
                            value={financeForm.tax_type} onChange={e => setF("tax_type", e.target.value as "PPN" | "NON_PPN")}>
                            <option value="PPN">PPN (11%)</option>
                            <option value="NON_PPN">Non PPN</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Customer */}
                    <div className="fin-section">
                      <div className="fin-section-lbl">👤 Customer &amp; Deskripsi</div>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mb-3 flex items-center gap-1">
                        ℹ️ Isi Nama Customer dengan nama resmi/legal entity untuk penagihan. Gunakan referensi Doc Con di bawah sebagai panduan.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 mb-3">
                        <div className="relative">
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Nama Customer (Legal) <span className="text-destructive">*</span></label>
                          <input className="minput" style={{ fontSize: 12 }} placeholder="PT / CV / Nama Perusahaan Resmi"
                            value={financeForm.customer} autoComplete="off"
                            onChange={e => { setF("customer", e.target.value); setFinanceShowSugg(true) }}
                            onFocus={() => setFinanceShowSugg(true)}
                            onBlur={() => setTimeout(() => setFinanceShowSugg(false), 150)} />
                          {financeSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 rounded-lg border border-border shadow-lg mt-1 max-h-40 overflow-y-auto"
                              style={{ background: "var(--popover)" }}>
                              {financeSuggestions.map(c => (
                                <div key={c} className="px-3 py-2 text-xs cursor-pointer hover:bg-primary/8 border-b border-border/50 last:border-0"
                                  onMouseDown={() => { setF("customer", c); setFinanceShowSugg(false) }}>
                                  {c}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Nama Site / Lokasi (Resmi)</label>
                          <input className="minput" style={{ fontSize: 12 }} placeholder="Contoh: Data Center Cikarang Phase 1"
                            value={financeForm.site_name} onChange={e => setF("site_name", e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Deskripsi Pekerjaan <span className="text-destructive">*</span></label>
                        <textarea className="minput" style={{ fontSize: 12, minHeight: 72 }}
                          placeholder="Tuliskan deskripsi pekerjaan atau layanan yang ditagihkan..."
                          value={financeForm.description} onChange={e => setF("description", e.target.value)} />
                      </div>
                    </div>

                    {/* Section 3: PO & Nilai */}
                    <div className="fin-section">
                      <div className="fin-section-lbl">📋 PO &amp; Nilai Invoice</div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">No. PO</label>
                          <input className="minput" style={{ fontSize: 12 }} placeholder="PO-2025-XXX"
                            value={financeForm.po_number} onChange={e => setF("po_number", e.target.value)} />
                          {/* PO Reference Panel — shown once Finance types a PO number */}
                          {financeForm.po_number.trim() && (() => {
                            const typed = financeForm.po_number.trim().toLowerCase()
                            const mainMatch = editPoNumber.trim() ? typed === editPoNumber.trim().toLowerCase() : null
                            const voMatch   = voEntries.find(e => e.po_number.trim().toLowerCase() === typed)
                            const voMatchIdx = voMatch ? voEntries.indexOf(voMatch) : -1
                            return (
                              <div className="po-ref-panel">
                                <p className="text-[10px] font-black text-blue-700 dark:text-blue-400 mb-1.5 uppercase tracking-wide">📋 Referensi Data Doc Con</p>
                                <div className="space-y-1">
                                  {/* PO Utama */}
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">PO Utama (Doc Con):</span>
                                    <span className="flex items-center gap-1.5">
                                      <span className="font-bold text-foreground font-mono">{editPoNumber || "—"}</span>
                                      {mainMatch === true  && <span className="text-[10px] font-bold text-green-600">✓ Cocok</span>}
                                      {mainMatch === false && <span className="text-[10px] font-bold text-amber-500">≠ Beda</span>}
                                    </span>
                                  </div>
                                  {/* VO entries match */}
                                  {voEntries.map((entry, idx) => {
                                    const match = entry.po_number.trim() ? typed === entry.po_number.trim().toLowerCase() : null
                                    return (
                                      <div key={entry.id} className="flex justify-between text-[11px]">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                          <span className="badge-vo" style={{ fontSize: 9, padding: "1px 5px" }}>KT {idx+1}</span>
                                          {entry.description.slice(0, 18)}{entry.description.length > 18 ? "…" : ""}:
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                          <span className="font-bold text-foreground font-mono">{entry.po_number || "—"}</span>
                                          {match === true  && <span className="text-[10px] font-bold text-green-600">✓ Cocok</span>}
                                        </span>
                                      </div>
                                    )
                                  })}
                                  <div className="flex justify-between text-[11px] pt-1 border-t border-border/40">
                                    <span className="text-muted-foreground">Site Lapangan:</span>
                                    <span className="font-semibold text-foreground">{editSite || "—"}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">Progress Fisik:</span>
                                    <span className={`font-bold ${editProg >= 100 ? "text-green-600" : "text-amber-500"}`}>{editProg}%</span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">Nilai PO Utama:</span>
                                    <span className="font-semibold text-foreground">{fIDR(parseNum(editPOManual) || project.poValue || 0)}</span>
                                  </div>
                                  {voMatch && (
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-muted-foreground">Nilai KT {voMatchIdx+1}:</span>
                                      <span className="font-semibold text-violet-600 dark:text-violet-400">{fIDR(voMatch.nilai_po)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">OneDrive:</span>
                                    <span className={`font-bold ${editOneDrive ? "text-green-600" : "text-destructive"}`}>
                                      {editOneDrive ? "✓ Ada" : "✗ Belum diisi"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Tanggal PO</label>
                          <input type="date" className="minput" title="Tanggal PO" style={{ fontSize: 12 }}
                            value={financeForm.po_date} onChange={e => setF("po_date", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Nilai PO (Rp)</label>
                          <input type="number" className="minput" style={{ fontSize: 12 }} placeholder="0"
                            value={financeForm.po_value} onChange={e => setF("po_value", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">DPP (Rp) <span className="text-[10px] font-normal">→ PPN &amp; Total auto-hitung</span></label>
                          <input type="number" className="minput" style={{ fontSize: 12 }} placeholder="0"
                            value={financeForm.dpp} onChange={e => setF("dpp", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">PPN {financeForm.tax_type === "PPN" ? "(11%)" : "(0%)"}</label>
                          <input type="number" className={`minput ${finDpp > 0 ? "border-primary/30" : ""}`} style={{ fontSize: 12 }} placeholder="0"
                            value={financeForm.ppn} onChange={e => setF("ppn", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Total Invoice (Rp)</label>
                          <input type="number" className={`minput ${finDpp > 0 ? "border-primary/30" : ""}`} style={{ fontSize: 12 }} placeholder="0"
                            value={financeForm.total} onChange={e => setF("total", e.target.value)} />
                        </div>
                      </div>
                      {finDpp > 0 && (
                        <div className="mt-3 rounded-xl bg-muted/30 border border-border p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Ringkasan Nilai</p>
                          {[
                            { l: "DPP", v: fIDR(finDpp) },
                            { l: `PPN (${financeForm.tax_type === "PPN" ? "11%" : "0%"})`, v: fIDR(Number(financeForm.ppn) || 0) },
                            { l: "Total", v: fIDR(finTotal), bold: true },
                          ].map(r => (
                            <div key={r.l} className="flex justify-between text-xs py-1 border-b border-border/40 last:border-0">
                              <span className="text-muted-foreground">{r.l}</span>
                              <span className={`font-mono ${r.bold ? "font-black text-primary text-sm" : "font-semibold"}`}>{r.v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Section 4: Pembayaran */}
                    <div className="fin-section">
                      <div className="fin-section-lbl">💳 Pembayaran</div>
                      <div className="grid gap-3 sm:grid-cols-2 mb-3">
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Nilai Pembayaran (Rp)</label>
                          <input type="number" className="minput" style={{ fontSize: 12 }} placeholder="0"
                            value={financeForm.payment_value} onChange={e => setF("payment_value", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Tanggal Pembayaran</label>
                          <input type="date" className="minput" title="Tanggal Pembayaran" style={{ fontSize: 12 }}
                            value={financeForm.payment_date} onChange={e => setF("payment_date", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Selisih / Variance (Rp)</label>
                          <input type="number" className={`minput ${finPaid > 0 && finTotal > 0 ? "border-primary/30" : ""}`} style={{ fontSize: 12 }} placeholder="0"
                            value={financeForm.selisih} onChange={e => setF("selisih", e.target.value)} />
                          {finPaid > 0 && finTotal > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">Auto: Total − Pembayaran</p>}
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Status Invoice</label>
                          <div className="flex gap-2">
                            <button type="button" className={`stat-opt ${financeForm.status === "PAID" ? "paid" : "inact"}`}
                              onClick={() => setF("status", "PAID")}>✓ LUNAS</button>
                            <button type="button" className={`stat-opt ${financeForm.status === "UNPAID" ? "unpaid" : "inact"}`}
                              onClick={() => setF("status", "UNPAID")}>⏳ BELUM BAYAR</button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Keterangan (opsional)</label>
                        <textarea className="minput" style={{ fontSize: 12, minHeight: 60 }}
                          placeholder="Catatan tambahan…"
                          value={financeForm.keterangan} onChange={e => setF("keterangan", e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* ── RIGHT: Preview + Action ── */}
                  <div>
                    <div className="sticky top-4 rounded-2xl border border-border p-4 space-y-3" style={{ background: "color-mix(in oklch, var(--muted) 20%, transparent)" }}>
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-primary" /> Preview Invoice
                      </p>
                      {[
                        { l: "Invoice No",  v: financeForm.invoice_no || "—",  c: financeForm.invoice_no ? "text-foreground" : "text-muted-foreground/50" },
                        { l: "Customer",    v: financeForm.customer || "—",    c: financeForm.customer ? "text-foreground" : "text-muted-foreground/50" },
                        { l: "Tanggal",     v: financeForm.date ? new Date(financeForm.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—", c: financeForm.date ? "text-foreground" : "text-muted-foreground/50" },
                        { l: "Total",       v: finTotal ? fIDR(finTotal) : "—", c: finTotal ? "text-primary font-black" : "text-muted-foreground/50" },
                        { l: "Status",      v: financeForm.status === "PAID" ? "✓ LUNAS" : "⏳ BELUM BAYAR", c: financeForm.status === "PAID" ? "text-green-600 font-bold" : "text-destructive font-bold" },
                      ].map(r => (
                        <div key={r.l} className="flex justify-between text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0">
                          <span className="text-muted-foreground">{r.l}</span>
                          <span className={`font-mono text-right max-w-[120px] truncate ${r.c}`}>{r.v}</span>
                        </div>
                      ))}

                      <div className="pt-2 space-y-2">
                        {/* Submit / Locked Button */}
                        <button
                          type="button"
                          onClick={canSubmit ? submitFinanceInvoice : undefined}
                          disabled={!canSubmit || financeSubmitting}
                          className="savebtn w-full justify-center"
                          style={{
                            background: canSubmit ? "var(--primary)" : "var(--muted)",
                            color: canSubmit ? "var(--primary-foreground)" : "var(--muted-foreground)",
                            opacity: canSubmit ? 1 : 0.7,
                            cursor: canSubmit ? "pointer" : "not-allowed",
                            fontSize: 13, padding: "10px 16px",
                          }}
                        >
                          {financeSubmitting ? (
                            <><span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> Menyimpan…</>
                          ) : canSubmit ? (
                            <><Plus className="h-4 w-4" /> Generate Invoice</>
                          ) : (
                            <>🔒 Terkunci — Syarat Belum Terpenuhi</>
                          )}
                        </button>

                        {/* Lock explanation below button */}
                        {!canSubmit && (
                          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                            {editProg < 100 && <span className="block">⚠ Progress {editProg}% (butuh 100%)</span>}
                            {!editOneDrive.trim() && <span className="block">⚠ OneDrive link belum diisi</span>}
                          </p>
                        )}

                        {/* Reset Form */}
                        <button type="button" onClick={() => { setFinanceForm(EMPTY_FINANCE_FORM); setFinanceResult(null) }}
                          className="savebtn w-full justify-center" style={{ background: "var(--muted)", color: "var(--muted-foreground)", fontSize: 12, padding: "8px 16px" }}>
                          <RotateCcw className="h-3.5 w-3.5" /> Reset Form
                        </button>
                      </div>

                      {/* Helper */}
                      <div className="pt-1 border-t border-border/50 space-y-1.5 text-[10px] text-muted-foreground">
                        <p className="flex gap-1.5"><span className="text-destructive font-bold">*</span> Field merah wajib diisi</p>
                        <p className="flex gap-1.5"><span className="text-primary">→</span> Isi DPP — PPN &amp; Total otomatis terhitung</p>
                        <p className="flex gap-1.5"><span className="text-primary">→</span> Invoice tersimpan &amp; langsung tampil di semua halaman</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )
          })()}
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
              <p className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Cost Ratio</p>
              <p className={`text-[11px] font-black ${cc.costPct <= 80 ? "text-green-600" : cc.costPct <= 100 ? "text-amber-500" : "text-destructive"}`}>{cc.costPct.toFixed(0)}%</p>
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
  const [detailMap,    setDetailMap]    = React.useState<Map<string, ProjectDetail>>(new Map())
  const [search,       setSearch]       = React.useState("")
  const [filterStatus, setFilterStatus] = React.useState("Semua")
  const [filterCat,    setFilterCat]    = React.useState("Semua")
  const [selected,     setSelected]     = React.useState<Project | null>(null)
  const [createProject, setCreateProject] = React.useState<Project | null>(null)

  const combinedProjects = React.useMemo(() => {
    const result = [...allProjects]
    for (const det of detailMap.values()) {
      const isManual = det.created_manually === true || det.project_key?.startsWith("MANUAL::")
      if (isManual && !result.find(p => p.id === det.project_key)) {
        result.push(buildManualProject(det))
      }
    }
    return result
  }, [allProjects, detailMap])

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
    total:      combinedProjects.length,
    selesai:    combinedProjects.filter(p => p.status === "SELESAI").length,
    berjalan:   combinedProjects.filter(p => p.status === "BERJALAN").length,
    tertunggak: combinedProjects.filter(p => p.status === "TERTUNGGAK").length,
    totalValue: combinedProjects.reduce((s, p) => s + p.totalValue, 0),
    totalOut:   combinedProjects.reduce((s, p) => s + p.totalOutstanding, 0),
  }), [combinedProjects])

  const displayed = React.useMemo(() => {
    let list = [...combinedProjects]
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
  }, [combinedProjects, search, filterStatus, filterCat])

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
                  {combinedProjects.length} proyek · {raw.length} invoice · {periodLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button"
                onClick={() => {
                  const key = `MANUAL::${Date.now()}`
                  setSelected(null)
                  setCreateProject({
                    id: key, clientName: "", clientFull: "", location: "", category: "Jasa",
                    invoices: [], totalValue: 0, totalPaid: 0, totalOutstanding: 0,
                    billingProgress: 0, status: "BERJALAN",
                    firstDate: new Date().toISOString().slice(0, 10),
                    lastDate:  new Date().toISOString().slice(0, 10),
                    invoiceCount: 0, paidCount: 0, unpaidCount: 0, termins: [], poValue: 0,
                  })
                }}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all bg-primary text-primary-foreground border-primary hover:opacity-85 shadow-sm">
                <Plus className="h-3.5 w-3.5" /> Buat Proyek Baru
              </button>
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

        {/* Create New Project Modal */}
        {createProject && (
          <DetailModal
            project={createProject}
            initDetail={null}
            onClose={() => setCreateProject(null)}
            onDetailSaved={handleDetailSaved}
          />
        )}

      </SidebarInset>
    </SidebarProvider>
  )
}
