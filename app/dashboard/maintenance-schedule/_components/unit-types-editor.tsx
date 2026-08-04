"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { UnitTypeEntry } from "@/types/pm-schedule"

// sns[i] is unit i's serial number — kept in sync with qty (padded/
// truncated) so the render below always has exactly `qty` slots to draw an
// input for, same resize-on-count-change idea as visitDates in
// create-schedule-dialog.tsx.
function resizeSns(sns: (string | null)[] | undefined, qty: number): (string | null)[] {
  const next = (sns ?? []).slice(0, qty)
  while (next.length < qty) next.push("")
  return next
}

// Freeform add/remove rows for a unit type breakdown, e.g. splitting a
// plain "2 units" into 1 "upflow" + 1 "downflow" — each with its own
// serial number, since a single visit can service multiple physical units
// of the same type. `type` is a free-typed string (no enum).
// Uncontrolled-ish: every row edit calls onChange immediately with the next
// full array — callers own debouncing/commit timing (blur, button, etc.).
export function UnitTypesEditor({ value, onChange }: {
  value:    UnitTypeEntry[]
  onChange: (next: UnitTypeEntry[]) => void
}) {
  const addRow = () => onChange([...value, { type: "", qty: 1, sns: [""] }])
  const removeRow = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const patchRow = (i: number, patch: Partial<UnitTypeEntry>) =>
    onChange(value.map((row, idx) => {
      if (idx !== i) return row
      const merged = { ...row, ...patch }
      return { ...merged, sns: resizeSns(merged.sns, merged.qty) }
    }))
  const patchSn = (i: number, unitIdx: number, sn: string) =>
    onChange(value.map((row, idx) => {
      if (idx !== i) return row
      const sns = resizeSns(row.sns, row.qty)
      sns[unitIdx] = sn
      return { ...row, sns }
    }))

  return (
    <div className="flex flex-col gap-2">
      {value.map((row, i) => {
        const sns = resizeSns(row.sns, row.qty)
        return (
          <div key={i} className="rounded-md border border-slate-200 dark:border-slate-800 p-2">
            <div className="flex items-center gap-1.5">
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
            {sns.length > 0 && (
              <div className="mt-1.5 pl-1 flex flex-col gap-1">
                {sns.map((sn, unitIdx) => (
                  <div key={unitIdx} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground w-14 shrink-0">Unit {unitIdx + 1} SN</span>
                    <input
                      type="text"
                      value={sn ?? ""}
                      onChange={e => patchSn(i, unitIdx, e.target.value)}
                      placeholder="Opsional"
                      className="flex-1 min-w-0 rounded-md border border-slate-300 dark:border-slate-700 bg-background text-xs text-foreground px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs w-fit" onClick={addRow}>
        <Plus className="h-3.5 w-3.5" /> Tambah Tipe
      </Button>
    </div>
  )
}
