"use client"

import * as React from "react"
import {
  AlertTriangle, Clock, CheckCircle2, TrendingDown,
  Search, Bell, X, Download, RefreshCw,
  Calendar, FileText, ChevronRight, Tag,
} from "lucide-react"
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
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
type AgingInvoice = Invoice & {
  daysOutstanding: number
  clientName: string
  bucket: "0-30" | "31-60" | "61-90" | "90+"
  urgency: "low" | "medium" | "high" | "critical"
}
type PriorityClient = {
  name: string
  total: number
  count: number
  maxDays: number
  urgency: AgingInvoice["urgency"]
  invoices: AgingInvoice[]
}

// ─── Config ───────────────────────────────────────────────────────────────────
const TODAY = new Date("2026-02-21")

const BCFG = {
  "0-30":  { label: "0–30 Hari",  fill: "bg-amber-500",  text: "text-amber-500",  border: "border-amber-500/40",  dot: "bg-amber-400",  strip: "#f59e0b", hex: "#f59e0b" },
  "31-60": { label: "31–60 Hari", fill: "bg-orange-500", text: "text-orange-500", border: "border-orange-500/40", dot: "bg-orange-400", strip: "#f97316", hex: "#f97316" },
  "61-90": { label: "61–90 Hari", fill: "bg-red-500",    text: "text-red-500",    border: "border-red-500/40",    dot: "bg-red-400",    strip: "#ef4444", hex: "#ef4444" },
  "90+":   { label: "90+ Hari",   fill: "bg-rose-700",   text: "text-rose-700",   border: "border-rose-700/40",   dot: "bg-rose-600",   strip: "#be123c", hex: "#be123c" },
} as const

const URG_LABEL: Record<string, string> = { low:"Normal", medium:"Perhatian", high:"Mendesak", critical:"Kritis" }
const URG_STYLE: Record<string, string> = {
  low:      "bg-amber-500/10 text-amber-700 border border-amber-500/30 dark:text-amber-400",
  medium:   "bg-orange-500/10 text-orange-700 border border-orange-500/30 dark:text-orange-400",
  high:     "bg-red-500/10 text-red-700 border border-red-500/30 dark:text-red-400",
  critical: "bg-rose-700/10 text-rose-800 border border-rose-700/35 dark:text-rose-400",
}
const BUCKET_URG_STYLE: Record<string, string> = {
  "0-30": URG_STYLE.low, "31-60": URG_STYLE.medium, "61-90": URG_STYLE.high, "90+": URG_STYLE.critical,
}



