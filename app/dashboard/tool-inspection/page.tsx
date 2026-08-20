"use client"

import { Suspense } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Toaster } from "@/components/ui/sonner"
import { ToolInspectionQueryProvider } from "./_lib/query-client"
import { ToolInspectionDashboard } from "./_components/tool-inspection-dashboard"

function ToolInspectionContent() {
  return (
    <ToolInspectionQueryProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <ToolInspectionDashboard />
          <Toaster richColors />
        </SidebarInset>
      </SidebarProvider>
    </ToolInspectionQueryProvider>
  )
}

export default function ToolInspectionPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Memuat inspeksi tool…
      </div>
    }>
      <ToolInspectionContent />
    </Suspense>
  )
}
