"use client"

import * as React from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { History, Plus, Pencil, Trash2, RotateCcw, RefreshCw, Search, Sparkles } from "lucide-react"

type ActivityLog = {
  id: string
  actor_email: string
  action: string
  summary: string
  created_at: string
  payload?: {
    before?: Record<string, unknown>
    after?: Record<string, unknown>
    changed_fields?: string[]
  }
}

const fDateTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value))

const PAGE_STYLES = `
  @keyframes historyFadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .history-fade {
    animation: historyFadeUp .42s ease both;
  }
  .history-hero {
    position: relative;
    overflow: hidden;
    border-radius: 28px;
    border: 1px solid hsl(var(--border));
    background:
      radial-gradient(circle at top right, hsl(var(--primary) / 0.18), transparent 32%),
      linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card)) 54%, hsl(var(--primary) / 0.05) 100%);
    box-shadow: 0 22px 50px -28px hsl(var(--primary) / 0.35);
  }
  .history-hero::after {
    content: "";
    position: absolute;
    inset: auto -15% -35% auto;
    width: 220px;
    height: 220px;
    border-radius: 999px;
    background: radial-gradient(circle, hsl(var(--primary) / 0.18), transparent 70%);
    pointer-events: none;
  }
  .history-filter {
    height: 42px;
    width: 100%;
    border-radius: 14px;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    padding: 0 14px 0 40px;
    font-size: 14px;
    outline: none;
    transition: border-color .15s ease, box-shadow .15s ease;
  }
  .history-filter:focus {
    border-color: hsl(var(--primary) / 0.5);
    box-shadow: 0 0 0 4px hsl(var(--primary) / 0.1);
  }
  .history-chip {
    border-radius: 999px;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--background));
    color: hsl(var(--muted-foreground));
    padding: 7px 12px;
    font-size: 12px;
    font-weight: 700;
    transition: all .15s ease;
  }
  .history-chip:hover {
    color: hsl(var(--foreground));
    border-color: hsl(var(--primary) / 0.4);
  }
  .history-chip.active {
    background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.82));
    color: hsl(var(--primary-foreground));
    border-color: hsl(var(--primary));
    box-shadow: 0 14px 26px -18px hsl(var(--primary) / 0.85);
  }
  .history-timeline {
    position: relative;
  }
  .history-timeline::before {
    content: "";
    position: absolute;
    left: 17px;
    top: 10px;
    bottom: 10px;
    width: 2px;
    background: linear-gradient(180deg, hsl(var(--primary) / 0.32), hsl(var(--border)));
  }
`

function getActionIcon(action: string) {
  switch (action) {
    case "CREATE":
      return Plus
    case "DELETE":
      return Trash2
    case "RESTORE":
    case "RESTORE_ALL":
      return RotateCcw
    default:
      return Pencil
  }
}

function getActionTone(action: string) {
  switch (action) {
    case "CREATE":
      return "bg-emerald-500/12 text-emerald-600 border-emerald-500/20"
    case "DELETE":
      return "bg-rose-500/12 text-rose-600 border-rose-500/20"
    case "RESTORE":
    case "RESTORE_ALL":
      return "bg-amber-500/12 text-amber-600 border-amber-500/20"
    default:
      return "bg-primary/10 text-primary border-primary/20"
  }
}

function formatDetail(log: ActivityLog) {
  const before = log.payload?.before ?? {}
  const after = log.payload?.after ?? {}
  const changedFields = log.payload?.changed_fields ?? []

  if (before.status !== undefined && after.status !== undefined && before.status !== after.status) {
    return `Status: ${String(before.status)} -> ${String(after.status)}`
  }

  if (
    before.payment_date !== undefined &&
    after.payment_date !== undefined &&
    before.payment_date !== after.payment_date
  ) {
    return `Tanggal bayar: ${String(before.payment_date || "-")} -> ${String(after.payment_date || "-")}`
  }

  if (
    before.payment_value !== undefined &&
    after.payment_value !== undefined &&
    String(before.payment_value) !== String(after.payment_value)
  ) {
    return `Nilai pembayaran: ${String(before.payment_value)} -> ${String(after.payment_value)}`
  }

  if (changedFields.length > 0) {
    return `Field berubah: ${changedFields.join(", ")}`
  }

  if (log.action === "CREATE") return "Invoice baru berhasil ditambahkan ke database."
  if (log.action === "DELETE") return "Invoice dihapus dari database."
  if (log.action === "RESTORE" || log.action === "RESTORE_ALL") return "Data invoice dikembalikan ke baseline original."

  return "Perubahan tersimpan di activity log."
}