// ─── Formatters ───────────────────────────────────────────────────────────────
const fIDR   = (n: number) => new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(n)
const fShort = (n: number) => n >= 1e9 ? `${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `${(n/1e6).toFixed(0)}M` : `${(n/1e3).toFixed(0)}K`

// ─── Logic ────────────────────────────────────────────────────────────────────
function calcAging(raw: Invoice[]): AgingInvoice[] {
  return raw
    .filter(i => i.status === "UNPAID")
    .map(i => {
      const days    = Math.floor((TODAY.getTime() - new Date(i.date).getTime()) / 86_400_000)
      const bucket  : AgingInvoice["bucket"]  = days<=30?"0-30":days<=60?"31-60":days<=90?"61-90":"90+"
      const urgency : AgingInvoice["urgency"] = days<=30?"low":days<=60?"medium":days<=90?"high":"critical"
      const clientName = i.customer.includes("(") ? i.customer.split("(")[0].trim() : i.customer.trim()
      return { ...i, daysOutstanding:days, clientName, bucket, urgency }
    })
    .sort((a,b) => b.daysOutstanding - a.daysOutstanding)
}

function buildPriority(aging: AgingInvoice[]): PriorityClient[] {
  const map = new Map<string, PriorityClient>()
  for (const inv of aging) {
    if (!map.has(inv.clientName)) {
      map.set(inv.clientName, { name:inv.clientName, total:0, count:0, maxDays:0, urgency:"low", invoices:[] })
    }
    const c = map.get(inv.clientName)!
    c.total += inv.total
    c.count++
    c.invoices.push(inv)
    if (inv.daysOutstanding > c.maxDays) { c.maxDays = inv.daysOutstanding; c.urgency = inv.urgency }
  }
  return Array.from(map.values()).sort((a,b)=>b.total-a.total).slice(0,8)
}

function exportCSV(data: AgingInvoice[]) {
  const headers = ["Invoice No","Client","Date","Days","Bucket","Urgency","Total IDR","DPP","PPN"]
  const rows    = data.map(i=>[i.invoice_no,`"${i.clientName}"`,i.date,i.daysOutstanding,i.bucket,URG_LABEL[i.urgency],i.total,i.dpp,i.ppn])
  const csv     = [headers,...rows].map(r=>r.join(",")).join("\n")
  Object.assign(document.createElement("a"),{
    href:URL.createObjectURL(new Blob([csv],{type:"text/csv"})),
    download:`aging-${TODAY.toISOString().slice(0,10)}.csv`,
  }).click()
}

async function exportPDF(
  aging: AgingInvoice[],
  stats: { totalOutstanding:number; criticalValue:number; avgDays:number; paidCount:number; totalInvoices:number; buckets:Record<string,AgingInvoice[]> },
  priority: PriorityClient[],
  G: number
) {
  const { default: jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" })
  const W=210, mg=16

  doc.setFillColor(30,64,175); doc.rect(0,0,W,30,"F")
  doc.setTextColor(255,255,255); doc.setFontSize(15); doc.setFont("helvetica","bold")
  doc.text("LIFECYCLE & AGING REPORT 2025", mg, 13)
  doc.setFontSize(8); doc.setFont("helvetica","normal")
  doc.text("PT TRI BANGUN UP  ·  Laporan Piutang & Penagihan Invoice", mg, 21)
  doc.text(`Dicetak: ${new Date().toLocaleDateString("id-ID",{dateStyle:"long"})}`, W-mg, 21, {align:"right"})

  const bw=(W-mg*2-9)/4
  ;[
    {label:"Total Outstanding",value:fIDR(stats.totalOutstanding)},
    {label:"Nilai Kritis 90+", value:fIDR(stats.criticalValue)},
    {label:"Rata-rata Umur",   value:`${stats.avgDays} hari`},
    {label:"Invoice Lunas",    value:`${stats.paidCount} / ${stats.totalInvoices}`},
  ].forEach((k,i)=>{
    const x=mg+i*(bw+3)
    doc.setFillColor(245,247,250); doc.roundedRect(x,36,bw,18,2,2,"F")
    doc.setFontSize(6.5); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100)
    doc.text(k.label,x+3,42)
    doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(20,20,20)
    doc.text(k.value,x+3,50)
  })

  let y=62
  doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30)
  doc.text("Aging Breakdown",mg,y); y+=5
  const bCols:Record<string,[number,number,number]>={"0-30":[214,120,30],"31-60":[210,80,40],"61-90":[205,60,60],"90+":[180,30,30]}
  const bw2=(W-mg*2-9)/4
  Object.entries(BCFG).forEach(([key,cfg],i)=>{
    const list=stats.buckets[key] as AgingInvoice[]
    const val=list.reduce((s,inv)=>s+inv.total,0)
    const pct=G>0?(val/G*100):0
    const x=mg+i*(bw2+3), col=bCols[key]
    doc.setFillColor(248,249,250); doc.roundedRect(x,y,bw2,22,2,2,"F")
    doc.setDrawColor(col[0],col[1],col[2]); doc.setLineWidth(0.5); doc.line(x,y,x,y+22)
    doc.setFontSize(6); doc.setFont("helvetica","bold"); doc.setTextColor(col[0],col[1],col[2])
    doc.text(cfg.label,x+4,y+5)
    doc.setFontSize(11); doc.setTextColor(20,20,20)
    doc.text(String(list.length),x+4,y+13)
    doc.setFontSize(6); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100)
    doc.text(`${fShort(val)}  ·  ${pct.toFixed(1)}%`,x+4,y+19)
  })
  y+=30

  doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30)
  doc.text("Prioritas Follow-up",mg,y); y+=5
  priority.forEach((c,i)=>{
    const pct=G>0?(c.total/G*100):0
    doc.setFillColor(i%2===0?248:255,249,250); doc.rect(mg,y,W-mg*2,11,"F")
    doc.setFontSize(6.5); doc.setFont("helvetica","normal"); doc.setTextColor(120,120,120)
    doc.text(`#${i+1}`,mg+2,y+4)
    doc.setFontSize(7.5); doc.setFont("helvetica","bold"); doc.setTextColor(20,20,20)
    doc.text(c.name.slice(0,50),mg+10,y+4)
    doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(100,100,100)
    doc.text(`${fIDR(c.total)}  ·  ${c.count} inv  ·  maks ${c.maxDays} hari  ·  ${URG_LABEL[c.urgency]}`,mg+10,y+9)
    doc.setFillColor(220,225,235); doc.rect(W-mg-40,y+3,40,2.5,"F")
    doc.setFillColor(30,64,175); doc.rect(W-mg-40,y+3,40*Math.min(pct*3,100)/100,2.5,"F")
    y+=12
  })
  y+=4

  if(y>230){doc.addPage();y=16}
  doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30)
  doc.text("Daftar Invoice Outstanding",mg,y); y+=5
  const cw=[0.16,0.28,0.30,0.10,0.16].map(p=>(W-mg*2)*p)
  doc.setFillColor(30,64,175); doc.rect(mg,y,W-mg*2,6.5,"F")
  doc.setTextColor(255,255,255); doc.setFontSize(6.5); doc.setFont("helvetica","bold")
  let cx=mg
  ;["Invoice No","Klien","Deskripsi","Hari","Nilai"].forEach((h,i)=>{doc.text(h,cx+2,y+4.5);cx+=cw[i]})
  y+=6.5
  aging.forEach((inv,idx)=>{
    if(y>270){doc.addPage();y=16}
    doc.setFillColor(idx%2===0?249:255,250,251); doc.rect(mg,y,W-mg*2,7,"F")
    doc.setTextColor(30,30,30); doc.setFont("helvetica","normal"); doc.setFontSize(6)
    cx=mg
    const desc = inv.description.length > 45 ? inv.description.slice(0,45)+"…" : inv.description
    ;[inv.invoice_no,inv.clientName.slice(0,30),desc,String(inv.daysOutstanding),fIDR(inv.total)]
      .forEach((v,i)=>{doc.text(v,cx+2,y+4.5);cx+=cw[i]})
    y+=7
  })
  doc.setFillColor(30,64,175); doc.rect(mg,y,W-mg*2,7,"F")
  doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(7)
  cx=mg
  ;["TOTAL","","",`${aging.length} inv`,fIDR(G)].forEach((v,i)=>{doc.text(v,cx+2,y+5);cx+=cw[i]})

  const pages=(doc as any).internal.getNumberOfPages()
  for(let p=1;p<=pages;p++){
    doc.setPage(p)
    doc.setFillColor(245,247,250); doc.rect(0,285,W,12,"F")
    doc.setTextColor(130,130,130); doc.setFontSize(6.5); doc.setFont("helvetica","normal")
    doc.text("Dokumen ini dibuat otomatis dari sistem Dashboard PT Tri Bangun Up",mg,292)
    doc.text(`KONFIDENSIAL  ·  Halaman ${p} / ${pages}`,W-mg,292,{align:"right"})
  }
  doc.save(`Lifecycle-Aging-${TODAY.toISOString().slice(0,10)}.pdf`)
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes scaleIn { from{opacity:0;transform:scale(0.93)}      to{opacity:1;transform:scale(1)} }
  @keyframes fillBar { from{width:0!important} }
  @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.25} }
  @keyframes slideIn { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }

  .a-u1{animation:fadeUp .42s ease both .04s} .a-u2{animation:fadeUp .42s ease both .10s}
  .a-u3{animation:fadeUp .42s ease both .16s} .a-u4{animation:fadeUp .42s ease both .22s}
  .a-s1{animation:scaleIn .38s cubic-bezier(.22,.68,0,1.2) both .06s}
  .a-s2{animation:scaleIn .38s cubic-bezier(.22,.68,0,1.2) both .13s}
  .a-s3{animation:scaleIn .38s cubic-bezier(.22,.68,0,1.2) both .20s}
  .a-s4{animation:scaleIn .38s cubic-bezier(.22,.68,0,1.2) both .27s}
  .bar-fill{animation:fillBar 1.1s cubic-bezier(0.16,1,0.3,1) both .5s}
  .blink{animation:pulse 1.9s ease-in-out infinite}
  .slide-in{animation:slideIn .28s cubic-bezier(.22,.68,0,1.2) both}

  .kpi-card{transition:transform .2s ease,box-shadow .2s ease;cursor:pointer}
  .kpi-card:hover{transform:translateY(-3px) scale(1.012)}
  .kpi-default:hover{box-shadow:0 8px 24px -4px hsl(var(--primary)/.18)}
  .kpi-red:hover    {box-shadow:0 8px 24px -4px rgb(239 68 68/.22);border-color:rgb(239 68 68)!important}
  .kpi-amber:hover  {box-shadow:0 8px 24px -4px rgb(245 158 11/.22);border-color:rgb(245 158 11)!important}
  .kpi-green:hover  {box-shadow:0 8px 24px -4px rgb(34 197 94/.22);border-color:rgb(34 197 94)!important}

  .pdf-btn{position:relative;overflow:hidden;transition:transform .16s ease,box-shadow .16s ease}
  .pdf-btn:not(:disabled):hover{transform:translateY(-2px);box-shadow:0 8px 20px -4px hsl(var(--primary)/.5)}
  .pdf-btn:not(:disabled):active{transform:scale(.96);box-shadow:none}
  .pdf-btn::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,hsl(0 0% 100%/.18),transparent);background-size:200% 100%;opacity:0;transition:opacity .2s}
  .pdf-btn:not(:disabled):hover::after{opacity:1;animation:shimmer .7s ease both}

  .hv-card{transition:box-shadow .2s ease}
  .hv-card:hover{box-shadow:0 4px 18px -4px hsl(var(--primary)/.10)}

  .bucket-card{
    position:relative;overflow:hidden;border-radius:var(--radius);
    border:1px solid hsl(var(--border));background:hsl(var(--card));
    padding:16px 14px 14px 18px;cursor:pointer;text-align:left;width:100%;
    transition:transform .18s ease,box-shadow .18s ease,border-color .15s;
  }
  .bucket-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px -6px hsl(0 0% 0%/.18)}
  .bucket-card.active{border-color:hsl(var(--primary));box-shadow:0 0 0 2px hsl(var(--primary)/.14)}
  .b-strip{position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:var(--radius) 0 0 var(--radius)}

  /* ── Priority list ── */
  .p-row{
    display:flex;align-items:center;gap:10px;
    padding:8px 10px;cursor:pointer;
    transition:background .12s;
    border:1px solid transparent;
    border-bottom:1px solid hsl(var(--border)/.5);
  }
  .p-row:hover{background:hsl(var(--muted)/.5)}
  .p-row.p-active{
    background:hsl(var(--primary)/.06);
    border-bottom-color:transparent;
  }

  /* ── Invoice accordion panel (inline below row) ── */
  @keyframes accordionDown {
    from { opacity:0; transform:translateY(-6px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .inv-accordion{
    animation: accordionDown .22s ease both;
    border-bottom:1px solid hsl(var(--border)/.5);
    background:hsl(var(--muted)/.15);
    padding:12px 16px 14px 16px;
  }
  .inv-card{
    background:hsl(var(--card));
    border:1px solid hsl(var(--border));
    border-radius:10px;
    padding:10px 12px;
    transition:box-shadow .15s,border-color .15s;
  }
  .inv-card:hover{
    box-shadow:0 2px 10px -3px hsl(var(--foreground)/.10);
    border-color:hsl(var(--primary)/.3);
  }

  /* ── Table — FULL WIDTH, no horizontal scroll ── */
  .t-wrap{border-radius:var(--radius);overflow:hidden;border:1px solid hsl(var(--border))}
  .t-scroll{overflow-y:auto;max-height:440px}
  .t-scroll::-webkit-scrollbar{width:4px}
  .t-scroll::-webkit-scrollbar-track{background:transparent}
  .t-scroll::-webkit-scrollbar-thumb{background:hsl(var(--border));border-radius:4px}
  .t-row{border-bottom:1px solid hsl(var(--border)/.4);cursor:pointer;transition:background .1s}
  .t-row:last-child{border-bottom:none}
  .t-row:hover{background:hsl(var(--muted)/.45)}
  .t-row.sel{background:hsl(var(--primary)/.06)}
  .t-sort{cursor:pointer;user-select:none;transition:color .12s}
  .t-sort:hover{color:hsl(var(--foreground))}

  .s-bar{height:8px;border-radius:99px;overflow:hidden;display:flex;gap:1.5px}

  .lc-search{
    width:100%;padding:8px 32px 8px 34px;
    background:hsl(var(--muted)/.5);border:1px solid hsl(var(--border));
    border-radius:8px;font-size:13px;color:hsl(var(--foreground));
    outline:none;transition:border-color .14s,box-shadow .14s;
  }
  .lc-search::placeholder{color:hsl(var(--muted-foreground))}
  .lc-search:focus{border-color:hsl(var(--primary)/.5);box-shadow:0 0 0 3px hsl(var(--primary)/.08);background:hsl(var(--card))}

  .lc-chip{
    padding:3px 11px;border-radius:99px;font-size:11.5px;font-weight:500;
    border:1px solid hsl(var(--border));cursor:pointer;
    background:transparent;color:hsl(var(--muted-foreground));
    transition:all .13s;white-space:nowrap;
  }
  .lc-chip:hover{border-color:hsl(var(--primary)/.5);color:hsl(var(--foreground))}
  .lc-chip.on{background:hsl(var(--primary));border-color:hsl(var(--primary));color:hsl(var(--primary-foreground));font-weight:700}

  .pill{
    display:inline-flex;align-items:center;gap:4px;
    padding:1.5px 8px;border-radius:99px;
    font-size:10.5px;font-weight:600;white-space:nowrap;line-height:1.5;
  }

  /* desc tooltip on hover */
  .desc-cell{
    position:relative;max-width:0;overflow:hidden;
    white-space:nowrap;text-overflow:ellipsis;
  }
  .desc-text{
    display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
    font-size:11px;color:hsl(var(--muted-foreground));
  }
`

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LifecyclePage() {
  const raw      = invoicesRaw as Invoice[]
  const aging    = React.useMemo(() => calcAging(raw), [raw])
  const priority = React.useMemo(() => buildPriority(aging), [aging])
  const [pdfLoad, setPdfLoad] = React.useState(false)

  const stats = React.useMemo(() => {
    const totalOutstanding = aging.reduce((s,i)=>s+i.total,0)
    const buckets = {
      "0-30":  aging.filter(i=>i.bucket==="0-30"),
      "31-60": aging.filter(i=>i.bucket==="31-60"),
      "61-90": aging.filter(i=>i.bucket==="61-90"),
      "90+":   aging.filter(i=>i.bucket==="90+"),
    }
    return {
      totalOutstanding, buckets,
      criticalValue: buckets["90+"].reduce((s,i)=>s+i.total,0),
      avgDays: aging.length ? Math.round(aging.reduce((s,i)=>s+i.daysOutstanding,0)/aging.length) : 0,
      paidCount:     raw.filter(i=>i.status==="PAID").length,
      totalInvoices: raw.length,
    }
  }, [aging, raw])

  const [search,        setSearch]        = React.useState("")
  const [activeBucket,  setActiveBucket]  = React.useState("Semua")
  const [sortKey,       setSortKey]       = React.useState<"days"|"value">("days")
  const [sortAsc,       setSortAsc]       = React.useState(false)
  const [selectedInv,   setSelectedInv]   = React.useState<string|null>(null)
  const [activeClient,  setActiveClient]  = React.useState<PriorityClient|null>(null)

  const displayed = React.useMemo(() => {
    let list = [...aging]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i=>i.clientName.toLowerCase().includes(q)||i.invoice_no.toLowerCase().includes(q)||i.description.toLowerCase().includes(q))
    }
    if (activeBucket !== "Semua") list = list.filter(i=>i.bucket===activeBucket)
    list.sort((a,b)=>{
      const d = sortKey==="days" ? b.daysOutstanding-a.daysOutstanding : b.total-a.total
      return sortAsc ? -d : d
    })
    return list
  }, [aging, search, activeBucket, sortKey, sortAsc])

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey===k) setSortAsc(p=>!p); else { setSortKey(k); setSortAsc(false) }
  }

  const G = stats.totalOutstanding

  const handlePDF = async () => {
    setPdfLoad(true)
    try { await exportPDF(aging, stats, priority, G) }
    catch { alert("Gagal export PDF. Jalankan: npm install jspdf") }
    finally { setPdfLoad(false) }
  }

  // Close panel when clicking outside
  React.useEffect(() => {
    if (!activeClient) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setActiveClient(null) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [activeClient])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />

        <div className="flex flex-1 flex-col gap-6 p-6">

          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="a-u1 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold">Lifecycle & Aging</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Monitoring piutang · Outstanding tracker · Follow-up 2025
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {stats.buckets["90+"].length > 0 && (
                <span className="pill bg-rose-500/10 text-rose-700 border border-rose-500/30 dark:text-rose-400">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-600 blink"/>
                  {stats.buckets["90+"].length} kritis
                </span>
              )}
              <span className="pill bg-green-500/10 text-green-700 border border-green-500/30 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3"/>
                {stats.paidCount} lunas
              </span>
              <button
                onClick={()=>exportCSV(displayed)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <Download className="h-3.5 w-3.5"/> CSV
              </button>
              <button
                onClick={handlePDF} disabled={pdfLoad}
                className="pdf-btn flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60"
              >
                {pdfLoad
                  ? <><RefreshCw className="h-4 w-4 animate-spin"/> Menyiapkan...</>
                  : <><Download className="h-4 w-4"/> Export PDF</>}
              </button>
            </div>
          </div>

          {/* ── KPI Cards ──────────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="a-s1">
              <Card className="kpi-card kpi-default">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Total Outstanding</CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fIDR(stats.totalOutstanding)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{aging.length} invoice belum terbayar</p>
                </CardContent>
              </Card>
            </div>
            <div className="a-s2">
              <Card className="kpi-card kpi-red">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Nilai Kritis 90+</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500"/>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{fIDR(stats.criticalValue)}</div>
                  <p className="text-xs text-red-600 mt-1">
                    {G>0?((stats.criticalValue/G)*100).toFixed(1):0}% dari total outstanding
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="a-s3">
              <Card className="kpi-card kpi-amber">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Rata-rata Umur</CardTitle>
                  <Clock className="h-4 w-4 text-amber-500"/>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.avgDays}
                    <span className="text-sm font-normal text-muted-foreground ml-1">hari</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Per invoice outstanding</p>
                </CardContent>
              </Card>
            </div>
            <div className="a-s4">
              <Card className="kpi-card kpi-green">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Invoice Lunas</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-600"/>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.paidCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">dari {stats.totalInvoices} total invoice</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Aging Breakdown ────────────────────────────────────── */}
          <div className="a-u2">
            <Card className="hv-card">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle>Aging Breakdown</CardTitle>
                    <CardDescription>Distribusi invoice outstanding · klik bucket untuk filter tabel</CardDescription>
                  </div>
                  <span className="text-sm tabular-nums font-semibold text-muted-foreground">{fIDR(G)}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {(Object.entries(BCFG) as [AgingInvoice["bucket"], typeof BCFG["0-30"]][]).map(([key,cfg])=>{
                    const list  = stats.buckets[key]
                    const val   = list.reduce((s,i)=>s+i.total,0)
                    const pct   = G>0?(val/G*100):0
                    const isAct = activeBucket===key
                    return (
                      <button key={key} onClick={()=>setActiveBucket(isAct?"Semua":key)} className={`bucket-card${isAct?" active":""}`}>
                        <div className="b-strip" style={{background:cfg.strip}}/>
                        <div className="flex items-center justify-between mb-2.5">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${cfg.text}`}>{cfg.label}</span>
                          <span className={`inline-block rounded-full flex-shrink-0 ${cfg.dot}${key==="90+"?" blink":""}`} style={{width:7,height:7}}/>
                        </div>
                        <div className={`text-3xl font-bold leading-none tabular-nums ${cfg.text}`}>{list.length}</div>
                        <p className="text-[11px] text-muted-foreground mt-1 mb-3">invoice</p>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
                          <div className={`bar-fill h-full rounded-full ${cfg.fill}`} style={{width:`${pct}%`}}/>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-muted-foreground">{fShort(val)}</span>
                          <span className={`text-[11px] font-semibold ${cfg.text}`}>{pct.toFixed(1)}%</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Distribusi nilai</span>
                    <span className="font-semibold text-foreground">{fIDR(G)}</span>
                  </div>
                  <div className="s-bar">
                    {(Object.entries(BCFG) as [AgingInvoice["bucket"], typeof BCFG["0-30"]][]).map(([key,cfg])=>{
                      const val=stats.buckets[key].reduce((s,i)=>s+i.total,0)
                      const pct=G>0?(val/G*100):0; if(pct<0.5)return null
                      return (
                        <div key={key} className={`bar-fill h-full ${cfg.fill} first:rounded-l-full last:rounded-r-full`}
                          title={`${cfg.label}: ${fIDR(val)} (${pct.toFixed(1)}%)`} style={{width:`${pct}%`}}/>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    {(Object.entries(BCFG) as [string, typeof BCFG["0-30"]][]).map(([key,cfg])=>{
                      const pct=G>0?(stats.buckets[key as AgingInvoice["bucket"]].reduce((s,i)=>s+i.total,0)/G*100):0
                      return (
                        <div key={key} className="flex items-center gap-1.5">
                          <span className={`inline-block w-2 h-2 rounded-full ${cfg.fill}`}/>
                          <span className="text-xs text-muted-foreground">{cfg.label}</span>
                          <span className={`text-xs font-semibold ${cfg.text}`}>{pct.toFixed(1)}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>


          {/* ── Prioritas Follow-up (Accordion Inline) ────────────── */}
          <div className="a-u3">
            <Card className="hv-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-amber-500"/>
                      <CardTitle>Prioritas Follow-up</CardTitle>
                    </div>
                    <CardDescription className="mt-1">
                      Klik nama klien untuk melihat daftar invoice yang harus dikejar
                    </CardDescription>
                  </div>
                  <span className="text-xs text-muted-foreground border rounded-md px-2 py-1">
                    {priority.length} klien
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">

                {/* List + inline accordion */}
                <div className="divide-y-0">
                  {priority.map((c, idx) => {
                    const pct      = G>0?(c.total/G*100):0
                    const isActive = activeClient?.name === c.name
                    const bKey     = c.urgency==="critical"?"90+":c.urgency==="high"?"61-90":c.urgency==="medium"?"31-60":"0-30"
                    const cfg      = BCFG[bKey]

                    return (
                      <React.Fragment key={c.name}>

                        {/* ── Client Row ── */}
                        <button
                          onClick={()=>setActiveClient(isActive?null:c)}
                          className={`p-row w-full text-left px-5 py-3.5 ${isActive?"p-active":""} ${idx===0?"rounded-t-none":""}`}
                        >
                          {/* Rank */}
                          <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                            {idx+1}
                          </span>

                          {/* Urgency dot */}
                          <span className={`flex-shrink-0 w-2 h-2 rounded-full ${cfg.dot}${c.urgency==="critical"?" blink":""}`}/>

                          {/* Main info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold truncate">{c.name}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`pill ${URG_STYLE[c.urgency]}`} style={{fontSize:9.5}}>
                                  {URG_LABEL[c.urgency]}
                                </span>
                                <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isActive?"rotate-90":""}`}/>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="bar-fill h-full rounded-full" style={{width:`${Math.min(pct*3,100)}%`, background:cfg.hex}}/>
                              </div>
                              <span className="text-[11px] font-mono font-semibold text-muted-foreground flex-shrink-0">{fIDR(c.total)}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] text-muted-foreground">{c.count} invoice</span>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className="text-[10px] text-muted-foreground">maks <span className="font-semibold">{c.maxDays} hari</span></span>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className={`text-[10px] font-semibold ${cfg.text}`}>{pct.toFixed(1)}% dari total</span>
                            </div>
                          </div>
                        </button>

                        {/* ── Invoice Accordion ── tampil INLINE tepat di bawah klien yg diklik ── */}
                        {isActive && (
                          <div className="inv-accordion">

                            {/* ── Header accordion: Nama Klien + total ── */}
                            <div
                              className="rounded-lg mb-3 px-4 py-3 flex items-center justify-between gap-3"
                              style={{
                                background: `${cfg.hex}14`,
                                border: `1px solid ${cfg.hex}40`,
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${cfg.dot}${c.urgency==="critical"?" blink":""}`}/>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-foreground truncate">{c.name}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {c.count} invoice outstanding · maks {c.maxDays} hari
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Total Harus Ditagih</p>
                                <p className="text-base font-bold" style={{color: cfg.hex}}>{fIDR(c.total)}</p>
                              </div>
                            </div>

                            {/* ── Invoice cards — satu card per invoice ── */}
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {c.invoices
                                .sort((a,b) => b.daysOutstanding - a.daysOutstanding)
                                .map((inv, invIdx) => {
                                  const icfg = BCFG[inv.bucket]
                                  return (
                                    <div key={inv.invoice_no} className="inv-card">

                                      {/* ── Invoice header: no + badge ── */}
                                      <div className="flex items-start justify-between gap-2 mb-2.5">
                                        <div>
                                          <p className="text-[11px] font-mono font-bold text-primary leading-tight">{inv.invoice_no}</p>
                                          <p className="text-[10px] text-muted-foreground mt-0.5">{inv.date}</p>
                                        </div>
                                        <span className={`pill flex-shrink-0 ${BUCKET_URG_STYLE[inv.bucket]}`} style={{fontSize:9}}>
                                          <span className={`inline-block rounded-full ${icfg.dot}${inv.bucket==="90+"?" blink":""}`} style={{width:4,height:4}}/>
                                          {inv.daysOutstanding} hari
                                        </span>
                                      </div>

                                      {/* ── Deskripsi pekerjaan ── */}
                                      <p className="text-[10.5px] text-muted-foreground leading-relaxed line-clamp-2 mb-2.5">
                                        {inv.description || "—"}
                                      </p>

                                      {/* ── Separator ── */}
                                      <div className="border-t border-border/50 pt-2">

                                        {/* Nilai baris utama */}
                                        <div className="flex items-center justify-between mb-1.5">
                                          <span className="text-[10px] text-muted-foreground font-medium">Nilai Invoice</span>
                                          <span className="text-xs font-bold text-foreground tabular-nums">{fIDR(inv.total)}</span>
                                        </div>

                                        {/* DPP + PPN baris detail */}
                                        <div className="flex items-center gap-3">
                                          <div className="flex-1 flex items-center justify-between">
                                            <span className="text-[9.5px] text-muted-foreground">DPP</span>
                                            <span className="text-[9.5px] font-semibold text-foreground tabular-nums">{fIDR(inv.dpp)}</span>
                                          </div>
                                          <div className="w-px h-3 bg-border/60"/>
                                          <div className="flex-1 flex items-center justify-between">
                                            <span className="text-[9.5px] text-muted-foreground">PPN</span>
                                            <span className="text-[9.5px] font-semibold text-foreground tabular-nums">{fIDR(inv.ppn)}</span>
                                          </div>
                                        </div>

                                        {/* Keterangan jika ada */}
                                        {inv.keterangan && (
                                          <p className="text-[9.5px] text-amber-600 mt-1.5 font-medium truncate">
                                            ⚠ {inv.keterangan}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )
                              })}
                            </div>

                          </div>
                        )}

                      </React.Fragment>
                    )
                  })}
                </div>

              </CardContent>
            </Card>
          </div>

          {/* ── Tabel Invoice Outstanding — FULL WIDTH, rapi ────────── */}
          <div className="a-u4">
            <Card className="hv-card">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle>Daftar Invoice Outstanding</CardTitle>
                    <CardDescription>Semua invoice belum terbayar · urutkan dan filter sesuai kebutuhan</CardDescription>
                  </div>
                  {/* Filter chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(["Semua","0-30","31-60","61-90","90+"] as const).map(b=>(
                      <button key={b} onClick={()=>setActiveBucket(b)} className={`lc-chip${activeBucket===b?" on":""}`}>
                        {b==="Semua"?`Semua (${aging.length})`:`${b}d (${stats.buckets[b]?.length??0})`}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Search row */}
                <div className="flex items-center gap-3 mt-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"/>
                    <input
                      type="text"
                      placeholder="Cari klien, invoice, atau deskripsi..."
                      value={search}
                      onChange={e=>setSearch(e.target.value)}
                      className="lc-search"
                    />
                    {search && (
                      <button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-3.5 w-3.5"/>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{displayed.length}</span> invoice
                    {activeBucket!=="Semua"&&<> · filter: <span className="text-amber-600 font-medium">{activeBucket} hari</span></>}
                    {search&&<> · cari: <em>"{search}"</em></>}
                  </p>
                </div>
              </CardHeader>

              {/* Table — no horizontal scroll, all columns fit */}
              <CardContent className="p-0">
                <div className="t-wrap mx-6 mb-6">
                  {/* Fixed header */}
                  <div className="bg-muted/50 border-b border-border">
                    <table className="w-full text-xs table-fixed">
                      <colgroup>
                        <col style={{width:"13%"}}/>
                        <col style={{width:"16%"}}/>
                        <col style={{width:"28%"}}/>
                        <col style={{width:"13%"}}/>
                        <col style={{width:"8%"}}/>
                        <col style={{width:"14%"}}/>
                        <col style={{width:"8%"}}/>
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="px-3 py-3 text-left font-semibold text-muted-foreground text-[11px]">Invoice</th>
                          <th className="px-3 py-3 text-left font-semibold text-muted-foreground text-[11px]">Klien</th>
                          <th className="px-3 py-3 text-left font-semibold text-muted-foreground text-[11px]">Deskripsi</th>
                          <th className="px-3 py-3 text-left font-semibold text-muted-foreground text-[11px]">Bucket</th>
                          <th className="px-3 py-3 text-right font-semibold text-muted-foreground text-[11px] t-sort" onClick={()=>toggleSort("days")}>
                            Hari {sortKey==="days"?(sortAsc?"↑":"↓"):<span className="opacity-35">↕</span>}
                          </th>
                          <th className="px-3 py-3 text-right font-semibold text-muted-foreground text-[11px] t-sort" onClick={()=>toggleSort("value")}>
                            Nilai {sortKey==="value"?(sortAsc?"↑":"↓"):<span className="opacity-35">↕</span>}
                          </th>
                          <th className="px-3 py-3 text-center font-semibold text-muted-foreground text-[11px]">Status</th>
                        </tr>
                      </thead>
                    </table>
                  </div>

                  {/* Scrollable body */}
                  <div className="t-scroll">
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col style={{width:"13%"}}/>
                        <col style={{width:"16%"}}/>
                        <col style={{width:"28%"}}/>
                        <col style={{width:"13%"}}/>
                        <col style={{width:"8%"}}/>
                        <col style={{width:"14%"}}/>
                        <col style={{width:"8%"}}/>
                      </colgroup>
                      <tbody>
                        {displayed.length===0?(
                          <tr>
                            <td colSpan={7} className="py-16 text-center">
                              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-40"/>
                              <p className="text-sm font-medium text-muted-foreground">Tidak ada invoice ditemukan</p>
                              <p className="text-xs text-muted-foreground opacity-60 mt-1">Coba ubah filter atau kata kunci pencarian</p>
                            </td>
                          </tr>
                        ):displayed.map(inv=>{
                          const cfg   = BCFG[inv.bucket]
                          const isSel = selectedInv===inv.invoice_no
                          const dClr  = inv.urgency==="critical"||inv.urgency==="high"?"text-red-600":"text-amber-600"
                          return (
                            <React.Fragment key={inv.invoice_no}>
                              <tr
                                className={`t-row${isSel?" sel":""}`}
                                onClick={()=>setSelectedInv(p=>p===inv.invoice_no?null:inv.invoice_no)}
                              >
                                {/* Invoice No + Date */}
                                <td className="px-3 py-3">
                                  <p className="text-[11px] font-mono font-semibold text-primary truncate">{inv.invoice_no}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{inv.date}</p>
                                </td>
                                {/* Client */}
                                <td className="px-3 py-3">
                                  <p className="text-xs font-semibold truncate">{inv.clientName}</p>
                                </td>
                                {/* Description */}
                                <td className="px-3 py-3">
                                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{inv.description}</p>
                                </td>
                                {/* Bucket */}
                                <td className="px-3 py-3">
                                  <span className={`pill ${BUCKET_URG_STYLE[inv.bucket]}`}>
                                    <span className={`inline-block rounded-full ${cfg.dot}${inv.bucket==="90+"?" blink":""}`} style={{width:5,height:5}}/>
                                    {cfg.label}
                                  </span>
                                </td>
                                {/* Days */}
                                <td className="px-3 py-3 text-right">
                                  <span className={`text-sm font-bold tabular-nums ${dClr}`}>{inv.daysOutstanding}</span>
                                  <span className="text-[10px] text-muted-foreground ml-0.5">h</span>
                                </td>
                                {/* Value */}
                                <td className="px-3 py-3 text-right">
                                  <p className="text-xs font-bold tabular-nums truncate">{fIDR(inv.total)}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{fShort(inv.dpp)} DPP</p>
                                </td>
                                {/* Urgency badge */}
                                <td className="px-3 py-3 text-center">
                                  <span className={`pill ${URG_STYLE[inv.urgency]}`} style={{fontSize:9.5}}>
                                    {URG_LABEL[inv.urgency]}
                                  </span>
                                </td>
                              </tr>
                              {/* Expanded row detail */}
                              {isSel && (
                                <tr className="bg-muted/20">
                                  <td colSpan={7} className="px-5 py-3">
                                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                                      <span className="text-muted-foreground">DPP: <span className="font-semibold text-foreground">{fIDR(inv.dpp)}</span></span>
                                      <span className="text-muted-foreground">PPN: <span className="font-semibold text-foreground">{fIDR(inv.ppn)}</span></span>
                                      <span className="text-muted-foreground">Total: <span className="font-semibold text-foreground">{fIDR(inv.total)}</span></span>
                                      {inv.keterangan && <span className="text-muted-foreground">Ket: <span className="font-semibold text-foreground">{inv.keterangan}</span></span>}
                                      {inv.selisih !== 0 && <span className="text-amber-600">Selisih: {fIDR(inv.selisih)}</span>}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{inv.description}</p>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Table footer */}
                  {displayed.length>0&&(
                    <div className="border-t bg-muted/30 px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{displayed.length} invoice ditampilkan</span>
                      <div className="flex items-center gap-5 text-xs text-muted-foreground">
                        <span>Total: <span className="font-semibold text-amber-600 tabular-nums">{fIDR(displayed.reduce((s,i)=>s+i.total,0))}</span></span>
                        <span>Avg: <span className="font-semibold text-foreground">{Math.round(displayed.reduce((s,i)=>s+i.daysOutstanding,0)/displayed.length)} hari</span></span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}