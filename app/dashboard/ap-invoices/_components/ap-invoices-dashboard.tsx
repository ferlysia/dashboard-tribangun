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

function KpiTile({ label, value, tone }: { label: string; value: string; tone: "rose" | "amber" | "teal" | "violet" | "pink" } ) {
  const toneClass = {
    rose:   "border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-700 dark:border-rose-800 dark:from-rose-950/40 dark:to-slate-900 dark:text-rose-300",
    amber:  "border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-800 dark:border-amber-800 dark:from-amber-950/40 dark:to-slate-900 dark:text-amber-300",
    teal:   "border-teal-200 bg-gradient-to-br from-teal-50 to-white text-teal-700 dark:border-teal-800 dark:from-teal-950/40 dark:to-slate-900 dark:text-teal-300",
    violet: "border-violet-200 bg-gradient-to-br from-violet-50 to-white text-violet-700 dark:border-violet-800 dark:from-violet-950/40 dark:to-slate-900 dark:text-violet-300",
    pink:   "border-pink-200 bg-gradient-to-br from-pink-50 to-white text-pink-700 dark:border-pink-800 dark:from-pink-950/40 dark:to-slate-900 dark:text-pink-300",
  }[tone]
  return (
    <div className={`rounded-xl border-2 px-4 py-3.5 shadow-sm ${toneClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">{label}</p>
      <p className="text-2xl font-extrabold mt-0.5">{value}</p>
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
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight bg-gradient-to-r from-rose-600 to-fuchsia-600 dark:from-rose-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
            AP Invoice Tracking
          </h1>
          <p className="text-sm text-slate-500 dark:text-muted-foreground mt-0.5">Accounts Payable — jadwal pembayaran vendor</p>
        </div>
        <div className="flex items-center gap-2">
          {invoicesQuery.isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-rose-400" />}
          <ImportExportBar invoices={activeInvoicesForTab} exportFilename={`ap-invoices-${activeTab}.xlsx`} />
          <Button size="sm" className="gap-1.5 h-9 text-xs font-semibold bg-gradient-to-r from-rose-500 to-fuchsia-500 hover:from-rose-600 hover:to-fuchsia-600 text-white shadow-md shadow-rose-200 dark:shadow-fuchsia-950/40 border-0" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Invoice Baru
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiTile label="Outstanding" value={formatIDR(outstandingTotal)} tone="teal" />
        <KpiTile label="Overdue" value={String(overdueCount)} tone="rose" />
        <KpiTile label="Priority (≤7d)" value={String(priorityCount)} tone="amber" />
        <KpiTile label="Open Debt" value={String(openDebtCount)} tone="violet" />
        <KpiTile label="Paid" value={String(doneHistory.length)} tone="pink" />
      </div>

      <BulkActionBar count={selectedIds.size} onMarkPaid={handleMarkPaidBulk} onClear={clearSelection} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-auto p-1.5 gap-1.5 bg-rose-50/70 dark:bg-slate-900/60 rounded-2xl border border-rose-100 dark:border-slate-800">
          <TabsTrigger
            value="priority"
            className="text-sm font-semibold px-5 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-rose-100/80 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-fuchsia-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-rose-200 dark:data-[state=active]:shadow-fuchsia-950/50 data-[state=active]:font-bold data-[state=active]:border-0"
          >
            Priority Queue ({priorityQueue.length})
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="text-sm font-semibold px-5 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-rose-100/80 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-fuchsia-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-rose-200 dark:data-[state=active]:shadow-fuchsia-950/50 data-[state=active]:font-bold data-[state=active]:border-0"
          >
            All Invoices ({unpaid.length})
          </TabsTrigger>
          <TabsTrigger
            value="vendor"
            className="text-sm font-semibold px-5 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-rose-100/80 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-fuchsia-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-rose-200 dark:data-[state=active]:shadow-fuchsia-950/50 data-[state=active]:font-bold data-[state=active]:border-0"
          >
            By Vendor
          </TabsTrigger>
          <TabsTrigger
            value="done"
            className="text-sm font-semibold px-5 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-rose-100/80 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-fuchsia-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-rose-200 dark:data-[state=active]:shadow-fuchsia-950/50 data-[state=active]:font-bold data-[state=active]:border-0"
          >
            Done / History ({doneHistory.length})
          </TabsTrigger>
        </TabsList>

        {invoicesQuery.isLoading ? (
          <div className="rounded-xl border border-rose-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400 mt-4">
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
