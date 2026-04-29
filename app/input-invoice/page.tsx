"use client"

import * as React from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Plus, CheckCircle2, AlertCircle, RotateCcw, FilePlus,
  FileText, Users, DollarSign, CreditCard, ClipboardList,
} from "lucide-react"
import { useCurrentUser } from "@/components/providers/current-user-provider"

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
  invoice_no: "", project_type: "", customer: "", site_name: "",
  description: "", date: "", invoice_sent_date: "", terms_of_payment: "",
  po_number: "", po_date: "", po_value: "", tax_type: "PPN",
  dpp: "", ppn: "", total: "", payment_date: "", payment_value: "",
  selisih: "", status: "UNPAID", keterangan: "",
}

const SELECT_CLS =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors hover:border-ring focus:border-ring focus:ring-2 focus:ring-ring/20 cursor-pointer"

const TEXTAREA_CLS =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm outline-none transition-colors hover:border-ring focus:border-ring focus:ring-2 focus:ring-ring/20 resize-none"

const PAGE_STYLES = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ii-f1 { animation: fadeUp 0.38s ease both 0.04s; }
  .ii-f2 { animation: fadeUp 0.38s ease both 0.10s; }
  .ii-f3 { animation: fadeUp 0.38s ease both 0.16s; }
  .ii-f4 { animation: fadeUp 0.38s ease both 0.22s; }

  /* Section divider */
  .form-section {
    border-top: 1px solid hsl(var(--border));
    padding-top: 22px;
    margin-top: 6px;
  }
  .form-section-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 16px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: hsl(var(--muted-foreground));
    padding: 3px 10px 3px 8px;
    border-radius: 99px;
    background: hsl(var(--muted) / 0.5);
    border: 1px solid hsl(var(--border));
  }

  /* Enhanced input */
  input[type="date"] {
    cursor: pointer;
  }

  /* Summary row */
  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 12px;
    border-bottom: 1px dashed hsl(var(--border) / 0.6);
  }
  .summary-row:last-child { border-bottom: none; }
  .summary-label { color: hsl(var(--muted-foreground)); }
  .summary-value { font-family: monospace; font-weight: 600; }

  /* Status toggle */
  .status-toggle {
    display: flex;
    gap: 8px;
  }
  .status-opt {
    flex: 1;
    padding: 10px 12px;
    border-radius: 10px;
    border: 2px solid hsl(var(--border));
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    background: transparent;
  }
  .status-opt.paid {
    border-color: #16a34a;
    background: #16a34a10;
    color: #16a34a;
  }
  .status-opt.unpaid {
    border-color: hsl(var(--destructive));
    background: hsl(var(--destructive) / 0.08);
    color: hsl(var(--destructive));
  }
  .status-opt.inactive {
    border-color: hsl(var(--border));
    background: transparent;
    color: hsl(var(--muted-foreground));
  }
  .status-opt:hover.inactive { background: hsl(var(--muted) / 0.4); }

  /* Auto-calc highlight */
  .auto-calc {
    background: hsl(var(--primary) / 0.04);
    border-color: hsl(var(--primary) / 0.3) !important;
  }
