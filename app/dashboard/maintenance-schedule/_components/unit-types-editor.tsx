"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { UnitTypeEntry } from "@/types/pm-schedule"

// Freeform add/remove rows for a unit type breakdown, e.g. splitting a
// plain "2 units" into 1 "upflow" + 1 "downflow". `type` is a free-typed
// string (no enum) per the requirement that it be fully customizable.
// Uncontrolled-ish: every row edit calls onChange immediately with the next
// full array — callers own debouncing/commit timing (blur, button, etc.).
export function UnitTypesEditor({ value, onChange }: {
  value:    UnitTypeEntry[]
  onChange: (next: UnitTypeEntry[]) => void
}) {
  const addRow = () => onChange([...value, { type: "", qty: 1 }])
  const removeRow = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const patchRow = (i: number, patch: Partial<UnitTypeEntry>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))

  return (
    <div className="flex flex-col gap-1.5">
      {value.map((row, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            type="text"
            value={row.type}
            onChange={e => patchRow(i, { type: e.target.value })}
            placeholder="Tipe (mis. PAC, UPS)"
            className="flex-1 min-w-0 rounded-md border border-slate-300 dark:border-slate-700 bg-background text-xs text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <input
            type="number"
            min={0}
            value={row.qty}
            onChange={e => patchRow(i, { qty: Math.max(0, Number(e.target.value) || 0) })}
            className="w-16 rounded-md border border-slate-300 dark:border-slate-700 bg-background text-xs text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="p-1 text-muted-foreground hover:text-red-600 transition-colors"
            title="Hapus tipe ini"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs w-fit" onClick={addRow}>
        <Plus className="h-3.5 w-3.5" /> Tambah Tipe
      </Button>
    </div>
  )
}
