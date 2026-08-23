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
import { MoreHorizontal, Download, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusEditDialog } from "./status-edit-dialog"
import type { AttendanceStatus, AttendanceTableRow } from "../_hooks/use-attendance-table"
import type { StatusFilter } from "./kpi-cards"

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  masuk: "Masuk",
  alpha: "Alpha",
  sakit: "Sakit",
  izin:  "Izin",
  cuti:  "Cuti",
}

const STATUS_BADGE_CLASS: Record<AttendanceStatus, string> = {
  masuk: "border-transparent bg-hr-success/15 text-hr-success-deep",
  alpha: "border-transparent bg-hr-danger/15 text-hr-danger-deep",
  sakit: "border-transparent bg-hr-warning/20 text-hr-warning-deep",
  izin:  "border-transparent bg-hr-info/15 text-hr-info",
  cuti:  "border-transparent bg-hr-blush-200 text-hr-rose-deep",
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

export function AttendanceTable({
  rows,
  isLoading,
  date,
  filter,
}: {
  rows:      AttendanceTableRow[] | undefined
  isLoading: boolean
  date:      string
  filter:    StatusFilter
}) {
  const [editing, setEditing] = React.useState<AttendanceTableRow | null>(null)

  const filteredRows = React.useMemo(
    () => (rows ?? []).filter(r => matchesFilter(r.status, filter)),
    [rows, filter]
  )

  const columns = React.useMemo<ColumnDef<AttendanceTableRow>[]>(() => [
    {
      accessorKey: "fullName",
      header:      "Nama Karyawan",
      cell:        ({ row }) => <span className="font-hr-sans font-semibold text-hr-text">{row.original.fullName}</span>,
    },
    {
      accessorKey: "siteName",
      header:      "Site",
      cell:        ({ row }) => <span className="font-hr-sans text-hr-text-2">{row.original.siteName ?? "—"}</span>,
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
        <Badge className={cn("font-hr-sans font-semibold", STATUS_BADGE_CLASS[row.original.status])}>
          {STATUS_LABEL[row.original.status]}
        </Badge>
      ),
    },
    {
      id:     "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(row.original)}>Ubah Status & Catatan</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [])

  const table = useReactTable({
    data:                     filteredRows,
    columns,
    getCoreRowModel:          getCoreRowModel(),
    getPaginationRowModel:    getPaginationRowModel(),
    initialState:             { pagination: { pageSize: 10 } },
  })

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

  return (
    <div className="rounded-hr-3xl border border-hr-hairline bg-white p-5 shadow-hr-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-hr-display text-lg font-black text-hr-ink">Data Kehadiran</h2>
        <Button variant="outline" size="sm" className="font-hr-sans" onClick={handleExport} disabled={filteredRows.length === 0}>
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      {isLoading && <p className="font-hr-sans text-sm text-hr-text-2">Memuat...</p>}
      {!isLoading && filteredRows.length === 0 && (
        <p className="font-hr-sans text-sm text-hr-text-2">Tidak ada data untuk filter ini.</p>
      )}

      {!isLoading && filteredRows.length > 0 && (
        <>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
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
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-3 flex items-center justify-between">
            <p className="font-hr-sans text-xs text-hr-text-3">
              Halaman {table.getState().pagination.pageIndex + 1} dari {table.getPageCount()} — {filteredRows.length} karyawan
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <StatusEditDialog row={editing} date={date} onClose={() => setEditing(null)} />
    </div>
  )
}
