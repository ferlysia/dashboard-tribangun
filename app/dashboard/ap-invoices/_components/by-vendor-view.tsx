"use client"

import * as React from "react"
import type { ApInvoice } from "@/types/ap-invoice"
import { buildVendorProfiles, matchesSearch, type VendorProfile } from "@/lib/ap-invoices/grouping"
import { daysBetween } from "@/lib/ap-invoices/status-rules"
import { formatIDR } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Table, TableFooter, TableRow, TableCell } from "@/components/ui/table"
import { InvoiceGrid } from "./invoice-grid"
import { AnimatedCollapse, CollapseTrigger } from "./animated-collapse"

const HISTORY_PAGE_SIZE = 3 // months shown before "Load Older History"

// Requirement 2: far-right accordion-trigger KPI. Fully settled vendors get
// a quiet badge instead of a "Rp 0"; active vendors get an urgency-colored
// "Next Due" badge next to their outstanding total.
function NextDueBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) {
    return (
      <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 whitespace-nowrap">
        Open Debt
      </span>
    )
  }
  const days = daysBetween(new Date(), dueDate)
  const tone =
    days < 0  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" :
    days <= 7 ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" :
                "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
  const label =
    days < 0  ? `Next Due: Lewat ${Math.abs(days)}h` :
    days === 0 ? "Next Due: Hari ini" :
                 `Next Due: ${days}h lagi`
  return <span className={`text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${tone}`}>{label}</span>
}

function VendorMasterRow({ profile, forceOpen, selectedIds, onToggleSelect, onToggleSelectGroup, onMarkPaid, onEdit }: {
  profile:              VendorProfile
  forceOpen:            boolean
  selectedIds:          Set<string>
  onToggleSelect:       (id: string, checked: boolean) => void
  onToggleSelectGroup:  (ids: string[], checked: boolean) => void
  onMarkPaid:           (invoice: ApInvoice) => void
  onEdit:               (invoice: ApInvoice) => void
}) {
  const [manualOpen, setManualOpen] = React.useState(false)
  const open = forceOpen || manualOpen
  const [visibleMonths, setVisibleMonths] = React.useState(HISTORY_PAGE_SIZE)

  const shownHistory = profile.paidByMonth.slice(0, visibleMonths)
  const hiddenMonths = profile.paidByMonth.length - visibleMonths

  return (
    <div className="rounded-xl border-2 border-rose-100 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
      <CollapseTrigger
        open={open}
        onClick={() => setManualOpen(v => !v)}
        className="w-full flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3.5 text-left hover:bg-rose-50/60 dark:hover:bg-rose-950/20 transition-colors"
      >
        <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 min-w-[160px]">{profile.vendorName}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{profile.totalInvoices} invoice</span>
        <span className="text-xs text-teal-700 dark:text-teal-400 font-bold">{profile.totalPaidCount} lunas</span>
        <span className="text-xs text-amber-700 dark:text-amber-400 font-bold">{profile.totalUnpaidCount} belum bayar</span>
        {profile.totalUnpaidCount === 0 ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            ✅ All Settled
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-2">
            <NextDueBadge dueDate={profile.unpaidRows[0]?.due_date ?? null} />
            <span className="text-sm font-extrabold text-rose-700 dark:text-rose-400">{formatIDR(profile.outstandingBalance)}</span>
          </span>
        )}
      </CollapseTrigger>

      <AnimatedCollapse open={open}>
        <div className="flex flex-col gap-4 p-3.5 bg-rose-50/30 dark:bg-slate-950/40 border-t border-rose-100 dark:border-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1.5">
              Belum Bayar — urut jatuh tempo terdekat
            </p>
            <InvoiceGrid
              invoices={profile.unpaidRows}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onToggleSelectGroup={onToggleSelectGroup}
              onMarkPaid={onMarkPaid}
              onEdit={onEdit}
              emptyMessage="Tidak ada invoice aktif untuk vendor ini."
              footer={
                profile.unpaidRows.length > 0 && (
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    Total Outstanding: {formatIDR(profile.unpaidRows.reduce((sum, r) => sum + (r.total_amount ?? 0), 0))}
                  </span>
                )
              }
            />
          </div>

          {profile.paidByMonth.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-1.5">Riwayat Pembayaran</p>
              <div className="flex flex-col gap-2">
                {shownHistory.map(month => (
                  <div key={month.key} className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 capitalize">{month.label}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">· {month.rows.length} invoice</span>
                      <span className="ml-auto text-xs font-bold text-teal-700 dark:text-teal-400">{formatIDR(month.total)}</span>
                    </div>
                    <div className="p-2">
                      <InvoiceGrid
                        invoices={month.rows}
                        selectedIds={selectedIds}
                        onToggleSelect={onToggleSelect}
                        onToggleSelectGroup={onToggleSelectGroup}
                        onMarkPaid={onMarkPaid}
                        onEdit={onEdit}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Master footer: absolute total across ALL paid invoices for
                  this vendor, not just the months currently mounted. */}
              <Table className="mt-1">
                <TableFooter className="bg-teal-50/60 dark:bg-teal-950/20 rounded-lg">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell className="text-right text-xs font-bold text-teal-700 dark:text-teal-400 py-2">
                      Grand Total Paid: {formatIDR(profile.paidByMonth.flatMap(m => m.rows).reduce((sum, r) => sum + (r.total_amount ?? 0), 0))}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>

              {/* Keeps the DOM light — older paid months only mount once requested. */}
              {hiddenMonths > 0 && (
                <Button
                  type="button" variant="ghost" size="sm"
                  className="mt-2 h-8 text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-400 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/30"
                  onClick={() => setVisibleMonths(v => v + HISTORY_PAGE_SIZE)}
                >
                  Muat riwayat lebih lama ({hiddenMonths} bulan lagi)
                </Button>
              )}
            </div>
          )}
        </div>
      </AnimatedCollapse>
    </div>
  )
}

