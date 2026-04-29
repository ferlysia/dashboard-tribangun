"use client"

import * as React from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import {
  Database,
  FileSpreadsheet,
  ShieldAlert,
  Files,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react"
import importReport from "@/data/invoice-import-report.json"
import { useFilteredInvoices } from "@/lib/use-filtered-invoices"
import type { InvoiceRecord } from "@/types/invoice"
import { useCurrentUser } from "@/components/providers/current-user-provider"

type ActivityLog = {
  id: string
  action: string
  actor_email: string
  summary: string
  created_at: string
  payload?: {
    before?: Partial<InvoiceRecord>
    after?: Partial<InvoiceRecord>
  }
}

type ChangedInvoice = {
  id: string
  invoice_no: string
  customer: string
  reason: string
  current: Partial<InvoiceRecord> | null
  baseline: Partial<InvoiceRecord> | null
}

const fDateTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value))

const fIDR = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value)

function normalizeDateString(value: string) {
  const input = value.trim()
  if (!input) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input

  const slashMatch = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (slashMatch) {
    const [, day, month, year] = slashMatch
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  return ""
}

function formatActivityDetail(log: ActivityLog) {
  const before = log?.payload?.before || null
  const after = log?.payload?.after || null

  if (before?.status !== undefined && after?.status !== undefined && before.status !== after.status) {
    return `status: ${before.status} -> ${after.status}`
  }

  if (before?.payment_value !== undefined && after?.payment_value !== undefined && String(before.payment_value) !== String(after.payment_value)) {
    return `payment_value: ${before.payment_value} -> ${after.payment_value}`
  }

  if (before?.selisih !== undefined && after?.selisih !== undefined && String(before.selisih) !== String(after.selisih)) {
    return `selisih: ${before.selisih} -> ${after.selisih}`
  }

  if (log?.action === "RESTORE_ALL") {
    return "semua invoice dikembalikan ke baseline original Excel"
  }

  if (log?.action === "CREATE") {
    return "invoice baru ditambahkan ke database"
  }

  if (log?.action === "DELETE") {
    return "invoice dihapus dari database"
  }

  return "perubahan field lain tersimpan di payload log"
}

function formatChangedInvoiceDetail(item: ChangedInvoice) {
  const baseline = item?.baseline
  const current = item?.current
  if (!baseline || !current) return item.reason

  if (baseline.status !== current.status) {
    return `status: ${baseline.status} -> ${current.status}`
  }
  if (String(baseline.payment_value) !== String(current.payment_value)) {
    return `payment_value: ${baseline.payment_value} -> ${current.payment_value}`
  }
  if (String(baseline.selisih) !== String(current.selisih)) {
    return `selisih: ${baseline.selisih} -> ${current.selisih}`
  }

  return item.reason
}

type InvoiceFormState = {
  invoice_no: string
  project_type: "Maintenance" | "Material/PAC" | "Project/Instalasi" | "Jasa" | "Lainnya" | ""
  customer: string
  site_name: string
  description: string
  date: string
  invoice_sent_date: string
  terms_of_payment: "" | "15" | "30" | "45" | "60" | "90" | "120"
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

const EMPTY_FORM: InvoiceFormState = {
  invoice_no: "",
  project_type: "",
  customer: "",
  site_name: "",
  description: "",
  date: "",
  invoice_sent_date: "",
  terms_of_payment: "",
  po_number: "",
  po_date: "",
  po_value: "",
  tax_type: "PPN",
  dpp: "",
  ppn: "",
  total: "",
  payment_date: "",
  payment_value: "",
  selisih: "",
  status: "UNPAID",
  keterangan: "",
}

function mapInvoiceToForm(invoice: InvoiceRecord): InvoiceFormState {
  const top = invoice.terms_of_payment
  return {
    invoice_no: invoice.invoice_no,
    project_type: (invoice.project_type as InvoiceFormState["project_type"]) || "",
    customer: invoice.customer,
    site_name: invoice.site_name || "",
    description: invoice.description,
    date: invoice.date || "",
    invoice_sent_date: invoice.invoice_sent_date || "",
    terms_of_payment: top ? (String(top) as InvoiceFormState["terms_of_payment"]) : "",
    po_number: invoice.po_number,
    po_date: invoice.po_date || "",
    po_value: String(invoice.po_value || ""),
    tax_type: invoice.tax_type,
    dpp: String(invoice.dpp || ""),
    ppn: String(invoice.ppn || ""),
    total: String(invoice.total || ""),
    payment_date: invoice.payment_date || "",
    payment_value: String(invoice.payment_value || ""),
    selisih: String(invoice.selisih || ""),
    status: invoice.status,
    keterangan: invoice.keterangan || "",
  }
}

export default function ExcelDataPage() {
  const { invoices, periodLabel, loading, source, refresh } = useFilteredInvoices()
  const { user } = useCurrentUser()
  const [search, setSearch] = React.useState("")
  const [editingInvoice, setEditingInvoice] = React.useState<InvoiceRecord | null>(null)
  const [form, setForm] = React.useState<InvoiceFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = React.useState(false)
  const [message, setMessage] = React.useState<string>("")
  const [activityLogs, setActivityLogs] = React.useState<ActivityLog[]>([])
  const [changedInvoices, setChangedInvoices] = React.useState<ChangedInvoice[]>([])

  const files = [
    {
      title: "REKAP INVOICE 2025.xlsx",
      year: "2025",
      records: importReport.records_by_year.find((item) => item.year === 2025)?.count ?? 0,
      paid: importReport.records_by_year.find((item) => item.year === 2025)?.paid ?? 0,
      unpaid: importReport.records_by_year.find((item) => item.year === 2025)?.unpaid ?? 0,
    },
    {
      title: "REKAP INVOICE 2026.xlsx",
      year: "2026",
      records: importReport.records_by_year.find((item) => item.year === 2026)?.count ?? 0,
      paid: importReport.records_by_year.find((item) => item.year === 2026)?.paid ?? 0,
      unpaid: importReport.records_by_year.find((item) => item.year === 2026)?.unpaid ?? 0,
    },
  ]

  const visibleInvoices = React.useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return invoices.slice(0, 12)
    return invoices
      .filter((invoice) =>
        [invoice.invoice_no, invoice.customer, invoice.site_name, invoice.description]
          .join(" ")
          .toLowerCase()
          .includes(keyword)
      )
      .slice(0, 12)
  }, [invoices, search])

  const resetForm = React.useCallback(() => {
    setEditingInvoice(null)
    setForm(EMPTY_FORM)
  }, [])

  const handleInputChange = React.useCallback(
    (field: keyof InvoiceFormState, value: string) => {
      setForm((current) => ({ ...current, [field]: value }))
    },
    []
  )

  const handleEdit = React.useCallback((invoice: InvoiceRecord) => {
    setEditingInvoice(invoice)
    setForm(mapInvoiceToForm(invoice))
    setMessage(`Mode edit aktif untuk ${invoice.invoice_no}`)
  }, [])

  const handleRefresh = React.useCallback(async () => {
    setMessage("Memuat ulang data invoice dari database...")
    await refresh()
    setMessage("Data invoice berhasil disegarkan dari sumber aktif.")
  }, [refresh])

  const loadAuditData = React.useCallback(async () => {
    try {
      const [logsResponse, changesResponse] = await Promise.all([
        fetch("/api/activity-logs", { cache: "no-store" }),
        fetch("/api/invoices/changes", { cache: "no-store" }),
      ])

      const logsResult = await logsResponse.json()
      const changesResult = await changesResponse.json()

      if (logsResponse.ok) setActivityLogs(logsResult.data || [])
      if (changesResponse.ok) setChangedInvoices(changesResult.data || [])
    } catch {}
  }, [])

  React.useEffect(() => {
    void loadAuditData()
  }, [loadAuditData, invoices.length])

  const handleSubmit = React.useCallback(async () => {
    if (!editingInvoice?.id) {
      setMessage("Pembuatan invoice baru dipindahkan ke halaman New Invoice.")
      return
    }

    const normalizedDate = normalizeDateString(form.date)
    const missingFields = [
      !form.invoice_no.trim() && "Invoice No",
      !form.customer.trim() && "Customer",
      !form.description.trim() && "Description",
      !normalizedDate && "Invoice Date",
    ].filter(Boolean)

    if (missingFields.length > 0) {
      setMessage(`Field wajib belum valid: ${missingFields.join(", ")}`)
      return
    }

    const payload = {
      ...form,
      invoice_no: form.invoice_no.trim(),
      project_type: form.project_type,
      customer: form.customer.trim(),
      site_name: form.site_name.trim(),
      description: form.description.trim(),
      date: normalizedDate,
      invoice_sent_date: normalizeDateString(form.invoice_sent_date),
      terms_of_payment: form.terms_of_payment ? Number(form.terms_of_payment) : null,
      po_number: form.po_number.trim(),
      po_date: normalizeDateString(form.po_date),
      payment_date: form.payment_date.trim(),
      keterangan: form.keterangan.trim(),
      po_value: Number(form.po_value || 0),
      dpp: Number(form.dpp || 0),
      ppn: Number(form.ppn || 0),
      total: Number(form.total || 0),
      payment_value: Number(form.payment_value || 0),
      selisih: Number(form.selisih || 0),
    }

    setSubmitting(true)
    setMessage("Menyimpan perubahan invoice...")

    try {
      const response = await fetch(`/api/invoices/${editingInvoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, actor_email: user.email }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Operasi invoice gagal")
      }

      await refresh()
      await loadAuditData()
      setMessage("Invoice berhasil diperbarui.")
      resetForm()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operasi invoice gagal.")
    } finally {
      setSubmitting(false)
    }
  }, [editingInvoice?.id, form, loadAuditData, refresh, resetForm, user.email])

  const handleDelete = React.useCallback(
    async (invoice: InvoiceRecord) => {
      if (!invoice.id) {
        setMessage("Invoice ini belum punya id database, tidak bisa dihapus.")
        return
      }

      const confirmed = window.confirm(`Hapus invoice ${invoice.invoice_no}?`)
      if (!confirmed) return

      setSubmitting(true)
      setMessage(`Menghapus invoice ${invoice.invoice_no}...`)

      try {
        const response = await fetch(`/api/invoices/${invoice.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor_email: user.email }),
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || "Gagal menghapus invoice")
        }

        await refresh()
        await loadAuditData()
        if (editingInvoice?.id === invoice.id) resetForm()
        setMessage(`Invoice ${invoice.invoice_no} berhasil dihapus.`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Gagal menghapus invoice.")
      } finally {
        setSubmitting(false)
      }
    },
    [editingInvoice?.id, loadAuditData, refresh, resetForm, user.email]
  )

  const handleRestore = React.useCallback(
    async (invoiceId: string) => {
      setSubmitting(true)
      setMessage("Mengembalikan invoice ke data original...")
      try {
        const response = await fetch(`/api/invoices/${invoiceId}/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor_email: user.email }),
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || "Gagal restore invoice")
        }

        await refresh()
        await loadAuditData()
        setMessage(`Invoice ${result.data.invoice_no} berhasil direstore ke data original.`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Gagal restore invoice.")
      } finally {
        setSubmitting(false)
      }
    },
    [loadAuditData, refresh, user.email]
  )

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-5 p-5 lg:p-6">
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-3">
                <Badge className="bg-primary/12 text-primary hover:bg-primary/12">Invoice Records Center</Badge>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Manage invoice records already stored in the database</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Invoices created from the `New Invoice` page will appear here. This page is now the main place to review,
                    edit, delete, restore, and monitor invoice record changes directly from the web app.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4">
                  <div className="text-xs text-primary">Terakhir generate</div>
                  <div className="mt-1 font-semibold">{fDateTime(importReport.generated_at)}</div>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <div className="text-xs text-muted-foreground">Periode aktif</div>
                  <div className="mt-1 font-semibold">{periodLabel}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{invoices.length} record terlihat</span>
                    <Badge variant={source === "supabase" ? "default" : "secondary"}>
                      {loading ? "Loading..." : source === "supabase" ? "Supabase" : "Local fallback"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { title: "Total Records", value: importReport.total_records, sub: "hasil normalisasi multi-year", icon: Database },
              { title: "Visible Data", value: invoices.length, sub: "sesuai filter periode aktif", icon: Files },
              { title: "Duplicates", value: importReport.duplicates.length, sub: "invoice number ganda", icon: ShieldAlert },
              { title: "Warnings", value: importReport.warnings.length, sub: "placeholder / year mismatch", icon: AlertTriangle },
            ].map((item) => (
              <Card key={item.title} className="border-border/70">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                  <item.icon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-bold tracking-tight lg:text-3xl">{item.value}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Workbook Sources</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                {files.map((file) => (
                  <div key={file.title} className="rounded-2xl border border-border/70 bg-background/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-primary" />
                          <h3 className="truncate font-semibold">{file.title}</h3>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Workbook sumber invoice tahun {file.year}</p>
                      </div>
                      <Badge variant="secondary">{file.year}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-border/60 p-3">
                        <div className="text-[11px] text-muted-foreground">Records</div>
                        <div className="mt-1 text-lg font-bold">{file.records}</div>
                      </div>
                      <div className="rounded-xl border border-border/60 p-3">
                        <div className="text-[11px] text-muted-foreground">Paid</div>
                        <div className="mt-1 text-lg font-bold text-primary">{file.paid}</div>
                      </div>
                      <div className="rounded-xl border border-border/60 p-3">
                        <div className="text-[11px] text-muted-foreground">Outstanding</div>
                        <div className="mt-1 text-lg font-bold text-destructive">{file.unpaid}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Import Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4">
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    Data siap dipakai sebagai base migrasi
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Struktur 2025-2026 sudah rapi. Issue yang tersisa hanya duplicate placeholder dari workbook 2026, bukan masalah di seluruh dataset.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Duplicates</div>
                    {importReport.duplicates.map((duplicate) => (
                      <div key={duplicate.invoice_no} className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3">
                        <div className="font-medium">{duplicate.invoice_no}</div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {duplicate.hits.map((hit) => `${hit.sheet_name} · ${hit.source_file}`).join(" / ")}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Warnings</div>
                    {importReport.warnings.map((warning, index) => (
                      <div key={`${warning.invoice_no}-${index}`} className="rounded-xl border border-destructive/15 bg-destructive/6 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{warning.invoice_no}</span>
                          <Badge variant="outline">{warning.type}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {warning.sheet_name} · workbook {warning.workbook_year}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] xl:items-start">
            <Card className="self-start">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle>{editingInvoice ? "Edit Selected Invoice" : "Invoice Management"}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Gunakan page ini untuk review data invoice yang sudah masuk ke database, lalu edit, delete, atau restore bila diperlukan.
                  </p>
                </div>
                {editingInvoice ? (
                  <Badge variant="secondary">Editing {editingInvoice.invoice_no}</Badge>
                ) : (
                  <Badge className="bg-primary/12 text-primary hover:bg-primary/12">Records</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                {!editingInvoice ? (
                  <div className="rounded-3xl border border-border/70 bg-muted/15 p-5">
                    <div className="space-y-3">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Database className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Select an invoice to edit</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Klik tombol `Edit` pada invoice di panel kanan untuk membuka editor. Untuk menambah invoice baru,
                          langsung gunakan page `New Invoice` agar alurnya tetap rapi dan tidak dobel.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 pt-1">
                        <Button asChild>
                          <Link href="/input-invoice">
                            <Plus className="h-4 w-4" />
                            Open New Invoice
                          </Link>
                        </Button>
                        <Button variant="outline" onClick={handleRefresh} disabled={submitting}>
                          <RefreshCw className="h-4 w-4" />
                          Refresh Records
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="invoice_no">Invoice No</Label>
                    <Input id="invoice_no" value={form.invoice_no} onChange={(event) => handleInputChange("invoice_no", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Invoice Date</Label>
                    <Input
                      id="date"
                      placeholder="YYYY-MM-DD atau DD/MM/YYYY"
                      value={form.date}
                      onChange={(event) => handleInputChange("date", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice_sent_date">Invoice Sent Date</Label>
                    <Input
                      id="invoice_sent_date"
                      placeholder="YYYY-MM-DD atau DD/MM/YYYY"
                      value={form.invoice_sent_date}
                      onChange={(event) => handleInputChange("invoice_sent_date", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="terms_of_payment">Terms of Payment (hari)</Label>
                    <select
                      id="terms_of_payment"
                      title="Terms of Payment"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
                      value={form.terms_of_payment}
                      onChange={(event) => handleInputChange("terms_of_payment", event.target.value as InvoiceFormState["terms_of_payment"])}
                    >
                      <option value="">— Pilih TOP —</option>
                      <option value="15">15 hari</option>
                      <option value="30">30 hari</option>
                      <option value="45">45 hari</option>
                      <option value="60">60 hari</option>
                      <option value="90">90 hari</option>
                      <option value="120">120 hari</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">Outstanding dihitung mulai hari ke-(TOP+1) setelah Invoice Sent Date</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project_type">Project Type</Label>
                    <select
                      id="project_type"
                      title="Project Type"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
                      value={form.project_type}
                      onChange={(event) => handleInputChange("project_type", event.target.value as InvoiceFormState["project_type"])}
                    >
                      <option value="">— Pilih Tipe —</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Material/PAC">Material / PAC</option>
                      <option value="Project/Instalasi">Project / Instalasi</option>
                      <option value="Jasa">Jasa</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="customer">Customer</Label>
                    <Input id="customer" value={form.customer} onChange={(event) => handleInputChange("customer", event.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="site_name">Site Name</Label>
                    <Input
                      id="site_name"
                      placeholder="Nama site/lokasi (isi otomatis dari tanda kurung di Customer)"
                      value={form.site_name}
                      onChange={(event) => handleInputChange("site_name", event.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Primary key untuk pencarian, contoh: &quot;Dakota Batam&quot;, &quot;Edge Connex&quot;, &quot;Samsung Cikarang&quot;
                    </p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      title="Description"
                      placeholder="Deskripsi pekerjaan / invoice"
                      className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none"
                      value={form.description}
                      onChange={(event) => handleInputChange("description", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="po_number">PO Number</Label>
                    <Input id="po_number" value={form.po_number} onChange={(event) => handleInputChange("po_number", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="po_date">PO Date</Label>
                    <Input
                      id="po_date"
                      placeholder="YYYY-MM-DD atau DD/MM/YYYY"
                      value={form.po_date}
                      onChange={(event) => handleInputChange("po_date", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="po_value">PO Value</Label>
                    <Input id="po_value" type="number" value={form.po_value} onChange={(event) => handleInputChange("po_value", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_type">Tax Type</Label>
                    <select
                      id="tax_type"
                      title="Tax Type"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
                      value={form.tax_type}
                      onChange={(event) => handleInputChange("tax_type", event.target.value as "PPN" | "NON_PPN")}
                    >
                      <option value="PPN">PPN</option>
                      <option value="NON_PPN">NON PPN</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dpp">DPP</Label>
                    <Input id="dpp" type="number" value={form.dpp} onChange={(event) => handleInputChange("dpp", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ppn">PPN</Label>
                    <Input id="ppn" type="number" value={form.ppn} onChange={(event) => handleInputChange("ppn", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total">Total</Label>
                    <Input id="total" type="number" value={form.total} onChange={(event) => handleInputChange("total", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_value">Payment Value</Label>
                    <Input id="payment_value" type="number" value={form.payment_value} onChange={(event) => handleInputChange("payment_value", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_date">Payment Date</Label>
                    <Input id="payment_date" value={form.payment_date} onChange={(event) => handleInputChange("payment_date", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="selisih">Variance</Label>
                    <Input id="selisih" type="number" value={form.selisih} onChange={(event) => handleInputChange("selisih", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      title="Status"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
                      value={form.status}
                      onChange={(event) => handleInputChange("status", event.target.value as "PAID" | "UNPAID")}
                    >
                      <option value="UNPAID">UNPAID</option>
                      <option value="PAID">PAID</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="keterangan">Keterangan</Label>
                    <textarea
                      id="keterangan"
                      title="Keterangan"
                      placeholder="Catatan tambahan"
                      className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none"
                      value={form.keterangan}
                      onChange={(event) => handleInputChange("keterangan", event.target.value)}
                    />
                  </div>
                </div>
                )}

                {message ? (
                  <div className="rounded-xl border border-primary/15 bg-primary/6 px-4 py-3 text-sm text-muted-foreground">{message}</div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  {editingInvoice ? (
                    <>
                      <Button onClick={handleSubmit} disabled={submitting}>
                        <Pencil className="h-4 w-4" />
                        {submitting ? "Memproses..." : "Save Changes"}
                      </Button>
                      <Button variant="outline" onClick={resetForm} disabled={submitting}>
                        Close Editor
                      </Button>
                    </>
                  ) : null}
                  <Button variant="outline" onClick={handleRefresh} disabled={submitting}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh Data
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="self-start">
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
                <div>
                  <CardTitle>Live Invoice List</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Pilih invoice buat diedit atau hapus langsung dari database.</p>
                </div>
                <Badge variant="secondary">{visibleInvoices.length} shown</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    placeholder="Cari invoice no, customer, atau deskripsi..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <Button variant="outline" onClick={handleRefresh} disabled={submitting}>
                    <RefreshCw className="h-4 w-4" />
                    Reload
                  </Button>
                </div>

                <div className="space-y-3">
                  {visibleInvoices.map((invoice) => (
                    <div key={invoice.id || `${invoice.workbook_year}-${invoice.sheet_name}-${invoice.invoice_no}`} className="rounded-2xl border border-border/70 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{invoice.invoice_no}</span>
                            <Badge variant={invoice.status === "PAID" ? "default" : "secondary"}>{invoice.status}</Badge>
                            <Badge variant="outline">{invoice.tax_type}</Badge>
                          </div>
                          <div className="truncate text-sm font-medium">{invoice.customer}</div>
                          <div className="line-clamp-2 text-xs text-muted-foreground">{invoice.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {invoice.date || "-"} · {fIDR(Number(invoice.total || 0))}
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(invoice)} disabled={submitting}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(invoice)} disabled={submitting}>
                            <Trash2 className="h-4 w-4" />
                            Hapus
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Changed From Original</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Kalau ada kepencet salah, restore dari sini.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {changedInvoices.length === 0 ? (
                  <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                    Belum ada invoice yang berbeda dari data original import.
                  </div>
                ) : (
                  changedInvoices.slice(0, 8).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-amber-500/20 bg-amber-500/6 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="font-semibold">{item.invoice_no}</div>
                          <div className="text-sm">{item.customer}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatChangedInvoiceDetail(item)}</div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleRestore(item.id)} disabled={submitting}>
                          Restore Original
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Recent Activity</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Semua aksi create, update, delete, restore tercatat di sini.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {activityLogs.length === 0 ? (
                  <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                    Belum ada activity log yang tercatat.
                  </div>
                ) : (
                  activityLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="rounded-2xl border border-border/70 p-4">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="font-semibold">{log.summary}</div>
                          <div className="text-xs text-muted-foreground">{log.actor_email}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatActivityDetail(log)}</div>
                        </div>
                        <div className="text-left lg:text-right">
                          <Badge variant="outline">{log.action}</Badge>
                          <div className="mt-1 text-xs text-muted-foreground">{fDateTime(log.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
