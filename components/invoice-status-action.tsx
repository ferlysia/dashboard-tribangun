"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useInvoices } from "@/components/providers/invoices-provider"
import { useCurrentUser } from "@/components/providers/current-user-provider"
import type { InvoiceRecord } from "@/types/invoice"

type InvoiceStatusActionInvoice = Pick<InvoiceRecord, "id" | "status" | "total">

export function InvoiceStatusAction({ invoice }: { invoice: InvoiceStatusActionInvoice }) {
  const { refresh } = useInvoices()
  const { user } = useCurrentUser()
  const [loading, setLoading] = React.useState(false)
  const isPaid = invoice.status === "PAID"

  const handleToggle = React.useCallback(async () => {
    if (!invoice.id) return

    setLoading(true)
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor_email: user.email,
          status: isPaid ? "UNPAID" : "PAID",
          payment_date: isPaid ? "" : new Date().toISOString().slice(0, 10),
          payment_value: isPaid ? 0 : invoice.total,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Gagal update status")
      }

      await refresh()
    } finally {
      setLoading(false)
    }
  }, [invoice.id, invoice.total, isPaid, refresh, user.email])

  return (
    <div className="flex flex-col items-start gap-2">
      <Badge
        variant={isPaid ? "default" : "destructive"}
        className={isPaid ? "bg-green-600 hover:bg-green-700 text-white" : ""}
      >
        {isPaid ? "LUNAS" : "BELUM BAYAR"}
      </Badge>
      <Button variant="outline" size="sm" onClick={handleToggle} disabled={loading || !invoice.id}>
        {loading ? "Update..." : isPaid ? "Set Unpaid" : "Set Paid"}
      </Button>
    </div>
  )
}
