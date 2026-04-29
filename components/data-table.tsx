"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel, // Tambahkan ini untuk fungsi search
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import {
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InvoiceStatusAction } from "@/components/invoice-status-action"
import type { InvoiceRecord } from "@/types/invoice"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TableInvoiceRow = Pick<
  InvoiceRecord,
  "id" | "invoice_no" | "customer" | "site_name" | "date" | "status" | "total"
> & {
  amount: number
  category: string
}

/* =======================
   COLUMNS (Disesuaikan dengan Excel PT TUP)
======================= */
const columns: ColumnDef<TableInvoiceRow>[] = [
  {
    accessorKey: "invoice_no",
    header: "No. Invoice",
  },
  {
    accessorKey: "customer",
    header: "Customer",
    cell: ({ row }) => {
      const customer: string = row.getValue("customer") ?? ""
      const site: string = row.original.site_name ?? ""
      return (
        <div>
          <div className="font-medium">{customer.replace(/\s*\([^)]*\)\s*/g, "").trim() || customer}</div>
          {site && <div className="text-xs text-muted-foreground">{site}</div>}
        </div>
      )
    },
  },
  {
    // hidden searchable column for site_name
    accessorKey: "site_name",
    header: "",
    enableHiding: true,
  },
  {
    accessorKey: "date",
    header: "Tanggal",
  },
  {
    accessorKey: "category",
    header: "Kategori",
    cell: ({ row }) => {
      const category = String(row.original.category || "Umum")
      const styles: Record<string, string> = {
        Maintenance: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
        "Material/PAC": "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
        Project: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
        Jasa: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
        Umum: "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
      }

      return (
        <Badge variant="outline" className={styles[category] ?? styles.Umum}>
          {category}
        </Badge>
      )
    },
  },
  {
    accessorKey: "amount",
    header: "Amount (DPP)",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"))
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(amount)
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      return <InvoiceStatusAction invoice={row.original} />
    },
  },
]

/* =======================
   DATA TABLE COMPONENT
======================= */
export function DataTable({ data }: { data: TableInvoiceRow[] }) {
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  // Keep search predictable without forcing pagination back to page 1 on every re-render.
  React.useEffect(() => {
    setPagination((current) => (current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }))
  }, [globalFilter])

  React.useEffect(() => {
    setPagination((current) => {
      const lastPageIndex = Math.max(0, Math.ceil(data.length / current.pageSize) - 1)
      if (current.pageIndex <= lastPageIndex) return current
      return { ...current, pageIndex: lastPageIndex }
    })
  }, [data.length])

  const table = useReactTable({
    data: data || [],
    columns,
    state: {
      globalFilter,
      columnVisibility: { site_name: false },
      pagination,
    },
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    autoResetPageIndex: false,
  })

  return (
    <div className="space-y-4">
      {/* 1. SEARCH BAR */}
      <div className="flex items-center justify-between gap-4">
        <input
          placeholder="Cari Customer / Site Name (Samsung Cikarang, Dakota Batam...)"
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex gap-2">
           <Badge variant="outline" className="h-10 px-4">Total: {data.length} Invoices</Badge>
        </div>
      </div>

      {/* 2. STYLED TABLE */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-primary/[0.08] dark:bg-primary/[0.13] border-b-2 border-primary/20">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="h-12 px-4 text-left align-middle font-bold text-primary/80 text-xs uppercase tracking-wide">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-b transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="p-4 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Data tidak ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 3. PAGINATION */}
      <div className="flex items-center justify-between py-2">
         <p className="text-sm text-muted-foreground">
            Halaman {table.getState().pagination.pageIndex + 1} dari {table.getPageCount()}
         </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-4"
          >
            <IconChevronLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-4"
          >
            Next <IconChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