`

const fIDR = (n: number) =>
  n ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n) : "—"

export default function InputInvoicePage() {
  const { user } = useCurrentUser()
  const [form, setForm] = React.useState<InvoiceFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = React.useState(false)
  const [result, setResult] = React.useState<{ type: "success" | "error"; message: string } | null>(null)
  const [submitCount, setSubmitCount] = React.useState(0)

  const set = React.useCallback(<K extends keyof InvoiceFormState>(field: K, value: InvoiceFormState[K]) => {
    setForm(curr => ({ ...curr, [field]: value }))
  }, [])

  // Auto-calculate PPN and Total from DPP
  React.useEffect(() => {
    const dpp = Number(form.dpp) || 0
    if (form.tax_type === "PPN" && dpp > 0) {
      const ppn = Math.round(dpp * 0.11)
      const total = dpp + ppn
      setForm(c => ({ ...c, ppn: String(ppn), total: String(total) }))
    } else if (form.tax_type === "NON_PPN" && dpp > 0) {
      setForm(c => ({ ...c, ppn: "0", total: String(dpp) }))
    }
  }, [form.dpp, form.tax_type])

  // Auto-calculate selisih
  React.useEffect(() => {
    const total = Number(form.total) || 0
    const paid  = Number(form.payment_value) || 0
    if (total > 0 && paid > 0) {
      setForm(c => ({ ...c, selisih: String(total - paid) }))
    }
  }, [form.total, form.payment_value])

  const handleReset = React.useCallback(() => {
    setForm(EMPTY_FORM)
    setResult(null)
  }, [])

  const handleSubmit = React.useCallback(async () => {
    const missing = [
      !form.invoice_no.trim() && "Invoice No",
      !form.customer.trim()   && "Customer",
      !form.description.trim() && "Description",
      !form.date               && "Invoice Date",
    ].filter(Boolean)

    if (missing.length > 0) {
      setResult({ type: "error", message: `Field wajib belum diisi: ${missing.join(", ")}` })
      return
    }

    const payload = {
      ...form,
      invoice_no:       form.invoice_no.trim(),
      customer:         form.customer.trim(),
      site_name:        form.site_name.trim(),
      description:      form.description.trim(),
      keterangan:       form.keterangan.trim(),
      po_number:        form.po_number.trim(),
      po_date:          form.po_date || null,
      invoice_sent_date: form.invoice_sent_date || null,
      terms_of_payment: form.terms_of_payment ? Number(form.terms_of_payment) : null,
      po_value:         Number(form.po_value   || 0),
      dpp:              Number(form.dpp         || 0),
      ppn:              Number(form.ppn         || 0),
      total:            Number(form.total       || 0),
      payment_value:    Number(form.payment_value || 0),
      selisih:          Number(form.selisih     || 0),
      actor_email:      user.email,
    }

    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal membuat invoice")
      setSubmitCount(c => c + 1)
      setResult({ type: "success", message: `Invoice ${form.invoice_no} berhasil ditambahkan ke database.` })
      setForm(EMPTY_FORM)
    } catch (err) {
      setResult({ type: "error", message: err instanceof Error ? err.message : "Gagal membuat invoice." })
    } finally {
      setSubmitting(false)
    }
  }, [form, user.email])

  const dpp   = Number(form.dpp)   || 0
  const ppn   = Number(form.ppn)   || 0
  const total = Number(form.total) || 0
  const paid  = Number(form.payment_value) || 0

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <style dangerouslySetInnerHTML={{ __html: PAGE_STYLES }} />

        <div className="flex flex-1 flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full">

          {/* ── Page Header ─────────────────────────────────────────── */}
          <div className="ii-f1 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-sm">
                <FilePlus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Input Invoice Baru</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Tambah data invoice langsung ke database PT Tri Bangun Usaha Persada
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {submitCount > 0 && (
                <Badge className="bg-green-500/10 text-green-700 border border-green-500/20 px-3 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  {submitCount} invoice ditambahkan sesi ini
                </Badge>
              )}
            </div>
          </div>

          {/* ── Result Banner ───────────────────────────────────────── */}
          {result && (
            <div className={`ii-f2 flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm font-medium ${
              result.type === "success"
                ? "border-green-500/25 bg-green-500/8 text-green-700"
                : "border-destructive/25 bg-destructive/6 text-destructive"
            }`}>
              {result.type === "success"
                ? <CheckCircle2 className="h-4.5 w-4.5 mt-0.5 shrink-0" />
                : <AlertCircle className="h-4.5 w-4.5 mt-0.5 shrink-0" />
              }
              {result.message}
            </div>
          )}

          {/* ── Main Grid ───────────────────────────────────────────── */}
          <div className="ii-f3 grid gap-6 xl:grid-cols-[1fr_360px]">

            {/* ── LEFT: Form ─────────────────────────────────────────── */}
            <div className="space-y-0">

              {/* Section 1: Identitas Invoice */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2 pt-5 px-6">
                  <div className="form-section-label" style={{ marginBottom: 0 }}>
                    <FileText className="h-3 w-3" />
                    Identitas Invoice
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                    <div className="space-y-1.5">
                      <Label htmlFor="invoice_no" className="text-xs font-semibold">
                        No. Invoice <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="invoice_no"
                        placeholder="INV/2025/001"
                        value={form.invoice_no}
                        onChange={e => set("invoice_no", e.target.value)}
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="date" className="text-xs font-semibold">
                        Tanggal Invoice <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={form.date}
                        onChange={e => set("date", e.target.value)}
                        className="h-10 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="invoice_sent_date" className="text-xs font-semibold">
                        Tanggal Kirim Invoice
                      </Label>
                      <Input
                        id="invoice_sent_date"
                        type="date"
                        value={form.invoice_sent_date}
                        onChange={e => set("invoice_sent_date", e.target.value)}
                        className="h-10 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="project_type" className="text-xs font-semibold">Tipe Proyek</Label>
                      <select id="project_type" title="Tipe Proyek" className={SELECT_CLS} value={form.project_type}
                        onChange={e => set("project_type", e.target.value as InvoiceFormState["project_type"])}>
                        <option value="">— Pilih Tipe —</option>
                        <option value="Maintenance">🔧 Maintenance</option>
                        <option value="Material/PAC">📦 Material / PAC</option>
                        <option value="Project/Instalasi">🏗️ Project / Instalasi</option>
                        <option value="Jasa">⚙️ Jasa</option>
                        <option value="Lainnya">📋 Lainnya</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="terms_of_payment" className="text-xs font-semibold">Terms of Payment</Label>
                      <select id="terms_of_payment" title="Terms of Payment" className={SELECT_CLS} value={form.terms_of_payment}
                        onChange={e => set("terms_of_payment", e.target.value as InvoiceFormState["terms_of_payment"])}>
                        <option value="">— Pilih TOP —</option>
                        <option value="15">15 hari</option>
                        <option value="30">30 hari</option>
                        <option value="45">45 hari</option>
                        <option value="60">60 hari</option>
                        <option value="90">90 hari</option>
                        <option value="120">120 hari</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="tax_type" className="text-xs font-semibold">Tipe Pajak</Label>
                      <select id="tax_type" title="Tipe Pajak" className={SELECT_CLS} value={form.tax_type}
                        onChange={e => set("tax_type", e.target.value as "PPN" | "NON_PPN")}>
                        <option value="PPN">PPN (11%)</option>
                        <option value="NON_PPN">Non PPN</option>
                      </select>
                    </div>

                  </div>
                </CardContent>
              </Card>

              {/* Section 2: Customer */}
              <Card className="shadow-sm mt-4">
                <CardHeader className="pb-2 pt-5 px-6">
                  <div className="form-section-label" style={{ marginBottom: 0 }}>
                    <Users className="h-3 w-3" />
                    Customer & Deskripsi
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="customer" className="text-xs font-semibold">
                        Nama Customer <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="customer"
                        placeholder="PT / CV / Nama Perusahaan"
                        value={form.customer}
                        onChange={e => set("customer", e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="site_name" className="text-xs font-semibold">Nama Site / Lokasi</Label>
                      <Input
                        id="site_name"
                        placeholder="Cth: Dakota Batam, Edge Connex"
                        value={form.site_name}
                        onChange={e => set("site_name", e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs font-semibold">
                      Deskripsi Pekerjaan <span className="text-destructive">*</span>
                    </Label>
                    <textarea
                      id="description"
                      placeholder="Tuliskan deskripsi pekerjaan atau layanan yang ditagihkan..."
                      className={`${TEXTAREA_CLS} min-h-[90px]`}
                      value={form.description}
                      onChange={e => set("description", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Section 3: PO & Nilai */}
              <Card className="shadow-sm mt-4">
                <CardHeader className="pb-2 pt-5 px-6">
                  <div className="form-section-label" style={{ marginBottom: 0 }}>
                    <ClipboardList className="h-3 w-3" />
                    PO & Nilai Invoice
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="po_number" className="text-xs font-semibold">No. PO</Label>
                      <Input id="po_number" placeholder="PO-2025-XXX" value={form.po_number}
                        onChange={e => set("po_number", e.target.value)} className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="po_date" className="text-xs font-semibold">Tanggal PO</Label>
                      <Input id="po_date" type="date" value={form.po_date}
                        onChange={e => set("po_date", e.target.value)} className="h-10 cursor-pointer" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="po_value" className="text-xs font-semibold">Nilai PO (Rp)</Label>
                      <Input id="po_value" type="number" placeholder="0" value={form.po_value}
                        onChange={e => set("po_value", e.target.value)} className="h-10" />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="dpp" className="text-xs font-semibold">DPP — Dasar Pengenaan Pajak (Rp)</Label>
                      <Input id="dpp" type="number" placeholder="0" value={form.dpp}
                        onChange={e => set("dpp", e.target.value)} className="h-10" />
                      <p className="text-[10px] text-muted-foreground">PPN & Total akan dihitung otomatis</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ppn" className="text-xs font-semibold">
                        PPN {form.tax_type === "PPN" ? "(11%)" : "(0%)"}
                      </Label>
                      <Input id="ppn" type="number" placeholder="0" value={form.ppn}
                        onChange={e => set("ppn", e.target.value)}
                        className={`h-10 ${dpp > 0 ? "auto-calc" : ""}`} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="total" className="text-xs font-semibold">Total Invoice (Rp)</Label>
                      <Input id="total" type="number" placeholder="0" value={form.total}
                        onChange={e => set("total", e.target.value)}
                        className={`h-10 ${dpp > 0 ? "auto-calc" : ""}`} />
                    </div>
                  </div>

                  {/* Value preview */}
                  {dpp > 0 && (
                    <div className="mt-4 rounded-xl bg-muted/40 border p-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Ringkasan Nilai</p>
                      <div className="space-y-1">
                        <div className="summary-row">
                          <span className="summary-label">DPP</span>
                          <span className="summary-value">{fIDR(dpp)}</span>
                        </div>
                        <div className="summary-row">
                          <span className="summary-label">PPN ({form.tax_type === "PPN" ? "11%" : "0%"})</span>
                          <span className="summary-value">{fIDR(ppn)}</span>
                        </div>
                        <div className="summary-row" style={{ borderBottom: "2px solid hsl(var(--border))", paddingBottom: 8, marginBottom: 4 }}>
                          <span className="summary-label font-semibold text-foreground">Total</span>
                          <span className="summary-value text-primary font-bold text-base">{fIDR(total)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Section 4: Pembayaran */}
              <Card className="shadow-sm mt-4">
                <CardHeader className="pb-2 pt-5 px-6">
                  <div className="form-section-label" style={{ marginBottom: 0 }}>
                    <CreditCard className="h-3 w-3" />
                    Pembayaran
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="payment_value" className="text-xs font-semibold">Nilai Pembayaran (Rp)</Label>
                      <Input id="payment_value" type="number" placeholder="0" value={form.payment_value}
                        onChange={e => set("payment_value", e.target.value)} className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="payment_date" className="text-xs font-semibold">Tanggal Pembayaran</Label>
                      <Input id="payment_date" type="date" value={form.payment_date}
                        onChange={e => set("payment_date", e.target.value)} className="h-10 cursor-pointer" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="selisih" className="text-xs font-semibold">Selisih / Variance (Rp)</Label>
                      <Input id="selisih" type="number" placeholder="0" value={form.selisih}
                        onChange={e => set("selisih", e.target.value)}
                        className={`h-10 ${paid > 0 && total > 0 ? "auto-calc" : ""}`} />
                      {paid > 0 && total > 0 && (
                        <p className="text-[10px] text-muted-foreground">Dihitung otomatis: Total − Pembayaran</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Status Invoice</Label>
                      <div className="status-toggle">
                        <button
                          type="button"
                          className={`status-opt ${form.status === "PAID" ? "paid" : "inactive"}`}
                          onClick={() => set("status", "PAID")}
                        >
                          ✓ LUNAS
                        </button>
                        <button
                          type="button"
                          className={`status-opt ${form.status === "UNPAID" ? "unpaid" : "inactive"}`}
                          onClick={() => set("status", "UNPAID")}
                        >
                          ⏳ BELUM BAYAR
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="keterangan" className="text-xs font-semibold">Keterangan / Catatan (opsional)</Label>
                    <textarea
                      id="keterangan"
                      placeholder="Catatan tambahan mengenai invoice ini..."
                      className={`${TEXTAREA_CLS} min-h-[72px]`}
                      value={form.keterangan}
                      onChange={e => set("keterangan", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* ── RIGHT: Action Panel ─────────────────────────────────── */}
            <div className="ii-f4 space-y-4">
              <Card className="sticky top-6 shadow-sm">
                <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Simpan Invoice</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-4">

                  {/* Live Preview */}
                  <div className="rounded-xl bg-muted/40 border p-4 space-y-2.5">
                    <div className="summary-row">
                      <span className="summary-label">Invoice No</span>
                      <span className={`summary-value font-mono ${form.invoice_no ? "text-foreground" : "text-muted-foreground opacity-50"}`}>
                        {form.invoice_no || "—"}
                      </span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-label">Customer</span>
                      <span className={`summary-value truncate max-w-[140px] text-right ${form.customer ? "text-foreground" : "text-muted-foreground opacity-50"}`}>
                        {form.customer || "—"}
                      </span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-label">Tanggal</span>
                      <span className={`summary-value ${form.date ? "text-foreground" : "text-muted-foreground opacity-50"}`}>
                        {form.date ? new Date(form.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-label">Total</span>
                      <span className={`summary-value ${total ? "text-primary font-bold" : "text-muted-foreground opacity-50"}`}>
                        {total ? fIDR(total) : "—"}
                      </span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-label">Status</span>
                      <span className={`summary-value font-bold ${form.status === "PAID" ? "text-green-600" : "text-destructive"}`}>
                        {form.status === "PAID" ? "✓ LUNAS" : "⏳ BELUM BAYAR"}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full h-11 gap-2 font-semibold text-base"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4.5 w-4.5" />
                        Tambah Invoice
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full h-10 gap-2"
                    onClick={handleReset}
                    disabled={submitting}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Form
                  </Button>

                  <p className="text-[11px] text-center text-muted-foreground pt-1">
                    Login sebagai <span className="font-semibold text-foreground">{user.email}</span>
                  </p>
                </CardContent>
              </Card>

              {/* Help card */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm">Panduan Pengisian</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-2 text-xs text-muted-foreground">
                  <p className="flex gap-2">
                    <span className="text-destructive font-bold shrink-0">*</span>
                    Field bertanda merah wajib diisi sebelum simpan.
                  </p>
                  <p className="flex gap-2">
                    <span className="text-primary shrink-0">→</span>
                    Pilih tanggal menggunakan kalender yang muncul.
                  </p>
                  <p className="flex gap-2">
                    <span className="text-primary shrink-0">→</span>
                    Isi <strong className="text-foreground">DPP</strong> — PPN & Total otomatis terhitung.
                  </p>
                  <p className="flex gap-2">
                    <span className="text-primary shrink-0">→</span>
                    Invoice tersimpan ke database dan langsung tampil di semua halaman.
                  </p>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
