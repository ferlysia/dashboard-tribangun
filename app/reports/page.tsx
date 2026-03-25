"use client"

import * as React from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFilteredInvoices } from "@/lib/use-filtered-invoices"
import type { InvoiceRecord } from "@/types/invoice"
import { BarChart3, Download, FileJson, FileSpreadsheet, FileText, Target, TrendingUp, Users, Wallet } from "lucide-react"

const fIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

type ReportMode = "executive" | "collections" | "clients"
type ExportFormat = "pdf" | "csv" | "json" | "txt"

function extractClientName(customer: string) {
  return customer.split("(")[0]?.trim() || customer
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const { invoices, periodLabel } = useFilteredInvoices()
  const [mode, setMode] = React.useState<ReportMode>("executive")
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>("pdf")
  const [isExporting, setIsExporting] = React.useState(false)

  const stats = React.useMemo(() => {
    const rows = invoices as InvoiceRecord[]
    const totalRevenue = rows.reduce((sum, invoice) => sum + (invoice.total || 0), 0)
    const totalCollected = rows.reduce((sum, invoice) => sum + (invoice.payment_value || 0), 0)
    const outstanding = Math.max(totalRevenue - totalCollected, 0)
    const unpaid = rows.filter((invoice) => invoice.status === "UNPAID")
    const collectionRate = totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0

    const monthly = Array.from({ length: 12 }, (_, index) => {
      const monthRows = rows.filter((invoice) => invoice.month === index + 1)
      return {
        month: index + 1,
        revenue: monthRows.reduce((sum, invoice) => sum + (invoice.total || 0), 0),
        count: monthRows.length,
      }
    })

    const bestMonth = monthly.reduce(
      (best, row) => (row.revenue > best.revenue ? row : best),
      monthly[0] ?? { month: 0, revenue: 0, count: 0 }
    )

    const clients = new Map<string, { name: string; revenue: number; collected: number; invoices: number }>()
    rows.forEach((invoice) => {
      const key = extractClientName(invoice.customer)
      const current = clients.get(key) ?? { name: key, revenue: 0, collected: 0, invoices: 0 }
      current.revenue += invoice.total || 0
      current.collected += invoice.payment_value || 0
      current.invoices += 1
      clients.set(key, current)
    })

    const topClients = Array.from(clients.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
      .map((client) => ({
        ...client,
        share: totalRevenue > 0 ? (client.revenue / totalRevenue) * 100 : 0,
      }))

    const riskList = unpaid
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 8)

    return {
      totalRevenue,
      totalCollected,
      outstanding,
      collectionRate,
      invoiceCount: rows.length,
      unpaidCount: unpaid.length,
      bestMonth,
      topClients,
      riskList,
    }
  }, [invoices])

  const reportModes: Array<{ key: ReportMode; title: string; desc: string; icon: typeof FileText }> = [
    { key: "executive", title: "Executive Summary", desc: "Ringkasan angka utama dan arah tindak lanjut", icon: FileText },
    { key: "collections", title: "Collection Focus", desc: "Prioritas invoice outstanding dan recovery", icon: Wallet },
    { key: "clients", title: "Client Performance", desc: "Kontribusi klien dan dominasi revenue", icon: Users },
  ]

  const exportOptions: Array<{ key: ExportFormat; title: string; desc: string; icon: typeof FileText }> = [
    { key: "pdf", title: "PDF", desc: "Full summary rapi semua section", icon: Download },
    { key: "csv", title: "CSV", desc: "Data tabular untuk Excel", icon: FileSpreadsheet },
    { key: "json", title: "JSON", desc: "Data mentah terstruktur", icon: FileJson },
    { key: "txt", title: "TXT Summary", desc: "Ringkasan cepat 1 file teks", icon: FileText },
  ]

  const handleExport = React.useCallback(() => {
    const exportAction = async () => {
      setIsExporting(true)
      try {
        const rows = invoices as InvoiceRecord[]
        const safePeriod = periodLabel.toLowerCase().replace(/\s+/g, "-")

        if (exportFormat === "pdf") {
          const { default: jsPDF } = await import("jspdf")
          const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
          const W = 210
          const H = 297
          const mg = 16
          let y = 16

          doc.setFillColor(30, 64, 175)
          doc.rect(0, 0, W, 30, "F")
          doc.setTextColor(255, 255, 255)
          doc.setFont("helvetica", "bold")
          doc.setFontSize(16)
          doc.text("REPORTS FULL SUMMARY", mg, 12)
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8)
          doc.text("PT TRI BANGUN UP  ·  Rekap Operasional Invoice", mg, 20)
          doc.text(`Periode: ${periodLabel}`, W - mg, 20, { align: "right" })

          y = 38
          const cardW = (W - mg * 2 - 9) / 4
          ;[
            { label: "Gross Revenue", value: fIDR(stats.totalRevenue) },
            { label: "Collected", value: fIDR(stats.totalCollected) },
            { label: "Outstanding", value: fIDR(stats.outstanding) },
            { label: "Collection Rate", value: `${stats.collectionRate.toFixed(1)}%` },
          ].forEach((item, index) => {
            const x = mg + index * (cardW + 3)
            doc.setFillColor(245, 247, 250)
            doc.roundedRect(x, y, cardW, 18, 2, 2, "F")
            doc.setTextColor(95, 95, 95)
            doc.setFontSize(6.5)
            doc.setFont("helvetica", "normal")
            doc.text(item.label, x + 3, y + 6)
            doc.setTextColor(20, 20, 20)
            doc.setFontSize(8)
            doc.setFont("helvetica", "bold")
            doc.text(item.value, x + 3, y + 13)
          })

          y += 28
          doc.setTextColor(30, 30, 30)
          doc.setFont("helvetica", "bold")
          doc.setFontSize(10)
          doc.text("Ringkasan Utama", mg, y)
          y += 6

          const summaryLines = [
            `Revenue periode aktif tercatat ${fIDR(stats.totalRevenue)} dengan collection rate ${stats.collectionRate.toFixed(1)}%.`,
            `Outstanding aktif saat ini sebesar ${fIDR(stats.outstanding)} dari ${stats.unpaidCount} invoice yang belum lunas.`,
            `Top month berada di bulan ${stats.bestMonth.month || "-"} dengan nilai ${fIDR(stats.bestMonth.revenue)}.`,
          ]

          doc.setFillColor(248, 250, 252)
          doc.roundedRect(mg, y, W - mg * 2, 24, 2, 2, "F")
          doc.setTextColor(55, 65, 81)
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8)
          summaryLines.forEach((line, index) => {
            doc.text(line, mg + 4, y + 6 + index * 6)
          })

          y += 34
          doc.setTextColor(30, 30, 30)
          doc.setFont("helvetica", "bold")
          doc.setFontSize(10)
          doc.text("Top Clients", mg, y)
          y += 5
          stats.topClients.slice(0, 6).forEach((row, index) => {
            if (y > H - 30) return
            doc.setFillColor(index % 2 === 0 ? 249 : 255, 250, 251)
            doc.rect(mg, y, W - mg * 2, 12, "F")
            doc.setTextColor(20, 20, 20)
            doc.setFont("helvetica", "bold")
            doc.setFontSize(8)
            doc.text(row.name.slice(0, 48), mg + 3, y + 5)
            doc.setFont("helvetica", "normal")
            doc.setFontSize(6.8)
            doc.setTextColor(100, 100, 100)
            doc.text(`${row.invoices} invoice`, mg + 3, y + 9.5)
            doc.setTextColor(20, 20, 20)
            doc.setFont("helvetica", "bold")
            doc.setFontSize(7.5)
            doc.text(fIDR(row.revenue), W - mg - 3, y + 5, { align: "right" })
            doc.setTextColor(100, 100, 100)
            doc.setFont("helvetica", "normal")
            doc.setFontSize(6.8)
            doc.text(`${row.share.toFixed(1)}%`, W - mg - 3, y + 9.5, { align: "right" })
            y += 12
          })

          doc.addPage()
          doc.setFillColor(30, 64, 175)
          doc.rect(0, 0, W, 24, "F")
          doc.setTextColor(255, 255, 255)
          doc.setFont("helvetica", "bold")
          doc.setFontSize(14)
          doc.text("COLLECTION PRIORITIES", mg, 13)
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8)
          doc.text(`Outstanding ${fIDR(stats.outstanding)}  ·  ${stats.unpaidCount} unpaid invoice`, mg, 19)

          y = 34
          doc.setTextColor(30, 30, 30)
          doc.setFont("helvetica", "bold")
          doc.setFontSize(10)
          doc.text("Priority Invoice List", mg, y)
          y += 6
          stats.riskList.slice(0, 8).forEach((invoice, index) => {
            if (y > H - 26) return
            doc.setFillColor(index % 2 === 0 ? 255 : 250, 249, 249)
            doc.rect(mg, y, W - mg * 2, 12, "F")
            doc.setTextColor(20, 20, 20)
            doc.setFont("helvetica", "bold")
            doc.setFontSize(8)
            doc.text(invoice.customer.slice(0, 48), mg + 3, y + 5)
            doc.setFont("helvetica", "normal")
            doc.setFontSize(6.8)
            doc.setTextColor(100, 100, 100)
            doc.text(invoice.invoice_no, mg + 3, y + 9.5)
            doc.setTextColor(185, 28, 28)
            doc.setFont("helvetica", "bold")
            doc.setFontSize(7.5)
            doc.text(fIDR(invoice.total || 0), W - mg - 3, y + 5, { align: "right" })
            doc.setTextColor(100, 100, 100)
            doc.setFont("helvetica", "normal")
            doc.setFontSize(6.8)
            doc.text(invoice.date, W - mg - 3, y + 9.5, { align: "right" })
            y += 12
          })

          doc.setFillColor(245, 247, 250)
          doc.rect(0, 285, W, 12, "F")
          doc.setTextColor(130, 130, 130)
          doc.setFontSize(6.5)
          doc.setFont("helvetica", "normal")
          doc.text("Dokumen ini dibuat otomatis dari sistem Dashboard PT Tri Bangun Up", mg, 292)
          doc.text("KONFIDENSIAL", W - mg, 292, { align: "right" })
          doc.save(`Reports-Full-Summary-${safePeriod}-${new Date().toISOString().split("T")[0]}.pdf`)
          return
        }

        if (exportFormat === "csv") {
          const csv = [
            ["invoice_no", "customer", "date", "status", "total", "payment_value"].join(","),
            ...rows.map((invoice) =>
              [
                invoice.invoice_no,
                `"${invoice.customer.replace(/"/g, '""')}"`,
                invoice.date,
                invoice.status,
                invoice.total || 0,
                invoice.payment_value || 0,
              ].join(",")
            ),
          ].join("\n")
          downloadFile(`report-${mode}-${safePeriod}.csv`, csv, "text/csv;charset=utf-8;")
          return
        }

        if (exportFormat === "json") {
          const payload = {
            mode,
            period: periodLabel,
            generatedAt: new Date().toISOString(),
            summary: {
              totalRevenue: stats.totalRevenue,
              totalCollected: stats.totalCollected,
              outstanding: stats.outstanding,
              collectionRate: stats.collectionRate,
              invoiceCount: stats.invoiceCount,
              unpaidCount: stats.unpaidCount,
            },
            invoices: rows,
          }
          downloadFile(`report-${mode}-${safePeriod}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8;")
          return
        }

        const txt = [
          `REPORT MODE: ${mode.toUpperCase()}`,
          `PERIOD: ${periodLabel}`,
          `TOTAL REVENUE: ${fIDR(stats.totalRevenue)}`,
          `COLLECTED: ${fIDR(stats.totalCollected)}`,
          `OUTSTANDING: ${fIDR(stats.outstanding)}`,
          `COLLECTION RATE: ${stats.collectionRate.toFixed(1)}%`,
          `TOTAL INVOICE: ${stats.invoiceCount}`,
          `UNPAID INVOICE: ${stats.unpaidCount}`,
          "",
          "TOP CLIENTS:",
          ...stats.topClients.map((client, index) => `${index + 1}. ${client.name} - ${fIDR(client.revenue)} (${client.share.toFixed(1)}%)`),
        ].join("\n")
        downloadFile(`report-${mode}-${safePeriod}.txt`, txt, "text/plain;charset=utf-8;")
      } catch {
        alert("Gagal export report. Coba cek dependency export PDF atau refresh halaman.")
      } finally {
        setIsExporting(false)
      }
    }

    void exportAction()
  }, [exportFormat, invoices, mode, periodLabel, stats])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-5 p-5 lg:p-6">
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3">
                <Badge className="bg-primary/12 text-primary hover:bg-primary/12">Reports Center</Badge>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Laporan rapi dengan pilihan format unduh</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Pilih fokus laporan, lalu unduh hasilnya dalam format yang kamu butuhkan. Semua isi mengikuti periode aktif yang sedang dipilih.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {reportModes.map((item) => {
                    const active = mode === item.key
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setMode(item.key)}
                        className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                          active
                            ? "border-primary bg-primary/10 shadow-[0_12px_28px_-18px_hsl(var(--primary)/0.75)]"
                            : "border-border/70 bg-background hover:border-primary/35 hover:bg-primary/5"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <item.icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                          <div className={`text-sm font-semibold ${active ? "text-primary" : ""}`}>{item.title}</div>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-primary/15 bg-primary/6 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-primary">Unduh Report</div>
                    <div className="text-xs text-muted-foreground">PDF akan unduh full ringkasan dari semua section</div>
                  </div>
                  <Badge variant="secondary">{periodLabel}</Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {exportOptions.map((item) => {
                    const active = exportFormat === item.key
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setExportFormat(item.key)}
                        className={`rounded-xl border px-4 py-3 text-left transition-all ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/70 bg-background hover:border-primary/35 hover:bg-primary/5"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm font-semibold">{item.title}</span>
                        </div>
                        <div className={`mt-1 text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{item.desc}</div>
                      </button>
                    )
                  })}
                </div>
                <Button onClick={handleExport} className="mt-4 w-full">
                  <Download className="h-4 w-4" />
                  {isExporting ? "Menyiapkan file..." : `Unduh ${exportFormat.toUpperCase()}`}
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { title: "Gross Revenue", value: fIDR(stats.totalRevenue), icon: TrendingUp, sub: `${stats.invoiceCount} invoice tercatat` },
              { title: "Collected", value: fIDR(stats.totalCollected), icon: Target, sub: `${stats.collectionRate.toFixed(1)}% collection rate` },
              { title: "Outstanding", value: fIDR(stats.outstanding), icon: Wallet, sub: `${stats.unpaidCount} invoice belum lunas` },
              { title: "Top Month", value: stats.bestMonth.month ? `Bulan ${stats.bestMonth.month}` : "Belum ada", icon: BarChart3, sub: fIDR(stats.bestMonth.revenue) },
            ].map((item) => (
              <Card key={item.title} className="border-border/70">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                  <item.icon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-lg font-bold leading-tight lg:text-xl">{item.value}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          {mode === "executive" && (
            <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Executive Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4">
                    <div className="text-sm font-semibold text-primary">Narasi ringkas</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Revenue {periodLabel} tercatat sebesar <span className="font-semibold text-foreground">{fIDR(stats.totalRevenue)}</span> dengan collection rate <span className="font-semibold text-foreground">{stats.collectionRate.toFixed(1)}%</span>. Outstanding aktif saat ini sebesar <span className="font-semibold text-foreground">{fIDR(stats.outstanding)}</span>.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border p-4">
                      <div className="text-sm font-semibold">Highlight utama</div>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <p>Revenue sudah konsisten terbaca lintas periode.</p>
                        <p>Top client dan top month mudah dipakai buat evaluasi cepat.</p>
                        <p>Dataset sudah siap jadi dasar fase database live.</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <div className="text-sm font-semibold">Tindak lanjut</div>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <p>Outstanding bernilai besar tetap jadi prioritas.</p>
                        <p>Placeholder duplicate workbook 2026 perlu diabaikan saat migrasi.</p>
                        <p>Langkah berikutnya: CRUD live dan otomatisasi report.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Top Client Share</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stats.topClients.map((client, index) => (
                    <div key={client.name} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{index + 1}. {client.name}</div>
                          <div className="text-xs text-muted-foreground">{client.invoices} invoice</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{fIDR(client.revenue)}</div>
                          <div className="text-xs text-muted-foreground">{client.share.toFixed(1)}%</div>
                        </div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(client.share, 4)}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          )}

          {mode === "collections" && (
            <section className="grid gap-5 xl:grid-cols-[0.86fr_1.14fr]">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Collection Priorities</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/6 p-4">
                    <div className="text-sm font-semibold text-destructive">Fokus utama penagihan</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Prioritaskan invoice bernilai paling besar dulu untuk mempercepat pemulihan cashflow dan mengurangi outstanding secara signifikan.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border p-4">
                      <div className="text-xs text-muted-foreground">Outstanding Value</div>
                      <div className="mt-1 text-2xl font-bold">{fIDR(stats.outstanding)}</div>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <div className="text-xs text-muted-foreground">Unpaid Invoice</div>
                      <div className="mt-1 text-2xl font-bold">{stats.unpaidCount}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>High Priority Invoice List</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stats.riskList.map((invoice) => (
                    <div key={invoice.invoice_no} className="rounded-2xl border border-border/70 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{invoice.customer}</div>
                          <div className="text-xs text-muted-foreground">{invoice.invoice_no}</div>
                        </div>
                        <div className="shrink-0 text-left lg:text-right">
                          <div className="font-semibold text-destructive">{fIDR(invoice.total || 0)}</div>
                          <div className="text-xs text-muted-foreground">{invoice.date}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          )}

          {mode === "clients" && (
            <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Client Performance Ranking</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stats.topClients.map((client, index) => (
                    <div key={client.name} className="rounded-2xl border border-border/70 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{index + 1}. {client.name}</div>
                          <div className="text-xs text-muted-foreground">{client.invoices} invoice tercatat</div>
                        </div>
                        <div className="shrink-0 text-left lg:text-right">
                          <div className="font-semibold">{fIDR(client.revenue)}</div>
                          <div className="text-xs text-muted-foreground">Collected {fIDR(client.collected)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Interpretasi Cepat</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm font-semibold">Makna report ini</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Halaman ini membantu membaca klien paling dominan terhadap revenue, klien paling aktif, dan area mana yang perlu dipertahankan untuk stabilitas pemasukan.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4">
                    <div className="text-sm font-semibold text-primary">Potensi pengembangan</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Saat database live aktif, report ini bisa langsung naik level jadi generator laporan dinamis berdasarkan filter user, status invoice, dan performa klien.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
