"use client"

import { Toaster } from "@/components/ui/sonner"
import { ClockInQueryProvider } from "../_lib/query-client"
import { ClockInForm } from "./clock-in-form"

export function ClockInShell({ recentNames }: { recentNames: string[] }) {
  return (
    <ClockInQueryProvider>
      <ClockInForm recentNames={recentNames} />
      <Toaster richColors />
    </ClockInQueryProvider>
  )
}
