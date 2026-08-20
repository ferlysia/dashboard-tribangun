"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, ClipboardList, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSites, useInspectionsInfinite } from "../_hooks/use-tool-inspection"
import { CreateInspectionDialog } from "./create-inspection-dialog"

export function ToolInspectionDashboard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: sites, isLoading: sitesLoading } = useSites()

  const siteId = searchParams.get("site") || sites?.[0]?.id || null
  const setSiteId = (id: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("site", id)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  // Once sites resolve, default the URL to the first one so the site
  // selector and inspection list agree without an extra click.
  React.useEffect(() => {
    if (!searchParams.get("site") && sites && sites.length > 0) setSiteId(sites[0].id)
  }, [sites]) // eslint-disable-line react-hooks/exhaustive-deps

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInspectionsInfinite(siteId)
  const rows = data?.pages.flatMap(p => p.data) ?? []

  const [createOpen, setCreateOpen] = React.useState(false)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={siteId ?? undefined} onValueChange={setSiteId}>
            <SelectTrigger className="h-9 w-[240px]">
              <SelectValue placeholder={sitesLoading ? "Memuat site…" : "Pilih site"} />
            </SelectTrigger>
            <SelectContent>
              {(sites ?? []).map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/dashboard/tool-inspection/catalog">
              <Settings2 className="h-4 w-4" /> Tool Catalog
            </Link>
          </Button>
          <Button size="sm" className="gap-1.5" disabled={!siteId} onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Weekly Inspection
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Memuat inspeksi…</div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Belum ada Weekly Tool Inspection Form untuk site ini.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(row => (
            <Link key={row.id} href={`/dashboard/tool-inspection/${row.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{row.week_label}</p>
                      <p className="text-xs text-muted-foreground">{row.inspection_date}</p>
                    </div>
                    <Badge variant={row.status === "SUBMITTED" ? "default" : "secondary"}>
                      {row.status === "SUBMITTED" ? "Submitted" : "Draft"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{row.project_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.item_count} tools &middot; Inspector: {row.inspector}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
            {isFetchingNextPage ? "Memuat…" : "Muat lebih banyak"}
          </Button>
        </div>
      )}

      {siteId && (
        <CreateInspectionDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          siteId={siteId}
          siteName={sites?.find(s => s.id === siteId)?.name ?? ""}
        />
      )}
    </div>
  )
}
