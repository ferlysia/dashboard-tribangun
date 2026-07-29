"use client"

import * as React from "react"

// Dropdown/autocomplete for the technician assignee field — a native
// <input list> + <datalist> (same lightweight pattern already used for
// Satuan in ItemEditGrid, app/dashboard/purchasing-request/page.tsx), not a
// new Popover/Command dependency. Suggestions come from names already used
// elsewhere in the loaded data; typing a new name still commits it.
export function AssigneeInput({ value, options, onCommit, placeholder, className, disabled }: {
  value:        string | null
  options:      string[]
  onCommit:     (value: string | null) => void
  placeholder?: string
  className?:   string
  disabled?:    boolean
}) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const listId = React.useId()
  const shown = draft ?? value ?? ""

  const commit = () => {
    const next = shown.trim() || null
    if (next === (value ?? null)) return
    onCommit(next)
  }

  return (
    <>
      <input
        list={listId}
        type="text"
        value={shown}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        placeholder={placeholder ?? "Assignee"}
        disabled={disabled}
        className={className ?? "w-full rounded-md border border-border bg-background text-xs text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50 disabled:cursor-not-allowed"}
      />
      <datalist id={listId}>
        {options.map(o => <option key={o} value={o} />)}
      </datalist>
    </>
  )
}
