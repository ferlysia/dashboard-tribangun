"use client"

import { Suspense } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Toaster } from "@/components/ui/sonner"
import { PmScheduleQueryProvider } from "./_lib/query-client"
import { PmScheduleDashboard } from "./_components/pm-schedule-dashboard"

function MaintenanceScheduleContent() {
  return (
    <PmScheduleQueryProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <PmScheduleDashboard />
          <Toaster richColors />
        </SidebarInset>
      </SidebarProvider>
    </PmScheduleQueryProvider>
  )
}

// ─── Page export dengan Suspense (required for useSearchParams in Next.js 15) ─

export default function MaintenanceSchedulePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Memuat jadwal maintenance…
      </div>
    }>
      <MaintenanceScheduleContent />
    </Suspense>
  )
}
