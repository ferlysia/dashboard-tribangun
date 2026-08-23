"use client"

import * as React from "react"
import * as XLSX from "xlsx"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMonthlyRecap, type MonthlyRecap, type MonthlyRecapEmployee } from "../_hooks/use-monthly-recap"
import { getJakartaToday } from "../_lib/week"

const PAGE_SIZE = 10
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

function buildExport(recap: MonthlyRecap, rows: MonthlyRecapEmployee[]) {
  const summaryHeaders = ["Hadir (Reguler)", "Shift Weekend", "Cuti", "Sakit", "Izin", "Alpha", "Keterangan"]
  const totalCols = 2 + recap.daysInMonth + summaryHeaders.length

  const titleRow = new Array(totalCols).fill("")
  titleRow[0] = `Rekap Kehadiran Bulan ${recap.monthLabel}`

  const headerRow1 = ["No", "Nama Karyawan", ...recap.dayHeaders.map(d => d.day), ...summaryHeaders]
  const headerRow2 = ["", "", ...recap.dayHeaders.map(d => d.label), ...summaryHeaders.map(() => "")]

  const dataRows = rows.map((emp, idx) => [
    idx + 1,
    emp.fullName,
    ...emp.cells,
    emp.totals.weekdayMasuk,
    emp.totals.weekendShifts,
    emp.totals.cuti,
    emp.totals.sakit,
    emp.totals.izin,
    emp.totals.alpha,
    emp.keterangan,
  ])

  const worksheet = XLSX.utils.aoa_to_sheet([titleRow, headerRow1, headerRow2, ...dataRows])

  const summaryColStart = 2 + recap.daysInMonth
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
    { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
    ...summaryHeaders.map((_, i) => ({ s: { r: 1, c: summaryColStart + i }, e: { r: 2, c: summaryColStart + i } })),
  ]

  worksheet["!cols"] = [
    { wch: 4 },
    { wch: 24 },
    ...recap.dayHeaders.map(() => ({ wch: 6 })),
    ...summaryHeaders.map(h => ({ wch: Math.max(11, h.length + 2) })),
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Bulanan")
  XLSX.writeFile(workbook, `rekap-kehadiran-${recap.year}-${String(recap.month).padStart(2, "0")}.xlsx`)
}

export function MonthlyRecapView() {
  const today = React.useMemo(() => getJakartaToday(), [])
  const [year, setYear] = React.useState(today.getFullYear())
  const [month, setMonth] = React.useState(today.getMonth() + 1)
  const [search, setSearch] = React.useState("")

  const recapQuery = useMonthlyRecap(year, month)
  const recap = recapQuery.data

  const isCurrentYear = year === today.getFullYear()
  const maxMonth = isCurrentYear ? today.getMonth() + 1 : 12
  const years = React.useMemo(() => {
    const current = today.getFullYear()
    return [current - 2, current - 1, current]
  }, [today])

  const filteredEmployees = React.useMemo(() => {
    if (!recap) return []
    const q = search.trim().toLowerCase()
    return q === "" ? recap.employees : recap.employees.filter(e => e.fullName.toLowerCase().includes(q))
  }, [recap, search])

  const columns = React.useMemo<ColumnDef<MonthlyRecapEmployee>[]>(() => [
    {
      id:     "no",
      header: "No",
      cell:   ({ row }) => <span className="font-hr-sans text-hr-text-3">{row.index + 1}</span>,
    },
    {
      accessorKey: "fullName",
      header:      "Nama Karyawan",
      cell:        ({ row }) => <span className="font-hr-sans font-semibold text-hr-text">{row.original.fullName}</span>,
    },
    {
      id:     "weekdayMasuk",
      header: "Hadir",
      cell:   ({ row }) => <span className="font-hr-sans font-semibold text-hr-success-deep">{row.original.totals.weekdayMasuk}</span>,
    },
    {
      id:     "weekendShifts",
      header: "Shift Weekend",
      cell:   ({ row }) => <span className="font-hr-sans font-semibold text-hr-info">{row.original.totals.weekendShifts}</span>,
    },
    {
      id:     "cuti",
      header: "Cuti",
      cell:   ({ row }) => <span className="font-hr-sans text-hr-rose-deep">{row.original.totals.cuti}</span>,
    },
    {
      id:     "sakit",
      header: "Sakit",
      cell:   ({ row }) => <span className="font-hr-sans text-hr-warning-deep">{row.original.totals.sakit}</span>,
    },
    {
      id:     "izin",
      header: "Izin",
      cell:   ({ row }) => <span className="font-hr-sans text-hr-info">{row.original.totals.izin}</span>,
    },
    {
      id:     "alpha",
      header: "Alpha",
      cell:   ({ row }) => <span className="font-hr-sans font-semibold text-hr-danger-deep">{row.original.totals.alpha}</span>,
    },
    {
      accessorKey: "keterangan",
      header:      "Keterangan",
      cell:        ({ row }) => (
        <span className="block max-w-56 truncate font-hr-sans text-xs text-hr-text-3" title={row.original.keterangan}>
          {row.original.keterangan || "—"}
        </span>
      ),
    },
  ], [])

  const table = useReactTable({
    data:                  filteredEmployees,
    columns,
    getCoreRowModel:       getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState:          { pagination: { pageSize: PAGE_SIZE } },
  })

  React.useEffect(() => {
    table.setPageIndex(0)
  }, [search, year, month, table])

  const pageIndex = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()

  return (
    <div className="rounded-hr-3xl border border-hr-hairline bg-white p-5 shadow-hr-card">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-hr-brand text-white">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-hr-display text-lg font-black text-hr-ink">Rekap Bulanan</h2>
            <p className="font-hr-sans text-xs text-hr-text-3">Untuk kebutuhan payroll — export lengkap tersedia di Excel</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="h-9 w-36 rounded-hr-xl border-hr-hairline font-hr-sans text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={name} value={String(i + 1)} disabled={i + 1 > maxMonth}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(year)} onValueChange={v => {
            const nextYear = Number(v)
            setYear(nextYear)
            if (nextYear === today.getFullYear() && month > today.getMonth() + 1) setMonth(today.getMonth() + 1)
          }}>
            <SelectTrigger className="h-9 w-24 rounded-hr-xl border-hr-hairline font-hr-sans text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hr-text-3" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama karyawan..."
              className="h-9 w-full rounded-hr-xl border-hr-hairline pl-9 font-hr-sans text-sm sm:w-56"
            />
          </div>

          <Button
            size="sm"
            className="h-9 rounded-hr-xl bg-hr-brand font-hr-sans font-semibold shadow-hr-brand hover:brightness-105"
            onClick={() => recap && buildExport(recap, filteredEmployees)}
            disabled={!recap || filteredEmployees.length === 0}
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      {recapQuery.isLoading && <p className="font-hr-sans text-sm text-hr-text-2">Memuat rekap bulanan...</p>}
      {recapQuery.isError && (
        <p className="font-hr-sans text-sm text-hr-danger-deep">
          {recapQuery.error instanceof Error ? recapQuery.error.message : "Gagal memuat rekap bulanan"}
        </p>
      )}
      {!recapQuery.isLoading && recap && filteredEmployees.length === 0 && (
        <p className="font-hr-sans text-sm text-hr-text-2">Tidak ada data untuk filter ini.</p>
      )}

      {!recapQuery.isLoading && recap && filteredEmployees.length > 0 && (
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
              Halaman {pageIndex + 1} dari {pageCount} — {filteredEmployees.length} karyawan
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
    </div>
  )
}
