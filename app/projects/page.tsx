"use client"

import * as React from "react"
import {
  FolderKanban, Search, CircleDot, CheckCircle2, AlertTriangle,
  CalendarDays, Receipt, Package, Wrench, Briefcase, X, Filter,
  Hash, Pencil, Plus, Trash2, Save, TrendingUp, DollarSign,
  ChevronDown, MapPin,
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
  if (d.includes("jasa")) return "Jasa"
  return "Jasa"
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

const COST_CATS = [
  { key: "material",   label: "Material",      color: "amber" },
  { key: "subkon",     label: "Subkon",        color: "violet" },
  { key: "harian",     label: "Orang Harian",  color: "blue" },
  { key: "pengiriman", label: "Pengiriman",    color: "orange" },
  { key: "lainnya",    label: "Lainnya",       color: "slate" },
]

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes scaleIn { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }
  @keyframes slideRight { from{opacity:0;transform:translateX(100%)} to{opacity:1;transform:translateX(0)} }
  @keyframes fadeBg { from{opacity:0} to{opacity:1} }
  @keyframes growW { from{width:0} to{width:var(--w)} }

  .u1{animation:fadeUp .35s ease both .04s} .u2{animation:fadeUp .35s ease both .09s}
  .u3{animation:fadeUp .35s ease both .14s} .u4{animation:fadeUp .35s ease both .19s}
  .s1{animation:scaleIn .3s cubic-bezier(.22,.68,0,1.2) both .05s}
  .s2{animation:scaleIn .3s cubic-bezier(.22,.68,0,1.2) both .10s}
  .s3{animation:scaleIn .3s cubic-bezier(.22,.68,0,1.2) both .15s}
  .s4{animation:scaleIn .3s cubic-bezier(.22,.68,0,1.2) both .20s}

  .kcard{transition:transform .18s,box-shadow .18s;cursor:default}
  .kcard:hover{transform:translateY(-1px);box-shadow:0 6px 20px -6px hsl(var(--primary)/.18)}

  /* ─── Project card ─────────────────────────────────────────────── */
  .pcard {
    background: hsl(var(--card));
    border-radius: 16px;
    border: 1.5px solid hsl(var(--border));
    box-shadow: 0 2px 8px -3px hsl(var(--foreground)/.07), 0 1px 2px -1px hsl(var(--foreground)/.04);
    overflow: hidden;
    transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
    cursor: pointer;
  }
  .pcard:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px -8px hsl(var(--foreground)/.12), 0 2px 8px -3px hsl(var(--foreground)/.06);
  }
  .pcard.st-berjalan:hover  { border-color: hsl(var(--primary)/.4); box-shadow: 0 12px 32px -8px hsl(var(--primary)/.18); }
  .pcard.st-selesai:hover   { border-color: hsl(142 70% 45%/.4); box-shadow: 0 12px 32px -8px hsl(142 70% 45%/.14); }
  .pcard.st-tertunggak      { border-color: hsl(var(--destructive)/.3); }
  .pcard.st-tertunggak:hover{ border-color: hsl(var(--destructive)/.55); box-shadow: 0 12px 32px -8px hsl(var(--destructive)/.16); }

  /* colored top accent bar */
  .pcard-accent {
    height: 5px;
    width: 100%;
    flex-shrink: 0;
  }
  .acc-berjalan   { background: linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)/.6)); }
  .acc-selesai    { background: linear-gradient(90deg, #22c55e, #16a34a80); }
  .acc-tertunggak { background: linear-gradient(90deg, hsl(var(--destructive)), hsl(var(--destructive)/.55)); }

  .pcard-body { padding: 18px 20px 20px; }

  /* metric box */
  .mbox {
    border-radius: 10px;
    border: 1px solid hsl(var(--border)/.8);
    padding: 10px 12px;
    background: hsl(var(--muted)/.35);
  }
  .mbox-warn {
    border-color: hsl(var(--destructive)/.25);
    background: hsl(var(--destructive)/.05);
  }
  .mbox-good {
    border-color: hsl(142 60% 45%/.25);
    background: hsl(142 60% 45%/.05);
  }

  /* progress bar */
  .pbar-bg { height: 7px; border-radius: 99px; background: hsl(var(--muted)); overflow: hidden; }
  .pbar-fill { height: 100%; border-radius: 99px; width: var(--w); animation: growW .9s cubic-bezier(.16,1,.3,1) both .35s; }
  .pbar-blue   { background: linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)/.75)); }
  .pbar-green  { background: linear-gradient(90deg, #22c55e, #16a34a); }
  .pbar-red    { background: hsl(var(--destructive)/.7); }

  /* termin dots */
  .tl { display:flex; align-items:flex-start; overflow-x:auto; padding-bottom:2px; gap:0; }
  .tl::-webkit-scrollbar{height:2px}
  .tl::-webkit-scrollbar-thumb{background:hsl(var(--border));border-radius:1px}
  .tl-item { display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:46px;position:relative; }
  .tl-item:not(:first-child)::before{content:'';position:absolute;top:9px;left:0;width:calc(50% - 9px);height:2px;background:hsl(var(--border))}
  .tl-item.prev-ok:not(:first-child)::before{background:hsl(var(--primary))}
  .tl-item:not(:last-child)::after{content:'';position:absolute;top:9px;right:0;width:calc(50% - 9px);height:2px;background:hsl(var(--border))}
  .tl-item.is-ok:not(:last-child)::after{background:hsl(var(--primary))}
  .tl-dot{width:20px;height:20px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:800;position:relative;z-index:1}
  .tl-dot.ok  {background:hsl(var(--primary));border-color:hsl(var(--primary));color:hsl(var(--primary-foreground))}
  .tl-dot.no  {background:hsl(var(--card));border-color:hsl(var(--muted-foreground)/.4);color:hsl(var(--muted-foreground))}
  .tl-dot.warn{background:hsl(var(--destructive)/.08);border-color:hsl(var(--destructive));color:hsl(var(--destructive))}
  .tl-lbl{font-size:8px;color:hsl(var(--muted-foreground));margin-top:4px;text-align:center;line-height:1.1;max-width:44px;word-break:break-word}

  /* search / chip */
  .sbox{background:hsl(var(--muted)/.5);border:1.5px solid hsl(var(--border));border-radius:10px;padding:9px 12px 9px 38px;font-size:13px;color:hsl(var(--foreground));outline:none;transition:all .15s}
  .sbox::placeholder{color:hsl(var(--muted-foreground))}
  .sbox:focus{border-color:hsl(var(--primary)/.5);box-shadow:0 0 0 3px hsl(var(--primary)/.08);background:hsl(var(--card))}
  .chip{border:1.5px solid hsl(var(--border));border-radius:20px;padding:4px 12px;font-size:11.5px;cursor:pointer;transition:all .13s;background:transparent;color:hsl(var(--muted-foreground));white-space:nowrap}
  .chip:hover{border-color:hsl(var(--primary)/.5);color:hsl(var(--foreground))}
  .chip.on{background:hsl(var(--primary));border-color:hsl(var(--primary));color:hsl(var(--primary-foreground));font-weight:700;box-shadow:0 4px 14px -4px hsl(var(--primary)/.6)}

  /* grid */
  .pgrid{display:grid;gap:20px;grid-template-columns:1fr}
  @media(min-width:860px){.pgrid{grid-template-columns:1fr 1fr}}
  @media(min-width:1280px){.pgrid{grid-template-columns:1fr 1fr 1fr}}

  /* ─── Detail panel ─────────────────────────────────────────────── */
  .panel-bg {
    position: fixed; inset: 0; z-index: 50;
    background: rgba(0,0,0,.45);
    backdrop-filter: blur(2px);
    animation: fadeBg .2s ease both;
  }
  .panel {
    position: fixed; right: 0; top: 0; bottom: 0;
    width: min(500px, 100vw);
    z-index: 51;
    background: hsl(var(--background));
    border-left: 1.5px solid hsl(var(--border));
    box-shadow: -16px 0 48px -8px rgba(0,0,0,.18);
    display: flex; flex-direction: column;
    animation: slideRight .24s cubic-bezier(.16,1,.3,1) both;
  }
  .ptab{flex:1;padding:11px 4px;font-size:12px;font-weight:600;border-bottom:2.5px solid transparent;transition:all .14s;color:hsl(var(--muted-foreground));cursor:pointer;background:transparent;text-align:center}
  .ptab:hover{color:hsl(var(--foreground))}
  .ptab.on{color:hsl(var(--primary));border-bottom-color:hsl(var(--primary))}

  .pinput{width:100%;background:hsl(var(--muted)/.4);border:1.5px solid hsl(var(--border));border-radius:9px;padding:9px 12px;font-size:13px;color:hsl(var(--foreground));outline:none;transition:all .15s}
  .pinput::placeholder{color:hsl(var(--muted-foreground))}
  .pinput:focus{border-color:hsl(var(--primary)/.5);box-shadow:0 0 0 3px hsl(var(--primary)/.08);background:hsl(var(--card))}

  .pslider{width:100%;height:7px;border-radius:99px;appearance:none;background:hsl(var(--muted));outline:none;cursor:pointer;accent-color:hsl(var(--primary))}
  .pslider::-webkit-slider-thumb{appearance:none;width:20px;height:20px;border-radius:50%;background:hsl(var(--primary));border:3px solid hsl(var(--background));box-shadow:0 2px 8px hsl(var(--primary)/.4);cursor:pointer}

  .ccat-btn{padding:5px 12px;border-radius:99px;font-size:11px;font-weight:600;border:1.5px solid hsl(var(--border));cursor:pointer;transition:all .12s;background:transparent;color:hsl(var(--muted-foreground));white-space:nowrap}
  .ccat-btn:hover{border-color:hsl(var(--primary)/.5);color:hsl(var(--foreground))}
  .ccat-btn.on{background:hsl(var(--primary));border-color:hsl(var(--primary));color:hsl(var(--primary-foreground))}

  .cost-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:10px 14px;border-radius:10px;border:1.5px solid hsl(var(--border)/.7);background:hsl(var(--card));margin-bottom:6px;transition:border-color .14s}
  .cost-row:hover{border-color:hsl(var(--primary)/.3)}
  .cost-row:last-child{margin-bottom:0}

  .inv-row{padding:10px 14px;border-radius:10px;border:1.5px solid hsl(var(--border)/.7);background:hsl(var(--card));margin-bottom:6px;transition:all .14s}
  .inv-row:hover{border-color:hsl(var(--primary)/.3);background:hsl(var(--primary)/.03)}
  .inv-row:last-child{margin-bottom:0}

  /* hv card */
  .hvc{position:relative;overflow:hidden;border:1px solid hsl(var(--border));background:hsl(var(--card));transition:box-shadow .18s}
  .hvc:hover{box-shadow:0 8px 24px -8px hsl(var(--primary)/.14)}
`

// ─── Detail Panel Component ───────────────────────────────────────────────────
function DetailPanel({ project, onClose }: { project: Project; onClose: () => void }) {
  const { user } = useCurrentUser()
  const [tab, setTab] = React.useState<"overview" | "biaya" | "invoice">("overview")
  const [detail, setDetail] = React.useState<ProjectDetail | null>(null)
  const [costs, setCosts]   = React.useState<ProjectCost[]>([])
  const [loading, setLoading] = React.useState(true)

  // edit state
  const [editProg, setEditProg]     = React.useState(0)
  const [editNotes, setEditNotes]   = React.useState("")
  const [editName, setEditName]     = React.useState("")
  const [editingName, setEditingName] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [savedOk, setSavedOk] = React.useState(false)

  // cost form
  const [ccat, setCcat]   = React.useState("material")
  const [cdesc, setCdesc] = React.useState("")
  const [camt, setCamt]   = React.useState("")
  const [cdate, setCdate] = React.useState("")
  const [adding, setAdding] = React.useState(false)
  const [cerr, setCerr]   = React.useState("")

  React.useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/project-details/${encodeURIComponent(project.id)}`).then(r => r.json()),
      fetch(`/api/project-costs?key=${encodeURIComponent(project.id)}`).then(r => r.json()),
    ]).then(([d, c]) => {
      const det: ProjectDetail = d.data ?? { project_key: project.id, display_name: "", physical_progress: 0, notes: "" }
      setDetail(det)
      setEditProg(det.physical_progress)
      setEditNotes(det.notes)
      setEditName(det.display_name || project.clientName)
      setCosts(c.data ?? [])
    }).finally(() => setLoading(false))
  }, [project.id, project.clientName])

  async function save() {
    setSaving(true); setSavedOk(false)
    try {
      const r = await fetch(`/api/project-details/${encodeURIComponent(project.id)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: editName, physical_progress: editProg, notes: editNotes }),
      })
      const d = await r.json()
      setDetail(d.data)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
    } finally { setSaving(false) }
  }

  async function addCost() {
    if (!cdesc.trim()) { setCerr("Deskripsi wajib diisi"); return }
    const amt = Number(camt.replace(/[^\d.]/g, ""))
    if (!amt) { setCerr("Jumlah tidak valid"); return }
    setCerr(""); setAdding(true)
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

  const totalCosts = costs.reduce((s, c) => s + (c.amount || 0), 0)
  const contractVal = project.poValue || project.totalValue
  const margin = contractVal - totalCosts
  const marginPct = contractVal > 0 ? (margin / contractVal) * 100 : 0

  return (
    <>
      {/* Backdrop */}
      <div className="panel-bg" onClick={onClose} />

      {/* Panel */}
      <div className="panel">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="relative border-b px-6 pt-5 pb-4">
          <button type="button" title="Tutup" aria-label="Tutup panel" onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
            <X className="h-4 w-4" />
          </button>

          {/* Project name (editable) */}
          {editingName ? (
            <div className="flex items-center gap-2 pr-10 mb-2">
              <input className="pinput text-base font-bold flex-1" value={editName}
                onChange={e => setEditName(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === "Enter") setEditingName(false) }} />
              <button type="button" onClick={() => setEditingName(false)}
                className="shrink-0 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">✓ OK</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pr-10 mb-1.5 group">
              <h2 className="text-base font-bold leading-snug line-clamp-2 flex-1">{editName || project.clientName}</h2>
              <button type="button" title="Ganti nama" aria-label="Ganti nama project" onClick={() => setEditingName(true)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all shrink-0">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Location */}
          {project.location && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
              <MapPin className="h-3 w-3" /> {project.location}
            </p>
          )}

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {project.status === "SELESAI" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/12 text-green-700 border border-green-500/25 px-2.5 py-1 text-[11px] font-bold dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" /> Selesai
              </span>
            )}
            {project.status === "BERJALAN" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/25 px-2.5 py-1 text-[11px] font-bold">
                <CircleDot className="h-3 w-3" /> Berjalan
              </span>
            )}
            {project.status === "TERTUNGGAK" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive border border-destructive/25 px-2.5 py-1 text-[11px] font-bold">
                <AlertTriangle className="h-3 w-3" /> Tertunggak
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {CAT_ICON[project.category]} {project.category}
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">{project.invoiceCount} invoice</span>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <div className="flex border-b bg-muted/20">
          {(["overview","biaya","invoice"] as const).map(t => (
            <button key={t} type="button" className={`ptab ${tab===t?"on":""}`} onClick={() => setTab(t)}>
              {t === "overview" ? "📊 Overview" : t === "biaya" ? "💰 Biaya" : "📄 Invoice"}
            </button>
          ))}
        </div>

        {/* ── Content ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-r-transparent animate-spin" />
              Memuat data...
            </div>
          ) : tab === "overview" ? (

            /* ── OVERVIEW ─────────────────────────────────────────── */
            <div className="p-5 space-y-4">

              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-[11px] text-muted-foreground font-medium mb-1">Nilai Kontrak</p>
                  <p className="text-base font-black font-mono">{fShort(contractVal)}</p>
                </div>
                <div className={`rounded-2xl border p-4 ${project.totalOutstanding > 0 ? "border-destructive/25 bg-destructive/5" : "border-green-500/25 bg-green-500/5"}`}>
                  <p className="text-[11px] text-muted-foreground font-medium mb-1">Outstanding</p>
                  <p className={`text-base font-black font-mono ${project.totalOutstanding > 0 ? "text-destructive" : "text-green-600"}`}>
                    {project.totalOutstanding > 0 ? fShort(project.totalOutstanding) : "Lunas ✓"}
                  </p>
                </div>
              </div>

              {/* Billing progress */}
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Progress Tagihan</span>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {Math.round(project.billingProgress)}%
                  </span>
                </div>
                <div className="pbar-bg">
                  <div className={`pbar-fill ${project.status==="SELESAI"?"pbar-green":"pbar-blue"}`}
                    style={{"--w":`${Math.round(project.billingProgress)}%`} as React.CSSProperties} />
                </div>
                <p className="text-[11px] text-muted-foreground">{project.paidCount} dari {project.invoiceCount} invoice terbayar</p>
              </div>

              {/* Physical progress */}
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Progress Fisik (di Lapangan)</span>
                  <span className="text-xl font-black text-primary">{editProg}%</span>
                </div>
                <input type="range" min={0} max={100} step={1} value={editProg}
                  onChange={e => setEditProg(Number(e.target.value))}
                  className="pslider" title="Progress fisik" aria-label="Progress fisik di lapangan" />
                <div className="flex justify-between text-[10px] text-muted-foreground/60">
                  <span>0% — Belum mulai</span><span>50%</span><span>100% — Selesai</span>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground block">Catatan PM</label>
                <textarea className="pinput resize-none" rows={3}
                  placeholder="Progress lapangan, kendala, catatan penting..."
                  value={editNotes} onChange={e => setEditNotes(e.target.value)} />
              </div>

              <button type="button" onClick={save} disabled={saving}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-60 ${savedOk ? "bg-green-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
                {saving ? <><div className="h-4 w-4 border-2 border-white/40 border-r-transparent rounded-full animate-spin" /> Menyimpan...</>
                  : savedOk ? "✓ Tersimpan!" : <><Save className="h-4 w-4" /> Simpan Perubahan</>}
              </button>

              {/* Margin preview */}
              {costs.length > 0 && (
                <div className={`rounded-2xl border p-4 ${margin >= 0 ? "border-green-500/25 bg-green-500/5" : "border-destructive/25 bg-destructive/5"}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Net Margin</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Kontrak − Total Biaya</p>
                      <p className={`text-lg font-black font-mono ${margin >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
                        {fIDR(margin)}
                      </p>
                    </div>
                    <span className={`text-3xl font-black leading-none ${margin >= 0 ? "text-green-500" : "text-destructive"}`}>
                      {marginPct >= 0 ? "+" : ""}{marginPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

          ) : tab === "biaya" ? (

            /* ── BIAYA ────────────────────────────────────────────── */
            <div className="p-5 space-y-5">
              {/* Add form */}
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-primary" /> Tambah Biaya
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {COST_CATS.map(c => (
                    <button key={c.key} type="button"
                      className={`ccat-btn ${ccat===c.key?"on":""}`}
                      onClick={() => setCcat(c.key)}>{c.label}</button>
                  ))}
                </div>
                <input className="pinput" placeholder="Deskripsi biaya..." value={cdesc} onChange={e => setCdesc(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="pinput" placeholder="Jumlah (Rp)" value={camt} onChange={e => setCamt(e.target.value)} />
                  <input type="date" className="pinput" title="Tanggal biaya" aria-label="Tanggal biaya" value={cdate} onChange={e => setCdate(e.target.value)} />
                </div>
                {cerr && <p className="text-xs text-destructive">{cerr}</p>}
                <button type="button" onClick={addCost} disabled={adding}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {adding ? "Menambahkan..." : <><Plus className="h-4 w-4" /> Tambah Biaya</>}
                </button>
              </div>

              {/* Cost list */}
              {costs.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">Belum ada biaya dicatat</p>
                  <p className="text-xs mt-1 opacity-60">Tambah material, subkon, orang harian, dll.</p>
                </div>
              ) : (
                <div>
                  {costs.map(c => {
                    const catInfo = COST_CATS.find(x => x.key === c.category)
                    return (
                      <div key={c.id} className="cost-row">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className="shrink-0 mt-0.5 text-[10px] font-bold rounded-full bg-muted border px-2 py-0.5 text-muted-foreground whitespace-nowrap">
                            {catInfo?.label ?? c.category}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold line-clamp-2">{c.description}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {c.cost_date && `${c.cost_date} · `}{c.input_by}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <p className="text-xs font-bold font-mono">{fIDR(c.amount)}</p>
                          <button type="button" title="Hapus" aria-label="Hapus biaya" onClick={() => delCost(c.id)}
                            className="text-muted-foreground/30 hover:text-destructive transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Summary */}
              {costs.length > 0 && (
                <div className="rounded-2xl border bg-muted/20 p-4 space-y-2.5">
                  {[
                    { label: "Total Biaya", val: fIDR(totalCosts), cls: "text-destructive" },
                    { label: "Nilai Kontrak", val: fIDR(contractVal), cls: "" },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className={`font-bold font-mono ${r.cls}`}>{r.val}</span>
                    </div>
                  ))}
                  <div className="border-t border-border/60 pt-2.5 flex justify-between items-end">
                    <span className="text-sm font-bold">Net Margin</span>
                    <div className="text-right">
                      <p className={`text-base font-black font-mono ${margin >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {fIDR(margin)}
                      </p>
                      <p className={`text-xs font-bold ${margin >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {marginPct >= 0 ? "+" : ""}{marginPct.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

          ) : (

            /* ── INVOICE ──────────────────────────────────────────── */
            <div className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">
                {project.invoiceCount} Invoice dalam proyek ini
              </p>
              {project.invoices.map((inv, idx) => (
                <div key={inv.invoice_no} className="inv-row">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 h-6 w-6 shrink-0 flex items-center justify-center rounded-full text-[10px] font-black ${inv.status === "PAID" ? "bg-green-500 text-white" : "bg-muted border text-muted-foreground"}`}>
                      {inv.status === "PAID" ? "✓" : idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[11px] font-mono font-semibold text-muted-foreground">{inv.invoice_no}</span>
                        {inv.po_number && (
                          <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded">PO: {inv.po_number}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">{inv.description}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">{inv.date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold font-mono">{fShort(inv.total)}</p>
                      <p className={`text-[11px] font-bold ${inv.status === "PAID" ? "text-green-600" : "text-destructive"}`}>
                        {inv.status === "PAID" ? "LUNAS" : "UNPAID"}
                      </p>
                      {inv.payment_value > 0 && (
                        <p className="text-[10px] text-muted-foreground">Bayar: {fShort(inv.payment_value)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const pct  = Math.round(project.billingProgress)
  const MAX  = 7
  const stCls = project.status === "SELESAI" ? "st-selesai" : project.status === "TERTUNGGAK" ? "st-tertunggak" : "st-berjalan"
  const accCls = project.status === "SELESAI" ? "acc-selesai" : project.status === "TERTUNGGAK" ? "acc-tertunggak" : "acc-berjalan"
  const barCls = project.status === "SELESAI" ? "pbar-green" : project.status === "TERTUNGGAK" ? "pbar-red" : "pbar-blue"

  return (
    <div className={`pcard ${stCls}`} onClick={onClick}>
      {/* Colored accent stripe */}
      <div className={`pcard-accent ${accCls}`} />

      <div className="pcard-body">
        {/* Top row: badges + count */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {project.status === "SELESAI" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/12 text-green-700 border border-green-500/25 px-2 py-0.5 text-[10px] font-bold dark:text-green-400">
                <CheckCircle2 className="h-2.5 w-2.5" /> SELESAI
              </span>
            )}
            {project.status === "BERJALAN" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/25 px-2 py-0.5 text-[10px] font-bold">
                <CircleDot className="h-2.5 w-2.5" /> BERJALAN
              </span>
            )}
            {project.status === "TERTUNGGAK" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive border border-destructive/25 px-2 py-0.5 text-[10px] font-bold">
                <AlertTriangle className="h-2.5 w-2.5" /> TERTUNGGAK
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {CAT_ICON[project.category]} {CAT_LABEL[project.category]}
            </span>
          </div>
          <span className="shrink-0 text-[10px] font-semibold text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5 border border-border/50">
            {project.invoiceCount} inv
          </span>
        </div>

        {/* Client name */}
        <h3 className="text-[15px] font-bold leading-snug line-clamp-1 mb-0.5 tracking-tight">{project.clientName}</h3>
        {project.location && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground mb-3">
            <MapPin className="h-2.5 w-2.5 shrink-0" /> {project.location}
          </p>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
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

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5 text-[11px]">
            <span className="text-muted-foreground">{project.paidCount}/{project.invoiceCount} invoice terbayar</span>
            <span className="font-bold text-foreground">{pct}%</span>
          </div>
          <div className="pbar-bg">
            <div className={`pbar-fill ${barCls}`} style={{ "--w": `${pct}%` } as React.CSSProperties} />
          </div>
        </div>

        {/* Termins */}
        {project.invoiceCount > 1 && (
          <div className="tl mb-4">
            {project.termins.slice(0, MAX).map((t, idx) => {
              const ok   = t.invoice.status === "PAID"
              const warn = !ok && project.status === "TERTUNGGAK"
              const prevOk = idx > 0 && project.termins[idx - 1].invoice.status === "PAID"
              return (
                <div key={t.invoice.invoice_no}
                  className={`tl-item ${ok ? "is-ok" : ""} ${prevOk ? "prev-ok" : ""}`}
                  title={`${t.label} · ${fIDR(t.invoice.total)} · ${t.invoice.status}`}>
                  <div className={`tl-dot ${ok ? "ok" : warn ? "warn" : "no"}`}>
                    {ok ? "✓" : idx + 1}
                  </div>
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
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground">
              {project.firstDate === project.lastDate
                ? project.firstDate
                : `${project.firstDate} — ${project.lastDate}`}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-primary flex items-center gap-0.5 hover:text-primary/80">
            Detail →
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
  const [search, setSearch]             = React.useState("")
  const [filterStatus, setFilterStatus] = React.useState("Semua")
  const [filterCat, setFilterCat]       = React.useState("Semua")
  const [selected, setSelected]         = React.useState<Project | null>(null)

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
    if (filterCat !== "Semua")    list = list.filter(p => p.category === filterCat)
    return list
  }, [allProjects, search, filterStatus, filterCat])

  const hasFilter = !!search || filterStatus !== "Semua" || filterCat !== "Semua"
  const STATUSES = ["Semua", "TERTUNGGAK", "BERJALAN", "SELESAI"]
  const CATS     = ["Semua", "Maintenance", "Material/PAC", "Project/Instalasi", "Jasa"]

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />

        <div className="flex flex-1 flex-col gap-6 p-6">

          {/* ── Header ─────────────────────────────────────────────── */}
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
                <button type="button" onClick={() => setFilterStatus(p => p==="TERTUNGGAK"?"Semua":"TERTUNGGAK")}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${filterStatus==="TERTUNGGAK"?"bg-destructive text-white border-destructive shadow-lg":"bg-destructive/8 text-destructive border-destructive/25 hover:bg-destructive/15"}`}>
                  <AlertTriangle className="h-3 w-3" /> {stats.tertunggak} tertunggak
                </button>
              )}
              <button type="button" onClick={() => setFilterStatus(p => p==="BERJALAN"?"Semua":"BERJALAN")}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${filterStatus==="BERJALAN"?"bg-primary text-primary-foreground border-primary shadow-lg":"bg-primary/8 text-primary border-primary/20 hover:bg-primary/15"}`}>
                <CircleDot className="h-3 w-3" /> {stats.berjalan} berjalan
              </button>
              <button type="button" onClick={() => setFilterStatus(p => p==="SELESAI"?"Semua":"SELESAI")}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${filterStatus==="SELESAI"?"bg-green-600 text-white border-green-600 shadow-lg":"bg-green-500/8 text-green-700 border-green-500/20 hover:bg-green-500/15 dark:text-green-400"}`}>
                <CheckCircle2 className="h-3 w-3" /> {stats.selesai} selesai
              </button>
            </div>
          </div>

          {/* ── KPI Cards ──────────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {([
              { sc:"s1", title:"Total Proyek",  val:stats.total,           fmt:(v: number)=>String(v), sub:`${raw.length} invoice`, icon:<FolderKanban className="h-4 w-4 text-muted-foreground"/>, cls:"" },
              { sc:"s2", title:"Nilai Kontrak", val:stats.totalValue,      fmt:fShort,                 sub:`gross ${periodLabel}`,   icon:<Receipt className="h-4 w-4 text-muted-foreground"/>,        cls:"text-lg font-bold" },
              { sc:"s3", title:"Selesai",       val:stats.selesai,         fmt:(v: number)=>String(v), sub:`${stats.total>0?((stats.selesai/stats.total)*100).toFixed(0):0}% dari total`, icon:<CheckCircle2 className="h-4 w-4 text-green-600"/>, cls:"text-green-600" },
              { sc:"s4", title:"Outstanding",   val:stats.totalOut,        fmt:fShort,                 sub:`${stats.tertunggak+stats.berjalan} proyek belum lunas`, icon:<AlertTriangle className="h-4 w-4 text-destructive"/>, cls:stats.totalOut>0?"text-destructive text-lg font-bold":"text-green-600" },
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

          {/* ── Status bar ─────────────────────────────────────────── */}
          <div className="u2">
            <Card className="hvc rounded-2xl">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-[180px] space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Distribusi status</span>
                      <span className="font-semibold text-foreground">{stats.total} proyek</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden flex gap-0.5">
                      {stats.tertunggak > 0 && <div className="h-full bg-destructive rounded-l-full" style={{ width:`${(stats.tertunggak/stats.total)*100}%` }} />}
                      {stats.berjalan   > 0 && <div className="h-full bg-primary" style={{ width:`${(stats.berjalan/stats.total)*100}%` }} />}
                      {stats.selesai    > 0 && <div className="h-full bg-green-500 rounded-r-full" style={{ width:`${(stats.selesai/stats.total)*100}%` }} />}
                    </div>
                  </div>
                  <div className="flex gap-5 shrink-0 flex-wrap">
                    {[
                      {l:"Tertunggak",c:stats.tertunggak,bg:"bg-destructive",s:"TERTUNGGAK"},
                      {l:"Berjalan",  c:stats.berjalan,  bg:"bg-primary",    s:"BERJALAN"},
                      {l:"Selesai",   c:stats.selesai,   bg:"bg-green-500",  s:"SELESAI"},
                    ].map(x => (
                      <button key={x.l} type="button" onClick={() => setFilterStatus(p => p===x.s?"Semua":x.s)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all ${filterStatus===x.s?"bg-primary/10 text-primary font-black ring-1 ring-primary/30":"text-muted-foreground hover:text-foreground"}`}>
                        <span className={`h-2 w-2 rounded-full ${x.bg}`} />
                        {x.l} <span className="font-bold text-foreground ml-0.5">{x.c}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Filter ─────────────────────────────────────────────── */}
          <div className="u3">
            <Card className="hvc rounded-2xl overflow-hidden">
              <div className="px-6 py-3 border-b bg-primary/5 flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-[11px] font-black uppercase tracking-wider text-primary/80">Filter & Cari</span>
              </div>
              <CardContent className="py-4 px-6 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Cari klien, no. invoice, no. PO..."
                    className="sbox w-full" />
                  {search && (
                    <button type="button" title="Hapus" onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-muted-foreground font-medium mr-1">Status:</span>
                  {STATUSES.map(s => (
                    <button key={s} type="button" onClick={() => setFilterStatus(s)} className={`chip ${filterStatus===s?"on":""}`}>
                      {s === "Semua" ? `Semua (${stats.total})` : s}
                    </button>
                  ))}
                  <span className="mx-1 h-4 w-px bg-border" />
                  <span className="text-muted-foreground font-medium mr-1">Tipe:</span>
                  {CATS.map(c => (
                    <button key={c} type="button" onClick={() => setFilterCat(c)} className={`chip ${filterCat===c?"on":""}`}>{c}</button>
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

          {/* ── Grid ───────────────────────────────────────────────── */}
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

        {/* Detail Panel */}
        {selected && <DetailPanel project={selected} onClose={() => setSelected(null)} />}

      </SidebarInset>
    </SidebarProvider>
  )
}
