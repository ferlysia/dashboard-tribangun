"use client"

import * as React from "react"
import { toast } from "sonner"
import { ChevronDown, ChevronRight, Trash2, Pencil } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PmSchedule, Region, Site } from "@/types/pm-schedule"
import { isFullyDone, weekOfMonth } from "@/lib/pm-schedule/status-rules"
import { formatUnitTypes } from "@/lib/pm-schedule/recurring"
import { STATUS_CFG, STATUS_OPTIONS } from "./status-badge"
import { ScheduleTableRow, SCHEDULE_TABLE_COLUMN_LABELS } from "./schedule-table-row"
import { UnitTypesEditor } from "./unit-types-editor"
import { useAllSchedulesQuery, useBulkDeleteSchedules, useBulkUpdateStatus, useDeleteSite, useUpdateSite } from "../_hooks/use-pm-schedules"

// Click-to-edit unit breakdown — the "master total, editable anytime"
// surface (e.g. when Sales upsells more units at a site). Per-visit
// overrides live on the schedule itself (see schedule-drawer.tsx), not
// here. Expands into the same add/remove-row editor used everywhere else,
// with an explicit Save (multi-row edits don't fit a single onBlur commit).
function UnitCountEditor({ site }: { site: Site }) {
  const updateSite = useUpdateSite()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(site.unit_types)

  const startEdit = () => { setDraft(site.unit_types); setEditing(true) }

  const commit = () => {
    setEditing(false)
    if (JSON.stringify(draft) === JSON.stringify(site.unit_types)) return
    updateSite.mutate({ id: site.id, unit_types: draft })
  }

  if (editing) {
    return (
      <div onClick={e => e.stopPropagation()} className="inline-flex flex-col gap-1.5">
        <UnitTypesEditor value={draft} onChange={setDraft} />
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" className="text-xs h-6" onClick={commit}>Simpan</Button>
          <Button type="button" size="sm" variant="ghost" className="text-xs h-6" onClick={() => setEditing(false)}>Batal</Button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); startEdit() }}
      className="inline-flex items-center gap-1 text-[11px] font-normal normal-case text-muted-foreground hover:text-primary transition-colors"
      title="Klik untuk ubah breakdown unit"
    >
      {formatUnitTypes(site.unit_types, site.unit_count)} <Pencil className="h-2.5 w-2.5 opacity-50" />
    </button>
  )
}

