"use client"

import * as React from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"
import type { ApInvoice, ApVendor } from "@/types/ap-invoice"
import { computeTotal } from "@/lib/ap-invoices/status-rules"
import { apInvoiceFormSchema } from "@/lib/ap-invoices/schema"
import { useCreateInvoice, useUpdateInvoice, useCreateVendor } from "../_hooks/use-ap-invoices"
import { CurrencyInput } from "./currency-input"

const NEW_VENDOR_VALUE = "__new_vendor__"
const inputCls = "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// DPP/PPN/PPh are fully manual — tax rates are variable (some invoices are
// 0%, PPN is moving from 11% to 12%, PPh varies by service type), so
// nothing auto-fills on blur. These quick-select badges are an opt-in
// one-click helper next to each field, never a forced default.
function RateBadges({ rates, dpp, onPick }: { rates: number[]; dpp: number; onPick: (amount: number) => void }) {
  return (
    <div className="flex items-center gap-1 mt-1">
      {rates.map(rate => (
        <button
          key={rate}
          type="button"
          onClick={() => onPick(Math.round(dpp * rate))}
          className="text-[10px] px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
          title={`Isi dengan ${rate * 100}% dari DPP`}
        >
          {rate * 100}%
        </button>
      ))}
    </div>
  )
}