export default function ActivityHistoryPage() {
  const [logs, setLogs] = React.useState<ActivityLog[]>([])
  const [loading, setLoading] = React.useState(true)
  const [query, setQuery] = React.useState("")
  const [actionFilter, setActionFilter] = React.useState("ALL")

  const loadLogs = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/activity-logs", { cache: "no-store" })
      const result = await response.json()
      if (response.ok) {
        setLogs(result.data || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const counts = React.useMemo(() => {
    return logs.reduce(
      (acc, log) => {
        acc.total += 1
        if (log.action === "CREATE") acc.create += 1
        if (log.action === "UPDATE") acc.update += 1
        if (log.action === "DELETE") acc.delete += 1
        if (log.action === "RESTORE" || log.action === "RESTORE_ALL") acc.restore += 1
        return acc
      },
      { total: 0, create: 0, update: 0, delete: 0, restore: 0 }
    )
  }, [logs])

  const filteredLogs = React.useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return logs.filter((log) => {
      const matchAction = actionFilter === "ALL" ? true : log.action === actionFilter
      const haystack = [log.summary, log.actor_email, formatDetail(log), log.action].join(" ").toLowerCase()
      const matchKeyword = keyword ? haystack.includes(keyword) : true
      return matchAction && matchKeyword
    })
  }, [actionFilter, logs, query])

  const filterChips = [
    { label: "Semua", value: "ALL" },
    { label: "Create", value: "CREATE" },
    { label: "Update", value: "UPDATE" },
    { label: "Delete", value: "DELETE" },
    { label: "Restore", value: "RESTORE" },
  ]

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <style dangerouslySetInnerHTML={{ __html: PAGE_STYLES }} />
        <div className="flex flex-1 flex-col gap-6 p-6">
          <section className="history-hero history-fade p-6 md:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Audit Trail
                </div>
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Database Activity History</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Semua aksi yang memengaruhi data invoice tercatat di sini, mulai dari tambah invoice baru,
                  ubah status bayar, edit nilai, sampai restore ke data original.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1.5 text-xs">
                  {counts.total} total log
                </Badge>
                <Button variant="outline" onClick={() => void loadLogs()} disabled={loading} className="rounded-xl">
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <Card className="history-fade">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Aktivitas</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{counts.total}</CardContent>
            </Card>
            <Card className="history-fade">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Create</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{counts.create}</CardContent>
            </Card>
            <Card className="history-fade">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Update</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{counts.update}</CardContent>
            </Card>
            <Card className="history-fade">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Delete / Restore</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{counts.delete + counts.restore}</CardContent>
            </Card>
          </section>

          <Card className="history-fade overflow-hidden">
            <CardHeader className="gap-4 border-b bg-muted/20">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Activity Timeline
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Filter cepat untuk cek siapa melakukan perubahan apa dan kapan.
                  </p>
                </div>
                <div className="relative w-full xl:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari summary, email, atau action..."
                    className="history-filter"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {filterChips.map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setActionFilter(chip.value)}
                    className={`history-chip ${actionFilter === chip.value ? "active" : ""}`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                  Memuat activity log...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                  Tidak ada activity log yang cocok dengan filter saat ini.
                </div>
              ) : (
                <div className="history-timeline space-y-3 pl-0">
                {filteredLogs.map((log) => {
                  const ActionIcon = getActionIcon(log.action)
                  const tone = getActionTone(log.action)

                  return (
                    <div key={log.id} className="relative rounded-3xl border border-border/70 bg-card/95 p-4 shadow-sm transition-colors hover:border-primary/20 hover:bg-card md:p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-start gap-3">
                            <span className={`relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border ${tone}`}>
                              <ActionIcon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold leading-6">{log.summary}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{log.actor_email}</div>
                              <div className="mt-3 rounded-2xl bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
                                {formatDetail(log)}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                          <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] tracking-wide">
                            {log.action}
                          </Badge>
                          <div className="text-xs text-muted-foreground">{fDateTime(log.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
