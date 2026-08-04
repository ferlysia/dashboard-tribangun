"use client"

import * as React from "react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ApInvoice } from "@/types/ap-invoice"
import { computeInvoiceUrgency } from "@/lib/ap-invoices/status-rules"
import { useImportInvoices } from "../_hooks/use-ap-invoices"

// Export is pure client-side — the active tab's already-fetched+filtered
// row list is exactly what's on screen, so this just serializes that
// in-memory array with the already-installed `xlsx` package. No server
// round-trip, consistent with the zero-lag/zero-write philosophy.
function exportToExcel(invoices: ApInvoice[], filename: string) {
  const rows = invoices.map(inv => {
    const { urgency, days } = computeInvoiceUrgency(inv)
    return {
      Vendor:          inv.ap_vendors?.name ?? "",
      "PO Date":       inv.po_date ?? "",
      "PO Number":     inv.po_number ?? "",
      Project:         inv.project_name ?? "",
      "Invoice Date":  inv.invoice_date,
      "Invoice Number": inv.invoice_number,
      DPP:             inv.dpp_amount,
      PPN:             inv.ppn_amount,
      PPh:             inv.pph_amount,
      Total:           inv.total_amount,
      "Due Date":      inv.due_date ?? "",
      "Payment Date":  inv.payment_date ?? "",
      Status:          urgency,
      Days:            days,
    }
  })
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "AP Invoices")
  XLSX.writeFile(book, filename)
}

export function ImportExportBar({ invoices, exportFilename }: { invoices: ApInvoice[]; exportFilename: string }) {
  const importInvoices = useImportInvoices()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    importInvoices.mutate(file, {
      onSuccess: ({ summary, errors }) => {
        toast.success(`Import selesai: ${summary.inserted} baru, ${summary.updated} diperbarui${summary.vendorsCreated ? `, ${summary.vendorsCreated} vendor baru` : ""}.`)
        if (errors.length > 0) toast.warning(`${errors.length} baris dilewati — lihat console untuk detail.`)
        if (errors.length > 0) console.warn("AP invoice import warnings:", errors)
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengimpor file."),
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button" size="sm" variant="outline" className="gap-1.5 text-xs"
        onClick={() => exportToExcel(invoices, exportFilename)}
        disabled={invoices.length === 0}
      >
        <Download className="h-3.5 w-3.5" /> Export
      </Button>
      <Button
        type="button" size="sm" variant="outline" className="gap-1.5 text-xs"
        onClick={() => fileInputRef.current?.click()}
        disabled={importInvoices.isPending}
      >
        <Upload className="h-3.5 w-3.5" /> {importInvoices.isPending ? "Mengimpor..." : "Import Excel"}
      </Button>
      <input
        ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
        title="Import Excel invoice AP" className="hidden"
        onChange={handleImportChange}
      />
    </div>
  )
}
