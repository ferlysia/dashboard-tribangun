"use client"

import * as React from "react"
import { ChevronRight, Search, User } from "lucide-react"
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface Employee {
  employee_id: string
  full_name:   string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

// Bottom-sheet picker (vaul Drawer, same primitive already used elsewhere
// in the app) — a full-height searchable list with large tap targets is
// far more thumb-friendly on a phone than the small Popover this
// replaced, and swipe-to-dismiss feels native. Same props as before, so
// nothing calling this component needs to change.
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
    <Drawer open={open} onOpenChange={next => { setOpen(next); if (!next) setQuery("") }}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="employee-trigger" className="text-xs text-muted-foreground">Nama Karyawan</Label>
        <button
          id="employee-trigger"
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex h-14 w-full items-center justify-between gap-2 rounded-xl border bg-background px-4 text-left shadow-xs transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
              value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {value ? initials(value.full_name) : <User className="h-4 w-4" />}
            </span>
            <span className={cn("truncate text-base", value ? "font-medium" : "text-muted-foreground")}>
              {value?.full_name ?? "Pilih nama..."}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
      </div>

      <DrawerContent className="flex max-h-[85vh] flex-col">
        <DrawerHeader className="shrink-0 text-left">
          <DrawerTitle>Pilih Nama Karyawan</DrawerTitle>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari nama..."
              className="h-11 pl-9"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Tidak ditemukan</p>
            )}
            <div className="flex flex-col gap-1 pb-[env(safe-area-inset-bottom)]">
              {filtered.map(employee => (
                <DrawerClose asChild key={employee.employee_id}>
                  <button
                    type="button"
                    onClick={() => onChange(employee)}
                    className="flex h-14 w-full shrink-0 items-center gap-3 rounded-lg px-3 text-left active:bg-accent"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {initials(employee.full_name)}
                    </span>
                    <span className="truncate text-base font-medium">{employee.full_name}</span>
                  </button>
                </DrawerClose>
              ))}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
