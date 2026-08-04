"use client"

import * as React from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"
import type { ApVendor } from "@/types/ap-invoice"
import { computeTotal } from "@/lib/ap-invoices/status-rules"
import { useCreateInvoice, useCreateVendor } from "../_hooks/use-ap-invoices"

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

export function CreateInvoiceDialog({ open, onClose, vendors }: {
  open:     boolean
  onClose:  () => void
  vendors:  ApVendor[]
}) {
  const createInvoice = useCreateInvoice()
  const createVendor  = useCreateVendor()

  const [vendorId, setVendorId] = React.useState("")
  const [addingVendor, setAddingVendor] = React.useState(false)
  const [newVendorName, setNewVendorName] = React.useState("")

  const [poDate, setPoDate] = React.useState("")
  const [poNumber, setPoNumber] = React.useState("")
  const [projectName, setProjectName] = React.useState("")
  const [invoiceDate, setInvoiceDate] = React.useState(todayISO)
  const [invoiceNumber, setInvoiceNumber] = React.useState("")
  const [dpp, setDpp] = React.useState("0")
  const [ppn, setPpn] = React.useState("0")
  const [pph, setPph] = React.useState("0")
  const [totalDraft, setTotalDraft] = React.useState<string | null>(null)
  const [dueDate, setDueDate] = React.useState("")

  React.useEffect(() => {
    if (!open) return
    setVendorId(""); setAddingVendor(false); setNewVendorName("")
    setPoDate(""); setPoNumber(""); setProjectName("")
    setInvoiceDate(todayISO()); setInvoiceNumber("")
    setDpp("0"); setPpn("0"); setPph("0"); setTotalDraft(null); setDueDate("")
  }, [open])

  const dppN = Number(dpp) || 0
  const ppnN = Number(ppn) || 0
  const pphN = Number(pph) || 0
  // Live-recomputed as any of the three change, but totalDraft (once the
  // user types into Total directly) wins — never silently overwritten.
  const totalValue = totalDraft ?? String(computeTotal(dppN, ppnN, pphN))

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
    if (!vendorId || !invoiceDate || !invoiceNumber.trim()) {
      toast.error("Pilih vendor, isi tanggal dan nomor invoice.")
      return
    }
    createInvoice.mutate(
      {
        vendor_id:      vendorId,
        po_date:        poDate || null,
        po_number:      poNumber.trim() || null,
        project_name:   projectName.trim() || null,
        invoice_date:   invoiceDate,
        invoice_number: invoiceNumber.trim(),
        dpp_amount:     dppN,
        ppn_amount:     ppnN,
        pph_amount:     pphN,
        total_amount:   Number(totalValue) || 0,
        due_date:       dueDate || null,
      },
      {
        onSuccess: () => { toast.success("Invoice dibuat."); onClose() },
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat invoice."),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0">
        <DialogHeader className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <DialogTitle>Invoice Baru</DialogTitle>
          <DialogDescription>Kosongkan Due Date untuk Open Debt (tanpa jatuh tempo, dilacak sebagai aging).</DialogDescription>
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
              <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Project Name <span className="font-normal normal-case text-muted-foreground/70">(opsional)</span></Label>
            <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="mis. CMM Cikupa" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Invoice Date</Label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Invoice Number</Label>
              <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">DPP</Label>
              <input type="number" min={0} value={dpp} onChange={e => setDpp(e.target.value)} className={inputCls} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">PPN</Label>
              <input type="number" min={0} value={ppn} onChange={e => setPpn(e.target.value)} className={inputCls} />
              <RateBadges rates={[0.11, 0.12]} dpp={dppN} onPick={amount => setPpn(String(amount))} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">PPh</Label>
              <input type="number" min={0} value={pph} onChange={e => setPph(e.target.value)} className={inputCls} />
              <RateBadges rates={[0.02]} dpp={dppN} onPick={amount => setPph(String(amount))} />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Total <span className="font-normal normal-case text-muted-foreground/70">(otomatis DPP+PPN-PPh, bisa diubah manual)</span>
            </Label>
            <input type="number" value={totalValue} onChange={e => setTotalDraft(e.target.value)} className={inputCls} />
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
          <Button type="button" size="sm" onClick={handleSubmit} disabled={createInvoice.isPending}>Buat Invoice</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
