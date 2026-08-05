"use client"

import * as React from "react"

function formatThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

// type="text" (never type="number") so the browser never renders spinner
// arrows — no CSS override needed. Dots are purely a display concern;
// onChange always hands back a clean integer (or null when cleared).
export function CurrencyInput({ value, onChange, placeholder = "0", className, autoFocus }: {
  value:        number | null
  onChange:     (next: number | null) => void
  placeholder?: string
  className?:   string
  autoFocus?:   boolean
}) {
  const [display, setDisplay] = React.useState(() => (value != null ? formatThousands(String(value)) : ""))

  // Re-sync when the value changes from outside this input — e.g. the edit
  // modal opening on a different row, or the live DPP+PPN-PPh recompute
  // updating Total while the user is focused on DPP.
  React.useEffect(() => {
    setDisplay(value != null ? formatThousands(String(value)) : "")
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "")
    if (!digits) { setDisplay(""); onChange(null); return }
    const clean = digits.replace(/^0+(?=\d)/, "") // no leading zeros
    setDisplay(formatThousands(clean))
    onChange(Number(clean))
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  )
}
