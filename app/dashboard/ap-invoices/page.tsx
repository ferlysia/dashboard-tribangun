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
      <SidebarProvider>
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
