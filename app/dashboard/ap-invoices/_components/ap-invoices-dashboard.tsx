"use client"

import * as React from "react"
import { Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ApInvoice } from "@/types/ap-invoice"
import { computeInvoiceUrgency } from "@/lib/ap-invoices/status-rules"
import { formatIDR } from "@/lib/format"
import { useInvoicesQuery, useVendorsQuery } from "../_hooks/use-ap-invoices"
import { InvoiceGrid } from "./invoice-grid"
import { ByVendorView } from "./by-vendor-view"
import { BulkActionBar } from "./bulk-action-bar"
import { MarkPaidDialog, type MarkPaidTarget } from "./mark-paid-dialog"
import { CreateInvoiceDialog } from "./create-invoice-dialog"
import { ImportExportBar } from "./import-export-bar"

const EMPTY_INVOICES: never[] = []
const EMPTY_VENDORS: never[] = []

function KpiTile({ label, value, tone }: { label: string; value: string; tone: "red" | "orange" | "green" | "blue" | "slate" }) {
  const toneClass = {
    red:    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
    orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400",
    green:  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
    blue:   "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400",
    slate:  "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  }[tone]
  return (
    <div className={`rounded-xl border-2 px-4 py-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  )
}

export function ApInvoicesDashboard() {
  const invoicesQuery = useInvoicesQuery()
  const vendorsQuery = useVendorsQuery()
  const invoices = invoicesQuery.data ?? EMPTY_INVOICES
  const vendors = vendorsQuery.data ?? EMPTY_VENDORS

  const [activeTab, setActiveTab] = React.useState("priority")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [markPaidTarget, setMarkPaidTarget] = React.useState<MarkPaidTarget | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id); else next.delete(id)
      return next
    })
  }
  const toggleSelectGroup = (ids: string[], checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => { if (checked) next.add(id); else next.delete(id) })
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())

  const { unpaid, priorityQueue, doneHistory, outstandingTotal, overdueCount, priorityCount, openDebtCount } = React.useMemo(() => {
    const unpaid = invoices.filter(inv => !inv.payment_date)
    const doneHistory = invoices.filter(inv => inv.payment_date)
    const priorityQueue: ApInvoice[] = []
    let overdueCount = 0, priorityCount = 0, openDebtCount = 0
    for (const inv of unpaid) {
      const { urgency } = computeInvoiceUrgency(inv)
      if (urgency === "OVERDUE") { overdueCount++; priorityQueue.push(inv) }
      else if (urgency === "PRIORITY") { priorityCount++; priorityQueue.push(inv) }
      else if (urgency === "OPEN_DEBT") openDebtCount++
    }
    const outstandingTotal = unpaid.reduce((sum, inv) => sum + inv.total_amount, 0)
    return { unpaid, priorityQueue, doneHistory, outstandingTotal, overdueCount, priorityCount, openDebtCount }
  }, [invoices])

  const activeInvoicesForTab =
    activeTab === "priority" ? priorityQueue :
    activeTab === "all"      ? unpaid :
    activeTab === "done"     ? doneHistory :
    unpaid // "vendor" tab renders ByVendorView directly off `unpaid`

  const handleMarkPaidSingle = (invoice: ApInvoice) =>
    setMarkPaidTarget({ ids: [invoice.id], label: `${invoice.ap_vendors?.name ?? ""} — ${invoice.invoice_number}` })
  const handleMarkPaidBulk = () =>
    setMarkPaidTarget({ ids: Array.from(selectedIds), label: `${selectedIds.size} invoice terpilih` })

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">AP Invoice Tracking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Accounts Payable — jadwal pembayaran vendor</p>
        </div>
        <div className="flex items-center gap-2">
          {invoicesQuery.isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <ImportExportBar invoices={activeInvoicesForTab} exportFilename={`ap-invoices-${activeTab}.xlsx`} />
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Invoice Baru
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiTile label="Outstanding" value={formatIDR(outstandingTotal)} tone="slate" />
        <KpiTile label="Overdue" value={String(overdueCount)} tone="red" />
        <KpiTile label="Priority (≤7d)" value={String(priorityCount)} tone="orange" />
        <KpiTile label="Open Debt" value={String(openDebtCount)} tone="blue" />
        <KpiTile label="Paid" value={String(doneHistory.length)} tone="green" />
      </div>

      <BulkActionBar count={selectedIds.size} onMarkPaid={handleMarkPaidBulk} onClear={clearSelection} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-9">
          <TabsTrigger value="priority" className="text-xs">Priority Queue ({priorityQueue.length})</TabsTrigger>
          <TabsTrigger value="all" className="text-xs">All Invoices ({unpaid.length})</TabsTrigger>
          <TabsTrigger value="vendor" className="text-xs">By Vendor</TabsTrigger>
          <TabsTrigger value="done" className="text-xs">Done / History ({doneHistory.length})</TabsTrigger>
        </TabsList>

        {invoicesQuery.isLoading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground mt-4">
            Memuat invoice...
          </div>
        ) : (
          <>
            <TabsContent value="priority" className="mt-4">
              <InvoiceGrid
                invoices={priorityQueue}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectGroup={toggleSelectGroup}
                onMarkPaid={handleMarkPaidSingle}
                emptyMessage="Tidak ada invoice di Priority Queue — semua aman."
              />
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              <InvoiceGrid
                invoices={unpaid}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectGroup={toggleSelectGroup}
                onMarkPaid={handleMarkPaidSingle}
                emptyMessage="Belum ada invoice aktif."
              />
            </TabsContent>
            <TabsContent value="vendor" className="mt-4">
              <ByVendorView
                invoices={unpaid}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectGroup={toggleSelectGroup}
                onMarkPaid={handleMarkPaidSingle}
              />
            </TabsContent>
            <TabsContent value="done" className="mt-4">
              <InvoiceGrid
                invoices={doneHistory}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectGroup={toggleSelectGroup}
                onMarkPaid={handleMarkPaidSingle}
                emptyMessage="Belum ada invoice yang lunas."
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      <MarkPaidDialog
        target={markPaidTarget}
        onClose={() => { setMarkPaidTarget(null); clearSelection() }}
      />
      <CreateInvoiceDialog open={createOpen} onClose={() => setCreateOpen(false)} vendors={vendors} />
    </div>
  )
}
