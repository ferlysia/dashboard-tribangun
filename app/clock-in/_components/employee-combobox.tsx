"use client"

import * as React from "react"
import { ChevronsUpDown } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

export interface Employee {
  employee_id: string
  full_name:   string
}

// Minimal search-as-you-type picker built on the existing Popover primitive
// (already used by assignee-cell.tsx) rather than pulling in cmdk — no new
// dependency for what's a client-side filter over a list already in props.
export function EmployeeCombobox({ employees, value, onChange, disabled }: {
  employees: Employee[]
  value:     Employee | null
  onChange:  (employee: Employee) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? employees.filter(e => e.full_name.toLowerCase().includes(q)) : employees
    return list.slice(0, 50)
  }, [employees, query])

  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setQuery("") }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex items-center justify-between rounded border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={value ? "" : "text-muted-foreground"}>
            {value?.full_name ?? "Pilih nama..."}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Cari nama..."
          className="mb-2 w-full rounded border px-2 py-1.5 text-sm"
        />
        <div className="max-h-56 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ditemukan</p>
          )}
          {filtered.map(employee => (
            <button
              key={employee.employee_id}
              type="button"
              onClick={() => { onChange(employee); setOpen(false) }}
              className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              {employee.full_name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
