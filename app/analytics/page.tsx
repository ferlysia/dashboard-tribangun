"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts"
import {
  Download, RefreshCw, DollarSign, CreditCard, AlertCircle, Receipt,
  ChevronUp, ChevronDown, Minus, ArrowRight, Sparkles, Info,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useFilteredInvoices } from "@/lib/use-filtered-invoices"

// ─── Chart Configs ────────────────────────────────────────────────────────────
const revenueConfig = {
  revenue: { label: "Revenue", color: "var(--primary)" },
} satisfies ChartConfig

const statusConfig = {
  paid:   { label: "Paid",        color: "var(--primary)"     },
  unpaid: { label: "Outstanding", color: "var(--destructive)" },
} satisfies ChartConfig

const splitConfig = {
  dpp:     { label: "DPP",    color: "var(--primary)" },
  ppn:     { label: "PPN",    color: "#f59e0b"         },
  selisih: { label: "Diskon", color: "#f87171"         },
} satisfies ChartConfig

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes fadeSlideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes scaleIn      { from{opacity:0;transform:scale(0.93)} to{opacity:1;transform:scale(1)} }
  @keyframes growBar      { from{width:0} to{width:var(--bar-w)} }
  @keyframes shimmer      { 0%{background-position:-200% center} 100%{background-position:200% center} }

  .a-up-1{animation:fadeSlideUp .42s ease both .04s}
  .a-up-2{animation:fadeSlideUp .42s ease both .10s}
  .a-up-3{animation:fadeSlideUp .42s ease both .16s}
  .a-up-4{animation:fadeSlideUp .42s ease both .22s}
  .a-up-5{animation:fadeSlideUp .42s ease both .28s}
  .a-up-6{animation:fadeSlideUp .42s ease both .34s}
  .a-up-7{animation:fadeSlideUp .42s ease both .40s}
  .a-up-8{animation:fadeSlideUp .42s ease both .46s}

  .a-sc-1{animation:scaleIn .38s cubic-bezier(.22,.68,0,1.2) both .06s}
  .a-sc-2{animation:scaleIn .38s cubic-bezier(.22,.68,0,1.2) both .13s}
  .a-sc-3{animation:scaleIn .38s cubic-bezier(.22,.68,0,1.2) both .20s}
  .a-sc-4{animation:scaleIn .38s cubic-bezier(.22,.68,0,1.2) both .27s}

  .bar-fill{width:var(--bar-w);animation:growBar 1.1s cubic-bezier(.16,1,.3,1) both;animation-delay:.55s}

  .kpi-card{transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;cursor:pointer}
  .kpi-card:hover{transform:translateY(-3px) scale(1.012)}
  .kpi-default:hover{box-shadow:0 8px 24px -4px hsl(var(--primary)/.18)}
  .kpi-green:hover{box-shadow:0 8px 24px -4px rgb(34 197 94/.22);border-color:rgb(34 197 94)!important}
  .kpi-red:hover{box-shadow:0 8px 24px -4px rgb(239 68 68/.22);border-color:rgb(239 68 68)!important}
  .kpi-amber:hover{box-shadow:0 8px 24px -4px rgb(245 158 11/.22);border-color:rgb(245 158 11)!important}

  .pdf-btn{position:relative;overflow:hidden;transition:transform .16s ease,box-shadow .16s ease}
  .pdf-btn:not(:disabled):hover{transform:translateY(-2px);box-shadow:0 8px 20px -4px hsl(var(--primary)/.5)}
  .pdf-btn:not(:disabled):active{transform:scale(.96)}
  .pdf-btn::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,hsl(0 0% 100%/.18),transparent);background-size:200% 100%;opacity:0;transition:opacity .2s}
  .pdf-btn:not(:disabled):hover::after{opacity:1;animation:shimmer .7s ease both}

  .hv-card{transition:box-shadow .2s ease}
  .hv-card:hover{box-shadow:0 4px 18px -4px hsl(var(--primary)/.10)}

  .tr-hover{transition:background .12s ease}
  .tr-hover:hover{background:hsl(var(--muted)/.45)!important}

  .cl-row{border-radius:8px;transition:background .14s ease,padding-left .14s ease;padding:4px 6px;margin:0 -6px;cursor:pointer}
  .cl-row:hover{background:hsl(var(--muted)/.4);padding-left:10px}

  .exec-chip{transition:transform .18s ease,box-shadow .18s ease}
  .exec-chip:hover{transform:translateY(-2px);box-shadow:0 6px 18px -4px hsl(var(--foreground)/.10)}

  .pie-zoom{transition:transform .2s ease}
  .pie-zoom:hover{transform:scale(1.04)}

  .arrow-nudge{transition:transform .15s ease}
  .arrow-parent:hover .arrow-nudge{transform:translateX(3px)}

  .insight-box{border-radius:10px;padding:10px 13px;background:hsl(var(--muted)/.4);border:1px solid hsl(var(--border));font-size:12px;line-height:1.6;color:hsl(var(--muted-foreground))}
  .insight-box strong{color:hsl(var(--foreground))}
