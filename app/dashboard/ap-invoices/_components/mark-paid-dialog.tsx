"use client"

import * as React from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useBulkMarkPaid } from "../_hooks/use-ap-invoices"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// Used for both the per-row "Mark Paid" (target.ids.length === 1) and the
// bulk-selection action bar (target.ids.length > 1) — same PATCH shape
// either way (POST /api/ap-invoices/bulk-paid accepts a single id fine).
export type MarkPaidTarget = { ids: string[]; label: string }

export function MarkPaidDialog({ target, onClose }: {
  target:  MarkPaidTarget | null
  onClose: () => void
}) {
  const bulkMarkPaid = useBulkMarkPaid()
  const [paymentDate, setPaymentDate] = React.useState(todayISO)

  React.useEffect(() => { if (target) setPaymentDate(todayISO()) }, [target])

  if (!target) return null

  const handleConfirm = () => {
    if (!paymentDate) {
      toast.error("Tanggal pembayaran wajib diisi.")
      return
    }
    bulkMarkPaid.mutate(
      { ids: target.ids, payment_date: paymentDate },
      {
        onSuccess: () => { toast.success(`${target.ids.length} invoice ditandai Paid.`); onClose() },
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal menandai Paid."),
      }
    )
  }

  return (
    <Dialog open={!!target} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tandai Sudah Dibayar</DialogTitle>
          <DialogDescription>{target.label}</DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Tanggal Pembayaran</Label>
          <input
            type="date" autoFocus value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Batal</Button>
          <Button type="button" size="sm" onClick={handleConfirm} disabled={bulkMarkPaid.isPending}>
            Konfirmasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
