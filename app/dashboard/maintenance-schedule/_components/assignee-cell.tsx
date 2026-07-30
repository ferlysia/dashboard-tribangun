"use client"

import * as React from "react"
import { Users } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { AssigneesInput } from "./assignees-input"

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0]
}

// Compact, fixed-width, first-name-only read view of a visit's assignees —
// the table-only fix for AssigneesInput being full-width and full-name,
// which stretched the column and cluttered the row even at the real-world
// cap of ~4 technicians per site. Editing still goes through the exact
// same AssigneesInput (full names, add/remove chips) inside a popover, so
// no data/logic changes, only how it's displayed at rest. Shared by Matrix
// Grid and both All Sites grouping modes via ScheduleTableRow.
export function AssigneeCell({ value, options, onChange }: {
  value:     string[]
  options:   string[]
  onChange:  (next: string[]) => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-[110px] flex flex-wrap items-center gap-1 rounded-md border border-transparent hover:border-slate-300 dark:hover:border-slate-700 px-1 py-1 text-left transition-colors"
        >
          {value.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" /> Unassigned
            </span>
          ) : (
            value.slice(0, 4).map(name => (
              <span
                key={name}
                className="inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100 truncate max-w-[90px]"
                title={name}
              >
                {firstName(name)}
              </span>
            ))
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" onClick={e => e.stopPropagation()}>
        <p className="text-xs font-semibold text-foreground mb-2">Assignee</p>
        <AssigneesInput value={value} options={options} onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}
