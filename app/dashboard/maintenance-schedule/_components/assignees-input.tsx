"use client"

import * as React from "react"
import { X } from "lucide-react"

// Chip-based multi-select for technicians/team assigned to a visit — same
// datalist-autocomplete-from-existing-data approach as the old single-value
// input (still no separate technicians table), just multi-value. Always
// optional: an empty `value` renders as a plain empty input with a
// placeholder, never blocks anything. Each add/remove calls onChange
// immediately (the caller wires that straight into an optimistic
// useUpdateSchedule mutation) — there's no separate "commit" step since a
// chip add/remove is already a discrete, complete action.
export function AssigneesInput({ value, options, onChange, placeholder, disabled }: {
  value:        string[]
  options:      string[]
  onChange:     (next: string[]) => void
  placeholder?: string
  disabled?:    boolean
}) {
  const [draft, setDraft] = React.useState("")
  const listId = React.useId()

  const addChip = () => {
    const name = draft.trim()
    setDraft("")
    if (!name || value.includes(name)) return
    onChange([...value, name])
  }

  const removeChip = (name: string) => onChange(value.filter(v => v !== name))

  return (
    <div className="flex flex-wrap items-center gap-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background px-1.5 py-1 focus-within:ring-2 focus-within:ring-ring/40">
      {value.map(name => (
        <span
          key={name}
          className="inline-flex items-center gap-1 text-[11px] font-medium pl-2 pr-1 py-0.5 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
        >
          {name}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeChip(name)}
              className="rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <>
          <input
            list={listId}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addChip() } }}
            onBlur={addChip}
            placeholder={value.length === 0 ? (placeholder ?? "Belum ditugaskan") : ""}
            className="flex-1 min-w-[80px] text-xs bg-transparent px-1 py-0.5 focus:outline-none placeholder:text-muted-foreground"
          />
          <datalist id={listId}>
            {options.filter(o => !value.includes(o)).map(o => <option key={o} value={o} />)}
          </datalist>
        </>
      )}
    </div>
  )
}