// Safe delete for a mistakenly-created site — the API rejects (400, clear
// message) if any schedule still references it (FK is ON DELETE RESTRICT),
// so this can never silently orphan real visit history. On success the
// site drops out of the cached list immediately (see useDeleteSite), which
// removes its "By Site" section with no refresh needed.
function DeleteSiteButton({ site, visitCount }: { site: Site; visitCount: number }) {
  const deleteSite = useDeleteSite()

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Hapus site "${site.name}"? Tindakan ini tidak bisa dibatalkan.`)) return
    deleteSite.mutate(site.id, {
      onSuccess: () => toast.success(`Site "${site.name}" dihapus.`),
      onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus site."),
    })
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleteSite.isPending}
      title={visitCount > 0 ? "Site ini masih punya jadwal — hapus/pindahkan jadwalnya dulu" : "Hapus site"}
      className="inline-flex items-center gap-1 text-[11px] font-normal normal-case text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
    >
      <Trash2 className="h-2.5 w-2.5" /> Hapus Site
    </button>
  )
}

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number)
  return `${MONTH_NAMES_ID[m - 1]} ${year}`
}

type GroupMode = "monthWeek" | "site"

// One collapsible group (a week within a month, or a site's whole history)
// — shared table shell around ScheduleTableRow, with the bulk-select
// checkbox column wired to the parent's selection state.
function GroupTable({ items, selectedIds, onToggleSelect, onToggleSelectGroup, assigneeOptions, onOpenDrawer, showSn }: {
  items:                PmSchedule[]
  selectedIds:          Set<string>
  onToggleSelect:       (id: string, checked: boolean) => void
  onToggleSelectGroup:  (ids: string[], checked: boolean) => void
  assigneeOptions:      string[]
  onOpenDrawer:         (id: string) => void
  showSn?:              boolean
}) {
  const allSelected = items.length > 0 && items.every(i => selectedIds.has(i.id))
  return (
    <div className="overflow-x-auto">
      {/* table-fixed + an explicit colgroup — every group renders as its own
          separate <table>, so without hard-coded column widths each one
          auto-sizes independently off its own content and drifts out of
          alignment with its neighbors (the reported "berantakan" bug).
          A colgroup with literal widths makes every instance identical
          regardless of content. */}
      <table className="w-full min-w-[860px] text-xs border-collapse table-fixed [&_td]:align-top">
        <colgroup>
          <col className="w-10" />  {/* checkbox */}
          <col className="w-44" />  {/* Site */}
          <col className="w-24" />  {/* Tanggal */}
          <col className="w-36" />  {/* Status */}
          <col className="w-40" />  {/* Assignee */}
          <col className="w-28" />  {/* Unit */}
          <col className="w-20" />  {/* Reports */}
          <col />                   {/* Catatan — flexible remainder */}
        </colgroup>
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800/70">
            <th className="px-3 py-2 border border-slate-200 dark:border-slate-800">
              <Checkbox
                checked={allSelected}
                onCheckedChange={checked => onToggleSelectGroup(items.map(i => i.id), checked === true)}
              />
            </th>
            {SCHEDULE_TABLE_COLUMN_LABELS.map(label => (
              <th key={label} className="text-left px-3 py-2 border border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider truncate">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(schedule => (
            <ScheduleTableRow
              key={schedule.id}
              schedule={schedule}
              assigneeOptions={assigneeOptions}
              onOpenDrawer={onOpenDrawer}
              selected={selectedIds.has(schedule.id)}
              onToggleSelect={onToggleSelect}
              showSn={showSn}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CollapsibleSection({ title, subtitle, defaultOpen = true, children }: {
  title:        React.ReactNode
  subtitle?:    React.ReactNode
  defaultOpen?: boolean
  children:     React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <div className="rounded-lg border-2 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 bg-slate-200/70 dark:bg-slate-800 text-left"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">{title}</span>
        {subtitle && <span className="text-[11px] text-muted-foreground font-normal normal-case">{subtitle}</span>}
      </button>
      {open && children}
    </div>
  )
}

// Stable reference so `data ?? EMPTY` doesn't create a new array every
// render while the query is loading, which would otherwise defeat the
// useMemo hooks below.
const EMPTY_SCHEDULES: never[] = []

export function AllSitesView({ sites, region, assigneeOptions, onOpenDrawer }: {
  sites:            Site[]
  region:           Region
  assigneeOptions:  string[]
  onOpenDrawer:     (id: string) => void
}) {
  const { data, isLoading } = useAllSchedulesQuery(region)
  const schedules = data ?? EMPTY_SCHEDULES

  const [groupMode, setGroupMode] = React.useState<GroupMode>("monthWeek")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = React.useState<string>("")
  const [search, setSearch] = React.useState("")

  // Pure client-side filter over the already-fetched React Query data — no
  // refetch, matches by Site Name OR SN. Both grouping modes below derive
  // from this filtered set, so the search covers both All Sites tabs.
  const filteredSchedules = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return schedules
    return schedules.filter(s =>
      (s.sites?.name ?? "").toLowerCase().includes(q) ||
      (s.sn ?? "").toLowerCase().includes(q)
    )
  }, [schedules, search])

  const bulkUpdateStatus = useBulkUpdateStatus()
  const bulkDelete = useBulkDeleteSchedules()

  const scheduleById = React.useMemo(() => new Map(schedules.map(s => [s.id, s])), [schedules])

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleSelectGroup = (ids: string[], checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => { if (checked) next.add(id); else next.delete(id) })
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkStatusChange = (targetStatus: string) => {
    const items = Array.from(selectedIds)
      .map(id => scheduleById.get(id))
      .filter((s): s is PmSchedule => !!s)
      .map(s => ({ id: s.id, currentStatus: s.status }))
    bulkUpdateStatus.mutate(
      { items, targetStatus: targetStatus as PmSchedule["status"] },
      {
        onSuccess: ({ succeeded, skipped }) => {
          if (succeeded > 0) toast.success(`${succeeded} jadwal diubah ke ${STATUS_CFG[targetStatus as PmSchedule["status"]].label}.`)
          if (skipped > 0) toast.error(`${skipped} jadwal dilewati (transisi status tidak sah).`)
          clearSelection()
          setBulkStatus("")
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengubah status."),
      }
    )
  }

  const handleBulkDelete = () => {
    if (!window.confirm(`Hapus ${selectedIds.size} jadwal kunjungan terpilih?`)) return
    bulkDelete.mutate(Array.from(selectedIds), {
      onSuccess: ({ deleted }) => { toast.success(`${deleted} jadwal dihapus.`); clearSelection() },
      onError:   (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus jadwal."),
    })
  }

  const monthWeekGroups = React.useMemo(() => {
    const byMonth = new Map<string, PmSchedule[]>()
    for (const s of filteredSchedules) {
      if (!byMonth.has(s.scheduled_month)) byMonth.set(s.scheduled_month, [])
      byMonth.get(s.scheduled_month)!.push(s)
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, items]) => {
        const byWeek = new Map<number, PmSchedule[]>()
        for (const s of items) {
          const w = weekOfMonth(s.scheduled_date)
          if (!byWeek.has(w)) byWeek.set(w, [])
          byWeek.get(w)!.push(s)
        }
        return {
          month,
          weeks: Array.from(byWeek.entries()).sort(([a], [b]) => a - b),
        }
      })
  }, [filteredSchedules])

  const siteGroups = React.useMemo(() => {
    const bySite = new Map<string, PmSchedule[]>()
    for (const s of filteredSchedules) {
      if (!bySite.has(s.site_id)) bySite.set(s.site_id, [])
      bySite.get(s.site_id)!.push(s)
    }
    const searching = search.trim() !== ""
    return sites
      .map(site => {
        const visits = (bySite.get(site.id) ?? []).slice().sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
        const done = visits.filter(isFullyDone).length
        return { site, visits, done }
      })
      // While searching, only show sites with a matching visit — an empty
      // "active site" row during a search is just noise, not a result.
      .filter(r => r.visits.length > 0 || (!searching && r.site.is_active))
  }, [filteredSchedules, sites, search])

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Memuat semua jadwal...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Cari site atau SN..."
        className="w-full max-w-sm rounded-md border border-slate-300 dark:border-slate-700 bg-background text-xs text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40"
      />

      <div className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 p-1 w-fit">
        <button
          type="button"
          onClick={() => setGroupMode("monthWeek")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${groupMode === "monthWeek" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          By Month &amp; Week
        </button>
        <button
          type="button"
          onClick={() => setGroupMode("site")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${groupMode === "site" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          By Site
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center gap-2 rounded-lg border-2 border-primary/40 bg-primary/5 dark:bg-primary/10 px-3 py-2 shadow-sm">
          <span className="text-xs font-semibold text-foreground">{selectedIds.size} dipilih</span>
          <div className="flex-1" />
          <Select value={bulkStatus} onValueChange={handleBulkStatusChange}>
            <SelectTrigger size="sm" className="w-40 text-xs bg-background">
              <SelectValue placeholder="Ubah Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s} className="text-xs">{STATUS_CFG[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs text-red-600 hover:text-red-700" onClick={handleBulkDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Hapus ({selectedIds.size})
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={clearSelection}>
            Batal
          </Button>
        </div>
      )}

      {schedules.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Belum ada jadwal kunjungan sama sekali.
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Tidak ada jadwal yang cocok dengan pencarian &quot;{search}&quot;.
        </div>
      ) : groupMode === "monthWeek" ? (
        <div className="flex flex-col gap-3">
          {monthWeekGroups.map(({ month, weeks }) => (
            <CollapsibleSection key={month} title={monthLabel(month)} subtitle={`${weeks.reduce((n, [, items]) => n + items.length, 0)} kunjungan`}>
              <div className="flex flex-col gap-2 p-2 bg-background">
                {weeks.map(([week, items]) => (
                  <CollapsibleSection key={week} title={`Week ${week}`} subtitle={`${items.length} kunjungan`}>
                    <GroupTable
                      items={items}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      onToggleSelectGroup={toggleSelectGroup}
                      assigneeOptions={assigneeOptions}
                      onOpenDrawer={onOpenDrawer}
                    />
                  </CollapsibleSection>
                ))}
              </div>
            </CollapsibleSection>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {siteGroups.map(({ site, visits, done }) => (
            <CollapsibleSection
              key={site.id}
              title={site.name}
              subtitle={
                <span className="inline-flex items-center gap-2">
                  {done}/{visits.length} Visits Done | {visits.length - done} Remaining
                  <UnitCountEditor site={site} />
                  <DeleteSiteButton site={site} visitCount={visits.length} />
                </span>
              }
            >
              <GroupTable
                items={visits}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectGroup={toggleSelectGroup}
                assigneeOptions={assigneeOptions}
                onOpenDrawer={onOpenDrawer}
                showSn
              />
            </CollapsibleSection>
          ))}
        </div>
      )}
    </div>
  )
}