export function ByVendorView({ invoices, searchQuery, selectedIds, onToggleSelect, onToggleSelectGroup, onMarkPaid, onEdit }: {
  invoices:             ApInvoice[] // full vendor history — paid + unpaid
  searchQuery:          string
  selectedIds:          Set<string>
  onToggleSelect:       (id: string, checked: boolean) => void
  onToggleSelectGroup:  (ids: string[], checked: boolean) => void
  onMarkPaid:           (invoice: ApInvoice) => void
  onEdit:               (invoice: ApInvoice) => void
}) {
  const searching = searchQuery.trim().length > 0

  const profiles = React.useMemo(() => {
    const all = buildVendorProfiles(invoices)
    const filtered = !searching ? all : all.filter(p =>
      // A vendor stays in view if its name matches, or any one of its
      // invoices does — the row keeps showing its full due-date-sorted
      // context rather than being reduced to just the matching line.
      p.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoices.some(inv => inv.vendor_id === p.vendorId && matchesSearch(inv, searchQuery))
    )

    // Smart Priority Sort: fully settled vendors (0 unpaid) sink to the
    // absolute bottom. Active vendors sort by their earliest unpaid
    // due_date (unpaidRows is already due-date-ascending from
    // buildVendorProfiles, so [0] is the earliest); ties broken by highest
    // outstanding balance first.
    return [...filtered].sort((a, b) => {
      const aSettled = a.totalUnpaidCount === 0
      const bSettled = b.totalUnpaidCount === 0
      if (aSettled !== bSettled) return aSettled ? 1 : -1
      if (aSettled) return a.vendorName.localeCompare(b.vendorName)

      const aDue = a.unpaidRows[0]?.due_date ?? null
      const bDue = b.unpaidRows[0]?.due_date ?? null
      if (aDue !== bDue) {
        if (!aDue) return 1  // open-debt (no due date) sinks below dated ones
        if (!bDue) return -1
        const cmp = aDue.localeCompare(bDue) // earlier due date first
        if (cmp !== 0) return cmp
      }
      return b.outstandingBalance - a.outstandingBalance
    })
  }, [invoices, searchQuery, searching])

  if (profiles.length === 0) {
    return (
      <div className="rounded-xl border border-rose-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
        {searching ? "Tidak ada vendor yang cocok." : "Belum ada invoice."}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {profiles.map(profile => (
        <VendorMasterRow
          key={profile.vendorId}
          profile={profile}
          forceOpen={searching}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onToggleSelectGroup={onToggleSelectGroup}
          onMarkPaid={onMarkPaid}
          onEdit={onEdit}
        />
      ))}
    </div>
  )
}
