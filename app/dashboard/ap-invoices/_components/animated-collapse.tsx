"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

// Pure-CSS grid-rows expand/collapse — no height measurement, no
// framer-motion dependency, GPU-cheap. `open` is fully controlled by the
// parent so search can force-expand groups without fighting local state.
export function AnimatedCollapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

export function CollapseTrigger({ open, onClick, className, children }: {
  open:      boolean
  onClick:   () => void
  className?: string
  children:  React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} className={className}>
      <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`} />
      {children}
    </button>
  )
}
