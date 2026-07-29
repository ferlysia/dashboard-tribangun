"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Toaster } from "@/components/ui/sonner"
import { PmScheduleQueryProvider } from "./_lib/query-client"
import { PmScheduleDashboard } from "./_components/pm-schedule-dashboard"

export default function MaintenanceSchedulePage() {
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