`

const fIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(n)
const fShort = (n: number) =>
  n>=1e9 ? `${(n/1e9).toFixed(1)}B` : n>=1e6 ? `${(n/1e6).toFixed(0)}M` : `${(n/1e3).toFixed(0)}K`
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

export default function AnalyticsPage() {
  const { invoices: raw, periodLabel } = useFilteredInvoices()
  const router = useRouter()
  const [isPdfLoading, setIsPdfLoading] = React.useState(false)

  const stats = React.useMemo(() => {
    const totalRevenue   = raw.reduce((s,i)=>s+(i.total||0),0)
    const totalCollected = raw.reduce((s,i)=>s+(i.payment_value||0),0)
    const totalPPN       = raw.reduce((s,i)=>s+(i.ppn||0),0)
    const totalDPP       = raw.reduce((s,i)=>s+(i.dpp||0),0)
    const totalSelisih   = raw.reduce((s,i)=>s+Math.abs(i.selisih||0),0)
    const totalUnpaid    = raw.filter(i=>i.status==="UNPAID").reduce((s,i)=>s+i.total,0)
    const paidCount      = raw.filter(i=>i.status==="PAID").length
    const unpaidCount    = raw.filter(i=>i.status==="UNPAID").length
    const collectionRate = totalRevenue>0?(totalCollected/totalRevenue)*100:0

    const monthly = MONTHS.map((month,idx)=>{
      const rows = raw.filter(i=>i.month===idx+1)
      const rev  = rows.reduce((s,i)=>s+i.total,0)
      const dpp  = rows.reduce((s,i)=>s+i.dpp,0)
      const ppn  = rows.reduce((s,i)=>s+i.ppn,0)
      const sel  = rows.reduce((s,i)=>s+Math.abs(i.selisih||0),0)
      return { month, revenue:rev, dpp, ppn, selisih:sel, count:rows.length }
    })

    const monthlyWithGrowth = monthly.map((m,idx)=>{
      if(idx===0) return {...m,growth:0}
      const prev = monthly[idx-1].revenue
      return {...m, growth:prev===0?0:+((m.revenue-prev)/prev*100).toFixed(1)}
    })

    const activeMonths = monthlyWithGrowth.filter(m=>m.revenue>0)
    const bestMonth    = [...monthly].sort((a,b)=>b.revenue-a.revenue)[0] ?? { month: "-", revenue: 0, count: 0 }
    const worstMonth   = [...activeMonths].sort((a,b)=>a.revenue-b.revenue)[0] ?? bestMonth
    const avgMonthly   = activeMonths.length>0?totalRevenue/activeMonths.length:0
    const firstWindow  = activeMonths.slice(0,3)
    const lastWindow   = activeMonths.slice(-3)
    const first3       = firstWindow.length>0 ? firstWindow.reduce((s,m)=>s+m.revenue,0)/firstWindow.length : 0
    const last3        = lastWindow.length>0 ? lastWindow.reduce((s,m)=>s+m.revenue,0)/lastWindow.length : 0
    const trend        = first3>0?((last3-first3)/first3)*100:0

    const clientMap: Record<string,number> = {}
    raw.forEach(i=>{
      const name = i.customer.split("(")[0].trim()
      clientMap[name] = (clientMap[name]||0)+i.total
    })
    const topClients = Object.entries(clientMap)
      .map(([name,value])=>({name,value}))
      .sort((a,b)=>b.value-a.value).slice(0,5)

    const pieData = [
      {name:"paid",   label:"Paid",        value:paidCount,   pct:collectionRate},
      {name:"unpaid", label:"Outstanding", value:unpaidCount, pct:totalRevenue>0?(totalUnpaid/totalRevenue)*100:0},
    ]

    const splitMonthly = activeMonths.map(m=>({
      month:m.month, dpp:m.dpp, ppn:m.ppn, selisih:m.selisih,
    }))

    return {
      totalRevenue, totalCollected, totalPPN, totalDPP, totalSelisih,
      totalUnpaid, paidCount, unpaidCount, collectionRate,
      monthly, monthlyWithGrowth, activeMonths,
      bestMonth, worstMonth, avgMonthly, trend,
      topClients, pieData, splitMonthly,
      totalInvoices: raw.length,
    }
  }, [raw])

  // ─── Export PDF ────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setIsPdfLoading(true)
    try {
      const { default: jsPDF } = await import("jspdf")
      const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" })
      const W=210, mg=16

      doc.setFillColor(30,64,175); doc.rect(0,0,W,28,"F")
      doc.setTextColor(255,255,255); doc.setFontSize(15); doc.setFont("helvetica","bold")
      doc.text(`ANALYTICS REPORT ${periodLabel}`,mg,12)
      doc.setFontSize(8); doc.setFont("helvetica","normal")
      doc.text("PT TRI BANGUN UP  ·  Rekap Invoice Strategis",mg,20)
      doc.text(`Dicetak: ${new Date().toLocaleDateString("id-ID",{dateStyle:"long"})}`,W-mg,20,{align:"right"})

      const bw=(W-mg*2-9)/4
      const kpis=[
        {label:"Gross Revenue",value:fIDR(stats.totalRevenue)},
        {label:"Terkumpul",    value:fIDR(stats.totalCollected)},
        {label:"Outstanding",  value:fIDR(stats.totalUnpaid)},
        {label:"PPN Reserve",  value:fIDR(stats.totalPPN)},
      ]
      kpis.forEach((k,i)=>{
        const x=mg+i*(bw+3)
        doc.setFillColor(245,247,250); doc.roundedRect(x,34,bw,18,2,2,"F")
        doc.setFontSize(6.5); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100)
        doc.text(k.label,x+3,40)
        doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(20,20,20)
        doc.text(k.value,x+3,48)
      })

      let y=62
      doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30)
      doc.text("Breakdown Revenue Bulanan",mg,y); y+=5
      const cw=[0.16,0.37,0.14,0.14,0.19].map(p=>(W-mg*2)*p)
      doc.setFillColor(30,64,175); doc.rect(mg,y,W-mg*2,6.5,"F")
      doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont("helvetica","bold")
      let cx=mg
      ;["Bulan","Revenue","% Total","MoM","Invoice"].forEach((h,i)=>{doc.text(h,cx+2,y+4.5);cx+=cw[i]})
      y+=6.5
      stats.monthlyWithGrowth.forEach((row,idx)=>{
        if(row.revenue===0) return
        const pct=(row.revenue/stats.totalRevenue*100).toFixed(1)
        const isBest=row.month===stats.bestMonth.month
        doc.setFillColor(isBest?219:idx%2===0?249:255,isBest?234:250,isBest?254:255)
        doc.rect(mg,y,W-mg*2,6.5,"F")
        doc.setTextColor(30,30,30); doc.setFont("helvetica",isBest?"bold":"normal"); doc.setFontSize(7)
        const mom=row.growth===0?"–":`${row.growth>0?"+":""}${row.growth}%`
        cx=mg
        ;[row.month,fIDR(row.revenue),`${pct}%`,mom,String(row.count)].forEach((c,i)=>{doc.text(c,cx+2,y+4.5);cx+=cw[i]})
        y+=6.5
      })
      doc.setFillColor(30,64,175); doc.rect(mg,y,W-mg*2,7,"F")
      doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(7.5)
      cx=mg
      ;["TOTAL",fIDR(stats.totalRevenue),"100%","",String(stats.totalInvoices)].forEach((c,i)=>{doc.text(c,cx+2,y+5);cx+=cw[i]})
      y+=14

      doc.setTextColor(30,30,30); doc.setFontSize(9); doc.setFont("helvetica","bold")
      doc.text("Top 5 Klien",mg,y); y+=5
      stats.topClients.forEach((c,i)=>{
        const pct=stats.totalRevenue>0?(c.value/stats.totalRevenue*100):0
        doc.setFillColor(i%2===0?245:255,247,250); doc.rect(mg,y,W-mg*2,12,"F")
        doc.setTextColor(80,80,80); doc.setFontSize(7); doc.setFont("helvetica","normal")
        doc.text(`#${i+1}`,mg+2,y+5)
        doc.setTextColor(20,20,20); doc.setFontSize(8); doc.setFont("helvetica","bold")
        doc.text(c.name.slice(0,50),mg+10,y+5)
        doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(100,100,100)
        doc.text(fIDR(c.value),mg+10,y+10)
        doc.setFillColor(200,210,230); doc.rect(W-mg-55,y+3,50,3,"F")
        doc.setFillColor(30,64,175); doc.rect(W-mg-55,y+3,50*(pct/100),3,"F")
        doc.setTextColor(60,60,60); doc.setFontSize(7)
        doc.text(`${pct.toFixed(1)}%`,W-mg+1,y+6,{align:"right"})
        y+=13
      })

      doc.setFillColor(245,247,250); doc.rect(0,285,W,12,"F")
      doc.setTextColor(130,130,130); doc.setFontSize(6.5); doc.setFont("helvetica","normal")
      doc.text("Dokumen ini dibuat otomatis dari sistem Dashboard PT Tri Bangun Up",mg,292)
      doc.text("KONFIDENSIAL",W-mg,292,{align:"right"})
      doc.save(`Analytics-Report-${periodLabel.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`)
    } catch {
      alert("Gagal export PDF. Jalankan: npm install jspdf")
    } finally {
      setIsPdfLoading(false)
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar/>
      <SidebarInset>
        <SiteHeader/>
        <style dangerouslySetInnerHTML={{__html:STYLES}}/>

        <div className="flex flex-1 flex-col gap-6 p-6">

          {/* ── Header ── */}
          <div className="a-up-1 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold">Analytics</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Analisis keuangan strategis · Rekap Invoice {periodLabel}
              </p>
            </div>
            <button
              onClick={handleExportPDF}
              disabled={isPdfLoading}
              className="pdf-btn flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60"
            >
              {isPdfLoading
                ? <><RefreshCw className="h-4 w-4 animate-spin"/> Menyiapkan...</>
                : <><Download className="h-4 w-4"/> Export PDF</>}
            </button>
          </div>

          {/* ── KPI Cards ── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="a-sc-1">
              <Card className="kpi-card kpi-default" onClick={()=>router.push("/dashboard")}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Gross Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fIDR(stats.totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stats.totalInvoices} invoice · {periodLabel}</p>
                </CardContent>
              </Card>
            </div>
            <div className="a-sc-2">
              <Card className="kpi-card kpi-green" onClick={()=>router.push("/dashboard")}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Terkumpul (Paid)</CardTitle>
                  <CreditCard className="h-4 w-4 text-green-600"/>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fIDR(stats.totalCollected)}</div>
                  <p className="text-xs text-green-600 mt-1">{stats.paidCount} invoice · {stats.collectionRate.toFixed(1)}%</p>
                </CardContent>
              </Card>
            </div>
            <div className="a-sc-3">
              <Card className="kpi-card kpi-red" onClick={()=>router.push("/dashboard")}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Outstanding</CardTitle>
                  <AlertCircle className={`h-4 w-4 ${stats.unpaidCount>0?"text-red-600":"text-green-600"}`}/>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fIDR(stats.totalUnpaid)}</div>
                  <p className={`text-xs mt-1 ${stats.unpaidCount>0?"text-red-600":"text-muted-foreground"}`}>
                    {stats.unpaidCount} invoice belum lunas
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="a-sc-4">
              <Card className="kpi-card kpi-amber" onClick={()=>router.push("/dashboard")}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">PPN (Tax Reserve)</CardTitle>
                  <Receipt className="h-4 w-4 text-amber-500"/>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fIDR(stats.totalPPN)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {((stats.totalPPN/stats.totalRevenue)*100).toFixed(1)}% dari gross revenue
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Revenue Split ── */}
          <div className="a-up-5">
            <Card className="hv-card">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle>Revenue Split per Bulan</CardTitle>
                    <CardDescription>
                      DPP = income murni perusahaan · PPN = pajak wajib disetor ke negara (bukan profit) · Diskon = potongan harga ke klien
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-3 rounded-sm bg-primary inline-block"/>DPP
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-3 rounded-sm inline-block" style={{background:"#f59e0b"}}/>PPN
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-3 rounded-sm inline-block" style={{background:"#f87171"}}/>Diskon
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* ↑ DIBESARKAN: h-[180px] → h-[260px] */}
                <ChartContainer config={splitConfig} className="h-[260px] w-full">
                  <BarChart data={stats.splitMonthly} barCategoryGap="28%" margin={{left:8,right:8,top:4,bottom:0}}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border"/>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{fontSize:11}}/>
                    <YAxis tickLine={false} axisLine={false} tick={{fontSize:11}} tickFormatter={fShort} width={52}/>
                    <ChartTooltip
                      cursor={{fill:"hsl(var(--muted))",opacity:.5}}
                      content={<ChartTooltipContent formatter={(v)=><span className="font-mono text-xs">{fIDR(Number(v))}</span>}/>}
                    />
                    <Bar dataKey="dpp"     stackId="a" fill="var(--color-dpp)"     radius={[0,0,0,0]} isAnimationActive animationDuration={700}/>
                    <Bar dataKey="ppn"     stackId="a" fill="var(--color-ppn)"     radius={[0,0,0,0]} isAnimationActive animationDuration={700}/>
                    <Bar dataKey="selisih" stackId="a" fill="var(--color-selisih)" radius={[3,3,0,0]} isAnimationActive animationDuration={700}/>
                  </BarChart>
                </ChartContainer>
                <div className="grid grid-cols-3 gap-4 pt-3 mt-2 border-t text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Total DPP</p>
                    <p className="text-sm font-semibold text-primary">{fIDR(stats.totalDPP)}</p>
                    <p className="text-[10px] text-muted-foreground">{((stats.totalDPP/stats.totalRevenue)*100).toFixed(1)}% gross</p>
                  </div>
                  <div className="border-x">
                    <p className="text-xs text-muted-foreground mb-0.5">Total PPN</p>
                    <p className="text-sm font-semibold" style={{color:"#f59e0b"}}>{fIDR(stats.totalPPN)}</p>
                    <p className="text-[10px] text-muted-foreground">{((stats.totalPPN/stats.totalRevenue)*100).toFixed(1)}% gross</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Diskon/Selisih</p>
                    <p className="text-sm font-semibold" style={{color:"#f87171"}}>{fIDR(stats.totalSelisih)}</p>
                    <p className="text-[10px] text-muted-foreground">{((stats.totalSelisih/stats.totalRevenue)*100).toFixed(1)}% gross</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Bar Revenue + Pie ── */}
          <div className="a-up-6 grid gap-6 md:grid-cols-3">

            <Card className="hv-card md:col-span-2">
              <CardHeader>
                <CardTitle>Revenue per Bulan</CardTitle>
                <CardDescription>
                  Pendapatan gross tiap bulan {periodLabel} — termasuk PPN dan diskon
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* ↑ DIBESARKAN: h-[200px] → h-[340px] — ini chart utama yg dibesarkan */}
                <ChartContainer config={revenueConfig} className="h-[430px] w-full">
                  <BarChart data={stats.monthly} barCategoryGap="30%" margin={{left:8,right:8,top:4,bottom:0}}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border"/>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{fontSize:12}}/>
                    <YAxis tickLine={false} axisLine={false} tick={{fontSize:11}} tickFormatter={fShort} width={55}/>
                    <ChartTooltip
                      cursor={{fill:"hsl(var(--muted))",opacity:.5}}
                      content={
                        <ChartTooltipContent
                          formatter={(value,name,item)=>{
                            const d=item.payload
                            const pct=stats.totalRevenue>0?(d.revenue/stats.totalRevenue*100).toFixed(1):"0"
                            return(
                              <div className="flex flex-col gap-0.5 min-w-[150px]">
                                <span className="font-mono font-bold text-foreground">{fIDR(Number(value))}</span>
                                <span className="text-muted-foreground text-xs">{pct}% dari total · {d.count} invoice</span>
                              </div>
                            )
                          }}
                        />
                      }
                    />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[5,5,0,0]} isAnimationActive animationDuration={900} animationEasing="ease-out"/>
                  </BarChart>
                </ChartContainer>
                <div className="mt-3">
                  <div className="insight-box flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary"/>
                    <span>
                      <strong>{stats.bestMonth.month}</strong> bulan terkuat ({fIDR(stats.bestMonth.revenue)},{" "}
                      {stats.totalRevenue>0?((stats.bestMonth.revenue/stats.totalRevenue)*100).toFixed(1):0}% dari total).
                      Rata-rata/bulan: <strong>{fIDR(stats.avgMonthly)}</strong>.{" "}
                      {stats.trend>5
                        ? <span className="text-green-600 font-semibold">Tren Q4 naik +{stats.trend.toFixed(0)}% vs Q1 ↑</span>
                        : stats.trend<-5
                        ? <span className="text-destructive font-semibold">Tren Q4 turun {stats.trend.toFixed(0)}% vs Q1 ↓ — evaluasi pipeline.</span>
                        : <span>Tren stabil sepanjang tahun.</span>
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hv-card">
              <CardHeader>
                <CardTitle>Status Invoice</CardTitle>
                <CardDescription>Paid vs outstanding berdasarkan jumlah invoice</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div className="pie-zoom">
                  <ChartContainer config={statusConfig} style={{width:160,height:160}}>
                    <PieChart width={160} height={160}>
                      <Pie data={stats.pieData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3} isAnimationActive animationDuration={900}>
                        <Cell key="paid"   fill="var(--color-paid)"/>
                        <Cell key="unpaid" fill="var(--color-unpaid)"/>
                      </Pie>
                      <ChartTooltip
                        content={<ChartTooltipContent formatter={(v)=><span className="font-mono text-xs">{v} invoice</span>}/>}
                      />
                    </PieChart>
                  </ChartContainer>
                </div>
                <div className="w-full space-y-3 text-sm">
                  {stats.pieData.map(item=>(
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{background:`var(--color-${item.name})`}}/>
                        <span className="text-muted-foreground">{item.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{item.value} inv</span>
                        <span className="text-xs text-muted-foreground ml-1">({item.pct.toFixed(1)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="insight-box w-full">
                  <div className="flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary"/>
                    <span>
                      {stats.pieData[0].pct.toFixed(1)}% invoice terbayar,{" "}
                      <strong className="text-destructive">{stats.unpaidCount} invoice</strong> outstanding
                      senilai <strong className="text-destructive">{fIDR(stats.totalUnpaid)}</strong>.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Monthly Table + Top Clients ── */}
          <div className="a-up-7 grid gap-6 md:grid-cols-2">

            <Card className="hv-card">
              <CardHeader>
                <CardTitle>Breakdown Bulanan</CardTitle>
                <CardDescription>Revenue per bulan & pertumbuhan MoM (Month-over-Month)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-6 py-3 text-left font-medium text-muted-foreground">Bulan</th>
                      <th className="px-6 py-3 text-right font-medium text-muted-foreground">Revenue</th>
                      <th className="px-6 py-3 text-right font-medium text-muted-foreground">% Total</th>
                      <th className="px-6 py-3 text-right font-medium text-muted-foreground">MoM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.monthlyWithGrowth.map(row=>{
                      if(row.revenue===0) return null
                      const pct=stats.totalRevenue>0?(row.revenue/stats.totalRevenue*100):0
                      const isBest=row.month===stats.bestMonth.month
                      return(
                        <tr key={row.month} className={`tr-hover border-b last:border-0 ${isBest?"bg-primary/5":""}`}>
                          <td className="px-6 py-3 font-medium">
                            <span className="flex items-center gap-2">
                              {row.month}
                              {isBest&&<span className="text-[10px] font-semibold rounded-sm bg-primary text-primary-foreground px-1.5 py-0.5">BEST</span>}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right font-mono tabular-nums text-xs">{fIDR(row.revenue)}</td>
                          <td className="px-6 py-3 text-right text-muted-foreground text-xs">{pct.toFixed(1)}%</td>
                          <td className="px-6 py-3 text-right">
                            {row.growth===0
                              ? <span className="text-muted-foreground flex items-center justify-end gap-0.5 text-xs"><Minus className="h-3 w-3"/>–</span>
                              : row.growth>0
                              ? <span className="text-green-600 font-medium flex items-center justify-end gap-0.5 text-xs"><ChevronUp className="h-3 w-3"/>+{row.growth}%</span>
                              : <span className="text-destructive font-medium flex items-center justify-end gap-0.5 text-xs"><ChevronDown className="h-3 w-3"/>{row.growth}%</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/40 font-semibold border-t-2">
                      <td className="px-6 py-3 text-sm">Total</td>
                      <td className="px-6 py-3 text-right font-mono text-xs tabular-nums">{fIDR(stats.totalRevenue)}</td>
                      <td className="px-6 py-3 text-right text-xs text-muted-foreground">100%</td>
                      <td className="px-6 py-3"/>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>

            <Card className="hv-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Top 5 Clients</CardTitle>
                    <CardDescription>Berdasarkan total nilai invoice {periodLabel}</CardDescription>
                  </div>
                  <button onClick={()=>router.push("/clients")} className="arrow-parent flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                    Lihat semua <ArrowRight className="arrow-nudge h-3 w-3"/>
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {stats.topClients.map((client,i)=>{
                    const pct=stats.totalRevenue>0?(client.value/stats.totalRevenue*100):0
                    return(
                      <div key={i} className="cl-row" onClick={()=>router.push("/clients")}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground mt-0.5">{i+1}</span>
                            <span className="text-sm font-medium leading-tight line-clamp-2 hover:text-primary transition-colors">{client.name}</span>
                          </div>
                          <span className="shrink-0 text-xs font-bold text-primary tabular-nums">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="ml-7 space-y-1">
                          <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className="bar-fill absolute inset-y-0 left-0 rounded-full bg-primary" style={{"--bar-w":`${pct}%`} as React.CSSProperties}/>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono">{fIDR(client.value)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Executive Summary ── */}
          <div className="a-up-8">
            <Card className="hv-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary"/>
                  <CardTitle>Executive Summary</CardTitle>
                </div>
                <CardDescription>Ringkasan performa keuangan otomatis dari data invoice {periodLabel}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="exec-chip rounded-lg bg-muted/50 p-4 space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Collection Rate</p>
                    <p className={`text-2xl font-bold ${stats.collectionRate>=80?"text-green-600":"text-destructive"}`}>
                      {stats.collectionRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Tingkat penagihan invoice</p>
                  </div>
                  <div className="exec-chip rounded-lg bg-muted/50 p-4 space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Bulan Terkuat</p>
                    <p className="text-2xl font-bold text-green-600">{stats.bestMonth.month}</p>
                    <p className="text-xs text-muted-foreground">{fIDR(stats.bestMonth.revenue)}</p>
                  </div>
                  <div className="exec-chip rounded-lg bg-muted/50 p-4 space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Invoice Outstanding</p>
                    <p className={`text-2xl font-bold ${stats.unpaidCount===0?"text-green-600":"text-destructive"}`}>{stats.unpaidCount}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.unpaidCount>0?fIDR(stats.totalUnpaid):"Semua invoice lunas ✓"}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tingkat penagihan <span className="font-semibold text-foreground">{stats.collectionRate.toFixed(1)}%</span>.{" "}
                  Puncak pendapatan bulan <span className="font-semibold text-foreground">{stats.bestMonth.month}</span>{" "}
                  ({fIDR(stats.bestMonth.revenue)}).
                  {stats.trend>5&&<> Tren <span className="text-green-600 font-semibold">naik {stats.trend.toFixed(0)}%</span> di paruh kedua.</>}
                  {stats.trend<-5&&<> Tren <span className="text-destructive font-semibold">turun {Math.abs(stats.trend).toFixed(0)}%</span> di paruh kedua.</>}
                  {stats.unpaidCount>0&&<> Ada <span className="font-semibold text-destructive">{stats.unpaidCount} invoice outstanding</span> senilai <span className="font-semibold text-destructive">{fIDR(stats.totalUnpaid)}</span> — segera follow-up.</>}
                </p>
              </CardContent>
            </Card>
          </div>

        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
