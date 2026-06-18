"use client"

import * as React from "react"
import { formatThousands, parseThousands } from "@/lib/pnl"

export function MoneyInput({
  value,
  onChange,
  disabled,
  placeholder = "0",
  className = "",
}: {
  value: number
  onChange: (next: number) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}) {
  const [text, setText] = React.useState(() => (value === 0 ? "" : formatThousands(String(value))))

  React.useEffect(() => {
    setText(value === 0 ? "" : formatThousands(String(value)))
  }, [value])

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const formatted = formatThousands(e.target.value)
        setText(formatted)
        onChange(parseThousands(formatted))
      }}
      className={
        "w-full bg-transparent text-right tabular-nums text-sm outline-none px-3 py-2 rounded-md border transition-colors " +
        (disabled
          ? "border-transparent bg-zinc-900/40 text-zinc-500 cursor-not-allowed"
          : "border-zinc-800/60 text-zinc-100 placeholder:text-zinc-600 hover:border-zinc-700 focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400") +
        (className ? " " + className : "")
      }
    />
  )
}
