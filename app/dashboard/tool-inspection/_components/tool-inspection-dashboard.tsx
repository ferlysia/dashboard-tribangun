"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, ClipboardList, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useProjects, useInspectionsInfinite } from "../_hooks/use-tool-inspection"
import { ProjectPicker } from "./project-picker"
import { CreateInspectionDialog } from "./create-inspection-dialog"

export function ToolInspectionDashboard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: projects } = useProjects()

  const projectId = searchParams.get("project") || null
  const setProjectId = (id: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("project", id)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  // Once projects resolve, default the URL to the first one so the picker
  // and inspection list agree without an extra click.
  React.useEffect(() => {
    if (!searchParams.get("project") && projects && projects.length > 0) setProjectId(projects[0].id)
  }, [projects]) // eslint-disable-line react-hooks/exhaustive-deps

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInspectionsInfinite(projectId)
  const rows = data?.pages.flatMap(p => p.data) ?? []

  const [createOpen, setCreateOpen] = React.useState(false)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProjectPicker value={projectId} onChange={setProjectId} />
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/dashboard/tool-inspection/catalog">
              <Settings2 className="h-4 w-4" /> Tool Catalog
            </Link>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Weekly Inspection
          </Button>
        </div>
      </div>

      {!projectId ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Pilih atau tambahkan project Construction/Project untuk melihat inspeksinya.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Memuat inspeksi…</div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Belum ada Weekly Tool Inspection Form untuk project ini.
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

      <CreateInspectionDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultProjectId={projectId}
      />
    </div>
  )
}
