"use client"

import * as React from "react"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import * as XLSX from "xlsx"
import { Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil, Search, MapPin, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusEditDialog } from "./status-edit-dialog"
import type { AttendanceStatus, AttendanceTableRow } from "../_hooks/use-attendance-table"
import type { StatusFilter } from "./kpi-cards"

const PAGE_SIZE = 10

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  masuk: "Masuk",
  alpha: "Alpha",
  sakit: "Sakit",
  izin:  "Izin",
  cuti:  "Cuti",
}

const STATUS_BADGE_CLASS: Record<AttendanceStatus, string> = {
  masuk: "bg-hr-success/12 text-hr-success-deep ring-1 ring-inset ring-hr-success/25",
  alpha: "bg-hr-danger/12 text-hr-danger-deep ring-1 ring-inset ring-hr-danger/25",
  sakit: "bg-hr-warning/18 text-hr-warning-deep ring-1 ring-inset ring-hr-warning/35",
  izin:  "bg-hr-info/12 text-hr-info ring-1 ring-inset ring-hr-info/25",
  cuti:  "bg-hr-blush-200 text-hr-rose-deep ring-1 ring-inset ring-hr-hairline-brand",
}

function matchesFilter(status: AttendanceStatus, filter: StatusFilter): boolean {
  if (filter === "all") return true
  if (filter === "present") return status === "masuk"
  if (filter === "alpha") return status === "alpha"
  if (filter === "sick") return status === "sakit"
  return status === "izin" || status === "cuti" // "leave"
}

function formatTime(recordedAt: string | null): string {
  if (!recordedAt) return "—"
  return new Date(recordedAt).toLocaleTimeString("id-ID", {
    hour:     "2-digit",
    minute:   "2-digit",
    timeZone: "Asia/Jakarta",
  })
}

function StatusPill({ row, onClick }: { row: AttendanceTableRow; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-hr-pill px-3 py-1.5 font-hr-sans text-xs font-semibold transition-all hover:brightness-95 active:scale-95",
        STATUS_BADGE_CLASS[row.status]
      )}
    >
      {STATUS_LABEL[row.status]}
      <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70" />
    </button>
  )
}

// Highly responsive: everything (search + status filter) is a plain
// client-side array filter over data already in the query cache — no
// debounce, no network round-trip, so results update on every keystroke.
export function AttendanceTable({
  rows,
  isLoading,
  date,
  filter,
  search,
  onSearchChange,
}: {
  rows:           AttendanceTableRow[] | undefined
  isLoading:      boolean
  date:           string
  filter:         StatusFilter
  search:         string
  onSearchChange: (next: string) => void
}) {
  const [editing, setEditing] = React.useState<AttendanceTableRow | null>(null)

  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return (rows ?? []).filter(
      r => matchesFilter(r.status, filter) && (q === "" || r.fullName.toLowerCase().includes(q))
    )
  }, [rows, filter, search])

  const columns = React.useMemo<ColumnDef<AttendanceTableRow>[]>(() => [
    {
      accessorKey: "fullName",
      header:      "Nama Karyawan",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-hr-blush-100 font-hr-sans text-[11px] font-bold text-hr-rose-deep">
            {row.original.fullName.trim().slice(0, 1).toUpperCase()}
          </span>
          <span className="font-hr-sans font-semibold text-hr-text">{row.original.fullName}</span>
        </div>
      ),
    },
    {
      accessorKey: "siteName",
      header:      "Site",
      cell: ({ row }) => {
        const { siteName, latitude, longitude, locationFlagged, locationFlagReason } = row.original
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-hr-sans text-hr-text-2">{siteName ?? "—"}</span>
            {latitude != null && longitude != null && (
              <a
                href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Lihat lokasi di Google Maps"
                className="text-hr-rose transition-colors hover:text-hr-rose-deep"
              >
                <MapPin className="h-3.5 w-3.5" />
              </a>
            )}
            {locationFlagged && (
              <span title={locationFlagReason ?? "Lokasi ditandai untuk ditinjau"}>
                <ShieldAlert className="h-3.5 w-3.5 text-hr-warning-deep" />
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "recordedAt",
      header:      "Jam Clock-in",
      cell:        ({ row }) => <span className="font-hr-sans text-hr-text-2">{formatTime(row.original.recordedAt)}</span>,
    },
    {
      accessorKey: "status",
      header:      "Status",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <StatusPill row={row.original} onClick={() => setEditing(row.original)} />
          {row.original.remarks && (
            <span className="max-w-48 truncate font-hr-sans text-[11px] text-hr-text-3">{row.original.remarks}</span>
          )}
        </div>
      ),
    },
  ], [])

  const table = useReactTable({
    data:                  filteredRows,
    columns,
    getCoreRowModel:       getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState:          { pagination: { pageSize: PAGE_SIZE } },
  })

  // Keeps a match always on-screen instead of stranded on a page the user
  // isn't looking at — resets to page 1 whenever the visible set changes.
  React.useEffect(() => {
    table.setPageIndex(0)
  }, [search, filter, table])

  const handleExport = () => {
    const sheetData = filteredRows.map(r => ({
      "Nama Karyawan": r.fullName,
      "Site":          r.siteName ?? "—",
      "Jam Clock-in":  formatTime(r.recordedAt),
      "Status":        STATUS_LABEL[r.status],
      "Catatan":       r.remarks ?? "",
    }))
    const sheet = XLSX.utils.json_to_sheet(sheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, "Kehadiran")
    XLSX.writeFile(workbook, `kehadiran-${date}.xlsx`)
  }

  const pageIndex = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()

  return (
    <div className="rounded-hr-3xl border border-hr-hairline bg-white p-5 shadow-hr-card">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-hr-display text-lg font-black text-hr-ink">Data Kehadiran</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hr-text-3" />
            <Input
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Cari nama karyawan..."
              className="h-9 w-full rounded-hr-xl border-hr-hairline pl-9 font-hr-sans text-sm sm:w-64"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-hr-xl border-hr-hairline font-hr-sans"
            onClick={handleExport}
            disabled={filteredRows.length === 0}
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      {isLoading && <p className="font-hr-sans text-sm text-hr-text-2">Memuat...</p>}
      {!isLoading && filteredRows.length === 0 && (
        <p className="font-hr-sans text-sm text-hr-text-2">Tidak ada data untuk filter ini.</p>
      )}

      {!isLoading && filteredRows.length > 0 && (
        <>
          <div className="overflow-hidden rounded-hr-xl border border-hr-hairline">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id} className="border-hr-hairline bg-hr-cream-200 hover:bg-hr-cream-200">
                    {headerGroup.headers.map(header => (
                      <TableHead key={header.id} className="font-hr-sans text-xs font-semibold uppercase tracking-hr-eyebrow text-hr-text-3">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map(row => (
                  <TableRow key={row.id} className="border-hr-hairline hover:bg-hr-cream-100">
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id} className="py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="font-hr-sans text-xs text-hr-text-3">
              Halaman {pageIndex + 1} dari {pageCount} — {filteredRows.length} karyawan
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" className="rounded-hr-lg border-hr-hairline" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon-sm" className="rounded-hr-lg border-hr-hairline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon-sm" className="rounded-hr-lg border-hr-hairline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon-sm" className="rounded-hr-lg border-hr-hairline" onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <StatusEditDialog row={editing} date={date} onClose={() => setEditing(null)} />
    </div>
  )
}
