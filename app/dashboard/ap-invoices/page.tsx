"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Toaster } from "@/components/ui/sonner"
import { ApInvoicesQueryProvider } from "./_lib/query-client"
import { ApInvoicesDashboard } from "./_components/ap-invoices-dashboard"

export default function ApInvoicesPage() {
  return (
    <ApInvoicesQueryProvider>
      {/* Zero-friction: Finance's primary workspace starts full-width with the
          sidebar hidden; SiteHeader's existing SidebarTrigger reopens it as
          an overlay/drawer on demand (standard shadcn offcanvas behavior). */}
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <ApInvoicesDashboard />
          <Toaster richColors />
        </SidebarInset>
      </SidebarProvider>
    </ApInvoicesQueryProvider>
  )
}