// Shared by both "Invoice Baru" (invoice=null) and the row/vendor/placeholder
// click Edit modal (invoice=<row>) — same centered Dialog layout either way,
// per the "no drawers" requirement. Edit performs a lightweight PATCH via
// the existing optimistic useUpdateInvoice mutation, no page reload.
export function InvoiceFormDialog({ open, onClose, vendors, invoice }: {
  open:     boolean
  onClose:  () => void
  vendors:  ApVendor[]
  invoice?: ApInvoice | null
}) {
  const isEdit = !!invoice
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const createVendor  = useCreateVendor()
  const saving = createInvoice.isPending || updateInvoice.isPending

  const [vendorId, setVendorId] = React.useState("")
  const [addingVendor, setAddingVendor] = React.useState(false)
  const [newVendorName, setNewVendorName] = React.useState("")

  const [poDate, setPoDate] = React.useState<string>("")
  const [poNumber, setPoNumber] = React.useState("")
  const [projectName, setProjectName] = React.useState("")
  const [invoiceDate, setInvoiceDate] = React.useState("")
  const [invoiceNumber, setInvoiceNumber] = React.useState("")
  const [dpp, setDpp] = React.useState<number | null>(null)
  const [ppn, setPpn] = React.useState<number | null>(null)
  const [pph, setPph] = React.useState<number | null>(null)
  const [totalDraft, setTotalDraft] = React.useState<number | null | undefined>(undefined) // undefined = follow the live formula
  const [dueDate, setDueDate] = React.useState("")

  // Auto-populate from the row on edit; blank defaults (draft-friendly) on create.
  React.useEffect(() => {
    if (!open) return
    setVendorId(invoice?.vendor_id ?? "")
    setAddingVendor(false); setNewVendorName("")
    setPoDate(invoice?.po_date ?? "")
    setPoNumber(invoice?.po_number ?? "")
    setProjectName(invoice?.project_name ?? "")
    setInvoiceDate(invoice?.invoice_date ?? (isEdit ? "" : todayISO()))
    setInvoiceNumber(invoice?.invoice_number ?? "")
    setDpp(invoice?.dpp_amount ?? null)
    setPpn(invoice?.ppn_amount ?? null)
    setPph(invoice?.pph_amount ?? null)
    setTotalDraft(undefined)
    setDueDate(invoice?.due_date ?? "")
  }, [open, invoice, isEdit])

  // Live-recomputed while DPP/PPN/PPh change, but a manual edit of Total
  // itself always wins — never silently overwritten.
  const formulaTotal = dpp != null || ppn != null || pph != null ? computeTotal(dpp ?? 0, ppn ?? 0, pph ?? 0) : null
  const totalValue = totalDraft !== undefined ? totalDraft : formulaTotal

  const selectedVendorName = vendors.find(v => v.id === vendorId)?.name

  const handleVendorSelect = (value: string) => {
    if (value === NEW_VENDOR_VALUE) { setAddingVendor(true); return }
    setVendorId(value)
  }

  const handleCreateVendor = () => {
    const name = newVendorName.trim()
    if (!name) { toast.error("Nama vendor tidak boleh kosong."); return }
    createVendor.mutate(name, {
      onSuccess: (vendor) => {
        setVendorId(vendor.id); setAddingVendor(false); setNewVendorName("")
        toast.success(`Vendor "${vendor.name}" ditambahkan.`)
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menambahkan vendor."),
    })
  }

  const handleSubmit = () => {
    const parsed = apInvoiceFormSchema.safeParse({
      vendor_id:      vendorId,
      po_date:        poDate || null,
      po_number:      poNumber.trim() || null,
      project_name:   projectName.trim() || null,
      invoice_date:   invoiceDate || null,
      invoice_number: invoiceNumber.trim() || null,
      dpp_amount:     dpp,
      ppn_amount:     ppn,
      pph_amount:     pph,
      total_amount:   totalValue,
      due_date:       dueDate || null,
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Data tidak valid.")
      return
    }

    if (isEdit) {
      updateInvoice.mutate(
        { id: invoice.id, ...parsed.data },
        {
          onSuccess: () => { toast.success("Invoice diperbarui."); onClose() },
          onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal memperbarui invoice."),
        }
      )
    } else {
      createInvoice.mutate(parsed.data, {
        onSuccess: () => { toast.success("Draft invoice dibuat."); onClose() },
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat invoice."),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0">
        <DialogHeader className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <DialogTitle>{isEdit ? "Edit Invoice" : "Invoice Baru"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Isi data yang belum lengkap kapan saja — dokumen boleh menyusul."
              : "Cukup pilih vendor untuk membuat draft; sisanya bisa diisi belakangan."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Vendor</Label>
            {!addingVendor ? (
              <Select value={vendorId} onValueChange={handleVendorSelect}>
                <SelectTrigger className={`w-full text-sm h-10 ${inputCls}`}>
                  <SelectValue placeholder="Pilih vendor">{selectedVendorName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_VENDOR_VALUE} className="text-sm font-medium text-primary">
                    <Plus className="h-3.5 w-3.5" /> Tambah Vendor Baru
                  </SelectItem>
                  {vendors.length > 0 && <SelectSeparator />}
                  {vendors.map(v => (
                    <SelectItem key={v.id} value={v.id} className="text-sm">{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  autoFocus type="text" value={newVendorName}
                  onChange={e => setNewVendorName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCreateVendor() }}
                  placeholder="Nama vendor baru (mis. PT Adimas)..."
                  className={inputCls}
                />
                <Button type="button" size="sm" onClick={handleCreateVendor} disabled={createVendor.isPending}>Simpan</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setAddingVendor(false); setNewVendorName("") }}>Batal</Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">PO Date <span className="font-normal normal-case text-muted-foreground/70">(opsional)</span></Label>
              <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">PO Number <span className="font-normal normal-case text-muted-foreground/70">(opsional)</span></Label>
              <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="Belum ada" className={inputCls} />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Project Name <span className="font-normal normal-case text-muted-foreground/70">(opsional)</span></Label>
            <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="mis. CMM Cikupa" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Invoice Date <span className="font-normal normal-case text-muted-foreground/70">(opsional)</span></Label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Invoice Number <span className="font-normal normal-case text-muted-foreground/70">(opsional)</span></Label>
              <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Belum ada" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">DPP</Label>
              <CurrencyInput value={dpp} onChange={setDpp} className={inputCls} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">PPN</Label>
              <CurrencyInput value={ppn} onChange={setPpn} className={inputCls} />
              <RateBadges rates={[0.11, 0.12]} dpp={dpp ?? 0} onPick={amount => setPpn(amount)} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">PPh</Label>
              <CurrencyInput value={pph} onChange={setPph} className={inputCls} />
              <RateBadges rates={[0.02]} dpp={dpp ?? 0} onPick={amount => setPph(amount)} />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Total <span className="font-normal normal-case text-muted-foreground/70">(otomatis DPP+PPN-PPh, bisa diubah manual)</span>
            </Label>
            <CurrencyInput value={totalValue} onChange={setTotalDraft} className={inputCls} />
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Due Date <span className="font-normal normal-case text-muted-foreground/70">(kosongkan untuk Open Debt)</span>
            </Label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 bg-muted/30 px-6 py-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Batal</Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={saving}>
            {isEdit ? "Simpan Perubahan" : "Buat Draft Invoice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
