"use client"

import { useParams } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Toaster } from "@/components/ui/sonner"
import { ToolInspectionQueryProvider } from "../_lib/query-client"
import { InspectionForm } from "./_components/inspection-form"

export default function ToolInspectionDetailPage() {
  const params = useParams<{ id: string }>()

  return (
    <ToolInspectionQueryProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <InspectionForm inspectionId={params.id} />
          <Toaster richColors />
        </SidebarInset>
      </SidebarProvider>
    </ToolInspectionQueryProvider>
  )
}
