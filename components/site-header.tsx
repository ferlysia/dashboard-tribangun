"use client"

import { usePathname } from "next/navigation"
import { ModeToggle } from "./ui/mode-toggle"
import { ThemeSelector } from "./ui/theme-selector"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { YEAR_FILTER_OPTIONS } from "@/lib/invoices"
import { useYearFilter } from "@/components/providers/year-filter-provider"

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/analytics": "Analytics",
  "/clients": "Clients",
  "/lifecycle": "Lifecycle",
  "/projects": "Projects",
  "/financial-performance": "Financial Performance",
  "/excel-data": "Excel Data",
  "/reports": "Reports",
}

export function SiteHeader() {
  const pathname = usePathname()
  const { yearFilter, setYearFilter, periodDescription } = useYearFilter()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div>
          <h1 className="text-base font-medium">{PAGE_TITLES[pathname] ?? "Dashboard"}</h1>
          <p className="text-[11px] text-muted-foreground">{periodDescription}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={yearFilter} onValueChange={(value) => setYearFilter(value as typeof yearFilter)}>
            <SelectTrigger className="h-9 w-[132px]">
              <SelectValue placeholder="Periode" />
            </SelectTrigger>
            <SelectContent>
              {YEAR_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ThemeSelector />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
