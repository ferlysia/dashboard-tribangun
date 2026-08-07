"use client"

import * as React from "react"
import { useUpdateInvoice, type InvoicePatch } from "../_hooks/use-ap-invoices"

type EditableField = Extract<keyof InvoicePatch, "po_number" | "invoice_number">

// Excel-style inline edit: click to swap into an input, Enter just blurs
// (single commit path — no duplicate mutate calls between Enter/onBlur),
// onBlur always commits. Local state only, memoized — typing here never
// re-renders the parent row/table. Optimistic update comes free from
// useUpdateInvoice's existing onMutate/onError/onSettled cache patch.
export const InlineEditCell = React.memo(function InlineEditCell({
  id, field, value, placeholder, className,
}: {
  id:          string
  field:       EditableField
  value:       string | null
  placeholder: string
  className?:  string
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft]     = React.useState(value ?? "")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const updateInvoice = useUpdateInvoice()

  React.useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    setEditing(false)
    const next = draft.trim() || null
    if (next === (value ?? null)) return
    updateInvoice.mutate({ id, [field]: next } as InvoicePatch)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); inputRef.current?.blur() } // blur -> onBlur commits
          if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false) }
        }}
        className={`w-full bg-transparent border-b border-rose-400 focus:outline-none font-mono text-xs ${className ?? ""}`}
      />
    )
  }

  return (
    <span
      onClick={e => { e.stopPropagation(); setDraft(value ?? ""); setEditing(true) }}
      className={value
        ? `cursor-text ${className ?? ""}`
        : "text-[11px] font-medium italic text-rose-400/70 dark:text-rose-500/50 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors cursor-text"}
    >
      {value || `+ ${placeholder}`}
    </span>
  )
})
