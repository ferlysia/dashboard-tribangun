"use client"

import * as React from "react"
import {
  FolderKanban, Search, CircleDot, CheckCircle2, AlertTriangle,
  CalendarDays, Receipt, Package, Wrench, Briefcase, X, Filter,
  Hash, Pencil, Plus, Trash2, TrendingUp, DollarSign,
  MapPin, ChevronRight, FileText, BarChart3, Users,
  Building2, ClipboardList, Save, CheckCheck,
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
  display_name: string
  physical_progress: number
  notes: string
  site_location: string
  description: string
  po_value_manual: number
  op_gaji: number
  op_material: number
  op_transport: number
  op_operasional: number
  op_sewa: number
  op_lainnya: number
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

function parseNum(s: string) { return Number(s.replace(/[^\d]/g, "")) || 0 }
function fNum(n: number) { return n > 0 ? n.toLocaleString("id-ID") : "" }

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
  // costPct = totalCosts / contractVal * 100, range 0–200
  const clamped = Math.min(200, Math.max(0, costPct))
  // angle: 0% -> -180deg (left end), 200% -> 0deg (right end)
  const angleDeg = (clamped / 200) * 180 - 180
  const rad = (angleDeg * Math.PI) / 180
  const cx = 110, cy = 95, r = 78
  const nx = cx + r * Math.cos(rad)
  const ny = cy + r * Math.sin(rad)

  // Arc segments: green 0-70%, yellow 70-100%, red 100-200%
  function arcPath(startPct: number, endPct: number) {
    const a1 = ((startPct / 200) * 180 - 180) * (Math.PI / 180)
    const a2 = ((endPct   / 200) * 180 - 180) * (Math.PI / 180)
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
    const large = endPct - startPct > 100 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  return (
    <svg viewBox="0 0 220 110" className="w-full max-w-[220px] mx-auto" aria-label="ROI Gauge">
      {/* Track */}
      <path d={arcPath(0, 200)} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" strokeLinecap="round" />
      {/* Green zone: 0–70% cost */}
      <path d={arcPath(0, 70)}   fill="none" stroke="#22c55e" strokeWidth="10" />
      {/* Yellow zone: 70–100% */}
      <path d={arcPath(70, 100)} fill="none" stroke="#f59e0b" strokeWidth="10" />
      {/* Red zone: 100–200% */}
      <path d={arcPath(100, 200)} fill="none" stroke="#ef4444" strokeWidth="10" />
      {/* Needle */}
      {costPct > 0 && (
        <>
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="5" fill="white" />
          <circle cx={nx} cy={ny} r="3.5" fill="white" />
        </>
      )}
      {/* Labels */}
      <text x="22"  y="107" fontSize="9" fill="hsl(var(--muted-foreground))" textAnchor="middle">0%</text>
      <text x="110" y="12"  fontSize="9" fill="hsl(var(--muted-foreground))" textAnchor="middle">100%</text>
      <text x="200" y="107" fontSize="9" fill="hsl(var(--muted-foreground))" textAnchor="middle">200%</text>
      {/* Center label */}
      {costPct > 0 ? (
        <>
          <text x={cx} y={cy + 18} fontSize="11" fontWeight="bold" fill="hsl(var(--foreground))" textAnchor="middle">
            {costPct.toFixed(0)}%
          </text>
          <text x={cx} y={cy + 29} fontSize="7.5" fill="hsl(var(--muted-foreground))" textAnchor="middle">rasio biaya</text>
        </>
      ) : (
        <text x={cx} y={cy + 18} fontSize="9" fill="hsl(var(--muted-foreground))" textAnchor="middle">Input cost →</text>
      )}
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes scaleIn { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
  @keyframes fadeBg  { from{opacity:0} to{opacity:1} }
  @keyframes modalIn { from{opacity:0;transform:scale(.96) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes growW   { from{width:0} to{width:var(--w)} }

  .u1{animation:fadeUp .3s ease both .04s} .u2{animation:fadeUp .3s ease both .09s}
  .u3{animation:fadeUp .3s ease both .14s} .u4{animation:fadeUp .3s ease both .19s}
  .s1{animation:scaleIn .28s cubic-bezier(.22,.68,0,1.2) both .05s}
  .s2{animation:scaleIn .28s cubic-bezier(.22,.68,0,1.2) both .10s}
  .s3{animation:scaleIn .28s cubic-bezier(.22,.68,0,1.2) both .15s}
  .s4{animation:scaleIn .28s cubic-bezier(.22,.68,0,1.2) both .20s}

  /* ── Project Card ──────────────────────────── */
  .pcard {
    background: hsl(var(--card));
    border-radius: 14px;
    border: 1px solid hsl(var(--border));
    box-shadow: 0 2px 12px -4px rgba(0,0,0,.12), 0 1px 3px -1px rgba(0,0,0,.08);
    overflow: hidden;
    transition: transform .18s ease, box-shadow .18s ease;
    cursor: pointer;
    position: relative;
  }
  .pcard::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 5px;
    border-radius: 14px 0 0 14px;
  }
  .pcard.st-berjalan::before   { background: hsl(var(--primary)); }
  .pcard.st-selesai::before    { background: #22c55e; }
  .pcard.st-tertunggak::before { background: hsl(var(--destructive)); }
  .pcard:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px -6px rgba(0,0,0,.16), 0 2px 6px -2px rgba(0,0,0,.1);
  }
  .pcard-body { padding: 16px 18px 18px 22px; }

  /* ── Modal ─────────────────────────────────── */
  .modal-bg {
    position: fixed; inset: 0; z-index: 50;
    background: rgba(0,0,0,.6);
    backdrop-filter: blur(4px);
    animation: fadeBg .2s ease both;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  }
  .modal {
    background: hsl(var(--background));
    border: 1.5px solid hsl(var(--border));
    border-radius: 20px;
    box-shadow: 0 32px 80px -12px rgba(0,0,0,.35), 0 8px 24px -4px rgba(0,0,0,.2);
    width: min(940px, 100%);
    max-height: calc(100vh - 32px);
    display: flex; flex-direction: column;
    animation: modalIn .25s cubic-bezier(.16,1,.3,1) both;
    overflow: hidden;
  }

  /* ── Tabs ──────────────────────────────────── */
  .mtab {
    flex: 1; padding: 12px 8px; font-size: 13px; font-weight: 600;
    border-bottom: 2.5px solid transparent; transition: all .14s;
    color: hsl(var(--muted-foreground)); cursor: pointer;
    background: transparent; text-align: center;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .mtab:hover { color: hsl(var(--foreground)); }
  .mtab.on { color: hsl(var(--primary)); border-bottom-color: hsl(var(--primary)); background: hsl(var(--primary)/.04); }

  /* ── Progress buttons ──────────────────────── */
  .pbtn {
    width: 48px; height: 34px; border-radius: 8px;
    font-size: 11px; font-weight: 700; border: 1.5px solid hsl(var(--border));
    cursor: pointer; transition: all .12s; background: hsl(var(--muted)/.5);
    color: hsl(var(--muted-foreground));
  }
  .pbtn:hover { border-color: hsl(var(--primary)/.5); color: hsl(var(--primary)); background: hsl(var(--primary)/.06); }
  .pbtn.on { background: hsl(var(--primary)); border-color: hsl(var(--primary)); color: hsl(var(--primary-foreground)); box-shadow: 0 3px 10px -3px hsl(var(--primary)/.55); }

  /* ── Input fields ──────────────────────────── */
  .minput {
    width: 100%; background: hsl(var(--muted)/.3);
    border: 1.5px solid hsl(var(--border)); border-radius: 9px;
    padding: 9px 12px; font-size: 13px; color: hsl(var(--foreground));
    outline: none; transition: all .14s;
  }
  .minput::placeholder { color: hsl(var(--muted-foreground)/.6); }
  .minput:focus { border-color: hsl(var(--primary)/.5); box-shadow: 0 0 0 3px hsl(var(--primary)/.08); background: hsl(var(--card)); }
  textarea.minput { resize: vertical; min-height: 72px; }

  /* ── Metric box ────────────────────────────── */
  .mbox {
    border-radius: 10px; border: 1px solid hsl(var(--border)/.8);
    padding: 10px 14px; background: hsl(var(--muted)/.25);
  }
  .mbox-warn { border-color: hsl(var(--destructive)/.3); background: hsl(var(--destructive)/.05); }
  .mbox-good { border-color: hsl(142 60% 45%/.3); background: hsl(142 60% 45%/.05); }

  /* ── Progress bar ──────────────────────────── */
  .pbar-bg   { height: 6px; border-radius: 99px; background: hsl(var(--muted)); overflow: hidden; }
  .pbar-fill { height: 100%; border-radius: 99px; width: var(--w); animation: growW .9s cubic-bezier(.16,1,.3,1) both .3s; }
  .pbar-blue  { background: linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)/.7)); }
  .pbar-green { background: linear-gradient(90deg, #22c55e, #16a34a); }
  .pbar-red   { background: hsl(var(--destructive)/.7); }

  /* ── Termin timeline ───────────────────────── */
  .tl { display:flex; align-items:flex-start; overflow-x:auto; padding-bottom:2px; gap:0; }
  .tl::-webkit-scrollbar{height:2px}
  .tl::-webkit-scrollbar-thumb{background:hsl(var(--border));border-radius:1px}
  .tl-item{display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:44px;position:relative}
  .tl-item:not(:first-child)::before{content:'';position:absolute;top:9px;left:0;width:calc(50% - 9px);height:2px;background:hsl(var(--border))}
  .tl-item.prev-ok:not(:first-child)::before{background:hsl(var(--primary))}
  .tl-item:not(:last-child)::after{content:'';position:absolute;top:9px;right:0;width:calc(50% - 9px);height:2px;background:hsl(var(--border))}
  .tl-item.is-ok:not(:last-child)::after{background:hsl(var(--primary))}
  .tl-dot{width:20px;height:20px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:800;position:relative;z-index:1}
  .tl-dot.ok{background:hsl(var(--primary));border-color:hsl(var(--primary));color:hsl(var(--primary-foreground))}
  .tl-dot.no{background:hsl(var(--card));border-color:hsl(var(--muted-foreground)/.4);color:hsl(var(--muted-foreground))}
  .tl-dot.warn{background:hsl(var(--destructive)/.08);border-color:hsl(var(--destructive));color:hsl(var(--destructive))}
  .tl-lbl{font-size:8px;color:hsl(var(--muted-foreground));margin-top:4px;text-align:center;line-height:1.1;max-width:42px;word-break:break-word}

  /* ── Search/filter ─────────────────────────── */
  .sbox{background:hsl(var(--muted)/.4);border:1.5px solid hsl(var(--border));border-radius:10px;padding:9px 12px 9px 38px;font-size:13px;color:hsl(var(--foreground));outline:none;transition:all .15s;width:100%}
  .sbox::placeholder{color:hsl(var(--muted-foreground)/.6)}
  .sbox:focus{border-color:hsl(var(--primary)/.5);box-shadow:0 0 0 3px hsl(var(--primary)/.08);background:hsl(var(--card))}
  .chip{border:1.5px solid hsl(var(--border));border-radius:20px;padding:4px 12px;font-size:11.5px;cursor:pointer;transition:all .12s;background:transparent;color:hsl(var(--muted-foreground));white-space:nowrap}
  .chip:hover{border-color:hsl(var(--primary)/.4);color:hsl(var(--foreground))}
  .chip.on{background:hsl(var(--primary));border-color:hsl(var(--primary));color:hsl(var(--primary-foreground));font-weight:700}

  /* ── Card grid ─────────────────────────────── */
  .pgrid{display:grid;gap:16px;grid-template-columns:1fr}
  @media(min-width:760px){.pgrid{grid-template-columns:1fr 1fr}}
  @media(min-width:1200px){.pgrid{grid-template-columns:1fr 1fr 1fr}}

  /* ── Invoice/cost rows ─────────────────────── */
  .inv-row{padding:10px 14px;border-radius:10px;border:1.5px solid hsl(var(--border)/.7);background:hsl(var(--muted)/.12);margin-bottom:6px;transition:all .13s}
  .inv-row:hover{border-color:hsl(var(--primary)/.35);background:hsl(var(--primary)/.03)}
  .inv-row:last-child{margin-bottom:0}

  /* ── KPI card hover ────────────────────────── */
  .kcard{transition:box-shadow .18s, transform .18s}
  .kcard:hover{box-shadow:0 6px 20px -6px hsl(var(--primary)/.15);transform:translateY(-1px)}

  /* ── Division badge ────────────────────────── */
  .div-badge-proj{background:hsl(220 100% 50%/.08);border:1px solid hsl(220 100% 50%/.2);color:hsl(220 100% 45%)}
  .div-badge-fin{background:hsl(142 70% 45%/.08);border:1px solid hsl(142 70% 45%/.2);color:hsl(142 70% 40%)}
  .dark .div-badge-proj{color:hsl(220 100% 70%)}
  .dark .div-badge-fin{color:hsl(142 70% 60%)}

  /* ── Save button ───────────────────────────── */
  .savebtn{display:inline-flex;align-items:center;gap:6px;padding:9px 20px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:all .14s;border:none}
  .savebtn-primary{background:hsl(var(--primary));color:hsl(var(--primary-foreground))}
  .savebtn-primary:hover{opacity:.88}
  .savebtn-primary:disabled{opacity:.5;cursor:not-allowed}
`

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { user } = useCurrentUser()
  const [tab, setTab] = React.useState<"project" | "costcontrol" | "invoice">("project")
  const [detail, setDetail] = React.useState<ProjectDetail | null>(null)
  const [costs, setCosts]   = React.useState<ProjectCost[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving]  = React.useState(false)
  const [savedOk, setSavedOk] = React.useState(false)

  // ── Doc Control fields ──
  const [editName,     setEditName]     = React.useState("")
  const [editSite,     setEditSite]     = React.useState("")
  const [editDesc,     setEditDesc]     = React.useState("")
  const [editProg,     setEditProg]     = React.useState(0)
  const [editNotes,    setEditNotes]    = React.useState("")
  const [editPOManual, setEditPOManual] = React.useState("")

  // ── Cost Control fields ──
  const [opVals, setOpVals] = React.useState<Record<string, string>>({
    op_gaji: "", op_material: "", op_transport: "", op_operasional: "", op_sewa: "", op_lainnya: ""
  })

  // ── Add actual cost ──
  const [ccat,   setCcat]   = React.useState("material")
  const [cdesc,  setCdesc]  = React.useState("")
  const [camt,   setCamt]   = React.useState("")
  const [cdate,  setCdate]  = React.useState("")
  const [adding, setAdding] = React.useState(false)

  React.useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/project-details/${encodeURIComponent(project.id)}`).then(r => r.json()),
      fetch(`/api/project-costs?key=${encodeURIComponent(project.id)}`).then(r => r.json()),
    ]).then(([d, c]) => {
      const det: ProjectDetail = d.data ?? {
        project_key: project.id, display_name: "", physical_progress: 0, notes: "",
        site_location: "", description: "", po_value_manual: 0,
        op_gaji: 0, op_material: 0, op_transport: 0, op_operasional: 0, op_sewa: 0, op_lainnya: 0,
      }
      setDetail(det)
      setEditName(det.display_name || project.clientName)
      setEditSite(det.site_location || project.location)
      setEditDesc(det.description)
      setEditProg(det.physical_progress)
      setEditNotes(det.notes)
      setEditPOManual(det.po_value_manual > 0 ? fNum(det.po_value_manual) : "")
      setOpVals({
        op_gaji:        fNum(det.op_gaji),
        op_material:    fNum(det.op_material),
        op_transport:   fNum(det.op_transport),
        op_operasional: fNum(det.op_operasional),
        op_sewa:        fNum(det.op_sewa),
        op_lainnya:     fNum(det.op_lainnya),
      })
      setCosts(c.data ?? [])
    }).finally(() => setLoading(false))
  }, [project.id, project.clientName, project.location])

  async function save() {
    setSaving(true); setSavedOk(false)
    try {
      const r = await fetch(`/api/project-details/${encodeURIComponent(project.id)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: editName, physical_progress: editProg,
          notes: editNotes, site_location: editSite, description: editDesc,
          po_value_manual: parseNum(editPOManual),
          op_gaji:        parseNum(opVals.op_gaji),
          op_material:    parseNum(opVals.op_material),
          op_transport:   parseNum(opVals.op_transport),
          op_operasional: parseNum(opVals.op_operasional),
          op_sewa:        parseNum(opVals.op_sewa),
          op_lainnya:     parseNum(opVals.op_lainnya),
        }),
      })
      const d = await r.json()
      setDetail(d.data)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
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

  // ── Calculations ──
  const contractVal = parseNum(editPOManual) || project.poValue || project.totalValue
  const totalOpCosts = Object.keys(opVals).reduce((s, k) => s + parseNum(opVals[k]), 0)
  const netProfit  = contractVal - totalOpCosts
  const netMargin  = contractVal > 0 ? (netProfit / contractVal) * 100 : 0
  const efisiensi  = totalOpCosts > 0 ? (contractVal / totalOpCosts) * 100 : 0
  const costPct    = contractVal > 0 ? (totalOpCosts / contractVal) * 100 : 0

  const stCls   = project.status === "SELESAI" ? "st-selesai" : project.status === "TERTUNGGAK" ? "st-tertunggak" : "st-berjalan"
  const barCls  = project.status === "SELESAI" ? "pbar-green" : project.status === "TERTUNGGAK" ? "pbar-red" : "pbar-blue"
  const bilPct  = Math.round(project.billingProgress)

  // ── Prevent body scroll ──
  React.useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">

        {/* ── Modal Header ─────────────────────────────── */}
        <div className="relative px-7 pt-6 pb-4 border-b bg-gradient-to-r from-muted/30 to-transparent shrink-0">
          <button type="button" onClick={onClose} aria-label="Tutup"
            className="absolute top-5 right-5 h-8 w-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all z-10">
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4 pr-10">
            {/* Status icon */}
            <div className={`mt-0.5 shrink-0 h-12 w-12 rounded-xl flex items-center justify-center text-xl
              ${project.status === "SELESAI"    ? "bg-green-500/15 border border-green-500/25"
              : project.status === "TERTUNGGAK" ? "bg-destructive/12 border border-destructive/25"
              :                                   "bg-primary/10 border border-primary/20"}`}>
              {project.status === "SELESAI" ? "✅" : project.status === "TERTUNGGAK" ? "⚠️" : "🔵"}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold leading-tight mb-1">{editName || project.clientName}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {editSite && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {editSite}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border
                  ${project.status === "SELESAI"    ? "bg-green-500/10 text-green-700 border-green-500/25 dark:text-green-400"
                  : project.status === "TERTUNGGAK" ? "bg-destructive/10 text-destructive border-destructive/25"
                  :                                   "bg-primary/10 text-primary border-primary/20"}`}>
                  {project.status === "SELESAI" ? <CheckCircle2 className="h-2.5 w-2.5" /> : project.status === "TERTUNGGAK" ? <AlertTriangle className="h-2.5 w-2.5" /> : <CircleDot className="h-2.5 w-2.5" />}
                  {project.status}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {CAT_ICON[project.category]} {CAT_LABEL[project.category]}
                </span>
              </div>
            </div>
          </div>

          {/* Quick stats strip */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              { label: "Nilai Kontrak",   val: fShort(contractVal),             cls: "text-foreground" },
              { label: "Invoice Lunas",   val: `${project.paidCount}/${project.invoiceCount}`, cls: project.paidCount === project.invoiceCount ? "text-green-600" : "text-foreground" },
              { label: "Outstanding",     val: project.totalOutstanding > 0 ? fShort(project.totalOutstanding) : "Lunas ✓", cls: project.totalOutstanding > 0 ? "text-destructive" : "text-green-600" },
              { label: "Progres Fisik",   val: loading ? "…" : `${editProg}%`,  cls: editProg >= 80 ? "text-green-600" : editProg >= 40 ? "text-primary" : "text-foreground" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{s.label}</p>
                <p className={`text-sm font-black font-mono ${s.cls}`}>{s.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────── */}
        <div className="flex border-b shrink-0">
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

        {/* ── Tab Content ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Memuat data…</div>
          ) : tab === "project" ? (

            /* ════════════ DOCUMENT CONTROL TAB ════════════ */
            <div className="p-7">
              <div className="flex items-center gap-2 mb-5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold div-badge-proj">
                  <Users className="h-3 w-3" /> Divisi Project — Document Control
                </span>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {/* Left column */}
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

                {/* Right column */}
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
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Dari invoice: <span className="font-semibold">{fIDR(project.poValue)}</span>
                      </p>
                    )}
                  </div>

                  {/* Progress Physical */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                      Progres Fisik di Lapangan
                      <span className="ml-2 font-black text-primary">{editProg}%</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PROGRESS_STEPS.map(p => (
                        <button key={p} type="button" className={`pbtn ${editProg === p ? "on" : ""}`}
                          onClick={() => setEditProg(p)}>
                          {p}%
                        </button>
                      ))}
                    </div>
                    {editProg > 0 && (
                      <div className="mt-3 pbar-bg">
                        <div className={`pbar-fill ${editProg === 100 ? "pbar-green" : "pbar-blue"}`}
                          style={{ "--w": `${editProg}%` } as React.CSSProperties} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="mt-6 flex items-center gap-3 pt-5 border-t">
                <button type="button" onClick={save} disabled={saving} className="savebtn savebtn-primary">
                  {saving ? <><span className="animate-spin">⟳</span> Menyimpan…</> : savedOk ? <><CheckCheck className="h-4 w-4" /> Tersimpan!</> : <><Save className="h-4 w-4" /> Simpan Perubahan</>}
                </button>
                {savedOk && <span className="text-xs text-green-600 font-semibold">✓ Data berhasil disimpan</span>}
              </div>
            </div>

          ) : tab === "costcontrol" ? (

            /* ════════════ COST CONTROL TAB ════════════ */
            <div className="p-7">
              <div className="flex items-center gap-2 mb-5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold div-badge-fin">
                  <DollarSign className="h-3 w-3" /> Divisi Finance — Cost Control
                </span>
              </div>

              {/* Project info summary */}
              <div className="grid grid-cols-3 gap-3 mb-6 p-4 rounded-2xl border bg-muted/20">
                {[
                  { label: "Nilai PO / Kontrak", val: fIDR(contractVal), cls: "text-foreground font-black" },
                  { label: "Total Invoice",       val: fIDR(project.totalValue), cls: "text-foreground font-semibold" },
                  { label: "Sudah Terbayar",      val: fIDR(project.totalPaid),  cls: "text-green-600 font-semibold" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">{s.label}</p>
                    <p className={`text-sm font-mono ${s.cls}`}>{s.val}</p>
                  </div>
                ))}
              </div>

              {/* Two-column: Gauge + Input */}
              <div className="grid gap-6 md:grid-cols-2">

                {/* Left: ROI Overview */}
                <div className="rounded-2xl border bg-muted/10 p-5">
                  <p className="text-sm font-bold mb-1">ROI Overview</p>
                  <p className="text-[11px] text-muted-foreground mb-3">Return on Investment berdasarkan biaya yang diinput</p>
                  <ROIGauge costPct={costPct} />
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {[
                      { label: "NET PROFIT",  val: totalOpCosts > 0 ? fShort(netProfit)          : "—", cls: netProfit >= 0 ? "text-green-600" : "text-destructive" },
                      { label: "NET MARGIN",  val: totalOpCosts > 0 ? `${netMargin.toFixed(1)}%` : "—", cls: netMargin >= 0 ? "text-green-600" : "text-destructive" },
                      { label: "EFISIENSI",   val: totalOpCosts > 0 ? `${efisiensi.toFixed(0)}%` : "—", cls: efisiensi >= 100 ? "text-green-600" : "text-destructive" },
                    ].map(m => (
                      <div key={m.label} className="text-center p-2 rounded-xl border border-border/60 bg-background">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{m.label}</p>
                        <p className={`text-base font-black font-mono ${m.cls}`}>{m.val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Input Biaya Operasional */}
                <div className="rounded-2xl border bg-muted/10 p-5">
                  <p className="text-sm font-bold mb-1">Input Biaya Operasional</p>
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
                  <p className="text-[10px] text-muted-foreground mt-3">* Angka digunakan untuk menghitung ROI, tidak tersimpan permanen sampai klik Simpan</p>
                </div>
              </div>

              {/* Actual cost log */}
              <div className="mt-6">
                <p className="text-sm font-bold mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" /> Log Biaya Aktual
                </p>

                {/* Add cost */}
                <div className="rounded-xl border bg-muted/15 p-4 mb-4">
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
                    className="savebtn savebtn-primary text-sm" style={{ fontSize: 12, padding: "7px 16px" }}>
                    <Plus className="h-3.5 w-3.5" /> {adding ? "Menambahkan…" : "Tambah"}
                  </button>
                </div>

                {costs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Belum ada biaya aktual tercatat</p>
                ) : (
                  <div>
                    {costs.map(c => (
                      <div key={c.id} className="inv-row flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold uppercase text-primary bg-primary/8 px-1.5 py-0.5 rounded">{c.category}</span>
                            {c.cost_date && <span className="text-[10px] text-muted-foreground">{c.cost_date}</span>}
                          </div>
                          <p className="text-xs text-foreground font-medium truncate">{c.description}</p>
                          <p className="text-[10px] text-muted-foreground">by {c.input_by}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-sm font-bold font-mono">{fIDR(c.amount)}</p>
                          <button type="button" title="Hapus biaya" aria-label="Hapus biaya" onClick={() => delCost(c.id)}
                            className="text-muted-foreground/30 hover:text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="mt-3 p-3 rounded-xl border border-border bg-muted/20 flex justify-between items-center">
                      <span className="text-xs font-semibold text-muted-foreground">Total Biaya Aktual</span>
                      <span className="text-sm font-black font-mono text-destructive">{fIDR(costs.reduce((s, c) => s + c.amount, 0))}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Save button for cost control */}
              <div className="mt-6 flex items-center gap-3 pt-5 border-t">
                <button type="button" onClick={save} disabled={saving} className="savebtn savebtn-primary">
                  {saving ? <><span className="animate-spin">⟳</span> Menyimpan…</> : savedOk ? <><CheckCheck className="h-4 w-4" /> Tersimpan!</> : <><Save className="h-4 w-4" /> Simpan Cost Control</>}
                </button>
                {savedOk && <span className="text-xs text-green-600 font-semibold">✓ Data berhasil disimpan</span>}
              </div>
            </div>

          ) : (

            /* ════════════ INVOICE TAB ════════════ */
            <div className="p-7">
              <div className="flex items-center gap-2 mb-5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold div-badge-fin">
                  <DollarSign className="h-3 w-3" /> Divisi Finance — Invoice
                </span>
                <span className="text-[11px] text-muted-foreground">{project.invoiceCount} invoice terhubung ke project ini</span>
              </div>

              {/* Billing progress */}
              <div className="rounded-2xl border bg-muted/15 p-4 mb-5">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-muted-foreground font-medium">Billing Progress</span>
                  <span className="font-bold">{project.paidCount}/{project.invoiceCount} terbayar · {bilPct}%</span>
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

              {/* Termin timeline */}
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
                      <div className="tl-item" title={`+${project.invoiceCount - 12} lainnya`}>
                        <div className="tl-dot no">+{project.invoiceCount - 12}</div>
                        <p className="tl-lbl">lagi</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Invoice list */}
              <div>
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
                          {inv.po_number && (
                            <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded">PO: {inv.po_number}</span>
                          )}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${inv.status === "PAID" ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}>
                            {inv.status === "PAID" ? "LUNAS" : "UNPAID"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">{inv.description}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{inv.date}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold font-mono">{fShort(inv.total)}</p>
                        {inv.payment_value > 0 && (
                          <p className="text-[10px] text-green-600">Bayar: {fShort(inv.payment_value)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const pct = Math.round(project.billingProgress)
  const MAX = 6
  const stCls  = project.status === "SELESAI" ? "st-selesai" : project.status === "TERTUNGGAK" ? "st-tertunggak" : "st-berjalan"
  const barCls = project.status === "SELESAI" ? "pbar-green" : project.status === "TERTUNGGAK" ? "pbar-red" : "pbar-blue"

  return (
    <div className={`pcard ${stCls}`} onClick={onClick}>
      <div className="pcard-body">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-3">
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
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {CAT_ICON[project.category]} {CAT_LABEL[project.category]}
            </span>
          </div>
          <span className="shrink-0 text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5 border border-border/50">
            {project.invoiceCount} inv
          </span>
        </div>

        {/* Client / Project name */}
        <h3 className="text-[15px] font-bold leading-snug line-clamp-1 mb-0.5 tracking-tight">{project.clientName}</h3>
        {project.location && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground mb-3">
            <MapPin className="h-2.5 w-2.5 shrink-0" /> {project.location}
          </p>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="mbox">
            <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Total Kontrak</p>
            <p className="text-sm font-black font-mono">{fShort(project.totalValue)}</p>
          </div>
          <div className={`mbox ${project.totalOutstanding > 0 ? "mbox-warn" : "mbox-good"}`}>
            <p className={`text-[10px] font-medium mb-0.5 ${project.totalOutstanding > 0 ? "text-destructive/70" : "text-green-600/70"}`}>
              {project.totalOutstanding > 0 ? "Outstanding" : "Status"}
            </p>
            <p className={`text-sm font-black font-mono ${project.totalOutstanding > 0 ? "text-destructive" : "text-green-600"}`}>
              {project.totalOutstanding > 0 ? fShort(project.totalOutstanding) : "Lunas ✓"}
            </p>
          </div>
        </div>

        {/* Billing progress */}
        <div className="mb-3">
          <div className="flex justify-between text-[11px] mb-1.5">
            <span className="text-muted-foreground">{project.paidCount}/{project.invoiceCount} invoice terbayar</span>
            <span className="font-bold">{pct}%</span>
          </div>
          <div className="pbar-bg">
            <div className={`pbar-fill ${barCls}`} style={{ "--w": `${pct}%` } as React.CSSProperties} />
          </div>
        </div>

        {/* Termin dots */}
        {project.invoiceCount > 1 && (
          <div className="tl mb-3">
            {project.termins.slice(0, MAX).map((t, idx) => {
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
            {project.invoiceCount > MAX && (
              <div className="tl-item" title={`+${project.invoiceCount - MAX} lainnya`}>
                <div className="tl-dot no">+{project.invoiceCount - MAX}</div>
                <p className="tl-lbl">lagi</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground">
              {project.firstDate === project.lastDate
                ? project.firstDate
                : `${project.firstDate} — ${project.lastDate}`}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-primary flex items-center gap-0.5">
            Detail <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { invoices: raw, periodLabel } = useFilteredInvoices()
  const allProjects = React.useMemo(() => buildProjects(raw), [raw])
  const [search,       setSearch]       = React.useState("")
  const [filterStatus, setFilterStatus] = React.useState("Semua")
  const [filterCat,    setFilterCat]    = React.useState("Semua")
  const [selected,     setSelected]     = React.useState<Project | null>(null)

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

          {/* ── Header ─────────────────────────────────────── */}
          <div className="u1 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-sm">
                <FolderKanban className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {allProjects.length} proyek · {raw.length} invoice · {periodLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {stats.tertunggak > 0 && (
                <button type="button" onClick={() => setFilterStatus(p => p === "TERTUNGGAK" ? "Semua" : "TERTUNGGAK")}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all
                    ${filterStatus === "TERTUNGGAK" ? "bg-destructive text-white border-destructive shadow-md" : "bg-destructive/8 text-destructive border-destructive/25 hover:bg-destructive/15"}`}>
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

          {/* ── KPI Cards ───────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {([
              { sc: "s1", title: "Total Proyek",  val: stats.total,      fmt: (v: number) => String(v),          sub: `${raw.length} invoice`,                  icon: <FolderKanban className="h-4 w-4 text-muted-foreground" />, cls: "" },
              { sc: "s2", title: "Nilai Kontrak", val: stats.totalValue, fmt: fShort,                             sub: `gross ${periodLabel}`,                   icon: <Receipt className="h-4 w-4 text-muted-foreground" />,     cls: "text-lg font-bold" },
              { sc: "s3", title: "Selesai",       val: stats.selesai,    fmt: (v: number) => String(v),          sub: `${stats.total > 0 ? ((stats.selesai / stats.total) * 100).toFixed(0) : 0}% dari total`, icon: <CheckCircle2 className="h-4 w-4 text-green-600" />, cls: "text-green-600" },
              { sc: "s4", title: "Outstanding",   val: stats.totalOut,   fmt: fShort,                             sub: `${stats.tertunggak + stats.berjalan} proyek belum lunas`, icon: <AlertTriangle className="h-4 w-4 text-destructive" />, cls: stats.totalOut > 0 ? "text-destructive text-lg font-bold" : "text-green-600" },
            ] as const).map(c => (
              <div key={c.title} className={c.sc}>
                <Card className="kcard">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
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

          {/* ── Status distribution ─────────────────────────── */}
          <div className="u2">
            <Card>
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-[180px] space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Distribusi status</span>
                      <span className="font-semibold text-foreground">{stats.total} proyek</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden flex gap-0.5">
                      {stats.tertunggak > 0 && <div className="h-full bg-destructive rounded-l-full" style={{ width: `${(stats.tertunggak / stats.total) * 100}%` }} />}
                      {stats.berjalan   > 0 && <div className="h-full bg-primary"     style={{ width: `${(stats.berjalan   / stats.total) * 100}%` }} />}
                      {stats.selesai    > 0 && <div className="h-full bg-green-500 rounded-r-full" style={{ width: `${(stats.selesai / stats.total) * 100}%` }} />}
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

          {/* ── Filter & Search ─────────────────────────────── */}
          <div className="u3">
            <Card className="overflow-hidden">
              <div className="px-6 py-3 border-b bg-primary/5 flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-[11px] font-black uppercase tracking-wider text-primary/80">Filter & Cari</span>
              </div>
              <CardContent className="py-4 px-6 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Cari klien, no. invoice, no. PO, site…"
                    className="sbox" />
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
                    <button key={s} type="button" onClick={() => setFilterStatus(s)}
                      className={`chip ${filterStatus === s ? "on" : ""}`}>
                      {s === "Semua" ? `Semua (${stats.total})` : s}
                    </button>
                  ))}
                  <span className="mx-1 h-4 w-px bg-border" />
                  <span className="text-muted-foreground font-medium">Tipe:</span>
                  {CATS.map(c => (
                    <button key={c} type="button" onClick={() => setFilterCat(c)}
                      className={`chip ${filterCat === c ? "on" : ""}`}>{c}</button>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Menampilkan <span className="font-bold text-foreground">{displayed.length}</span> proyek
                  </p>
                  {hasFilter && (
                    <button type="button" onClick={() => { setSearch(""); setFilterStatus("Semua"); setFilterCat("Semua") }}
                      className="text-xs text-primary hover:underline font-medium">Reset filter</button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Project Grid ────────────────────────────────── */}
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
                    <ProjectCard project={p} onClick={() => setSelected(p)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail Modal */}
        {selected && <DetailModal project={selected} onClose={() => setSelected(null)} />}

      </SidebarInset>
    </SidebarProvider>
  )
}
