"use client"

import { Toaster } from "@/components/ui/sonner"
import { ClockInQueryProvider } from "../_lib/query-client"
import { ClockInForm } from "./clock-in-form"
import type { Employee } from "./employee-combobox"

export function ClockInShell({ employees }: { employees: Employee[] }) {
  return (
    <ClockInQueryProvider>
      <ClockInForm employees={employees} />
      <Toaster richColors />
    </ClockInQueryProvider>
  )
}
