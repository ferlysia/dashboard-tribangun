"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { PmSchedule, PmScheduleStatus, Site } from "@/types/pm-schedule"
import { isLegalStatusChange } from "@/lib/pm-schedule/status-rules"

async function safeJson(res: Response) {
  const text = await res.text()
  if (!text) return { error: `Server error (${res.status})` }
  try {
    return JSON.parse(text)
  } catch {
    return { error: text.slice(0, 300) || `Server error (${res.status})` }
  }
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const body = await safeJson(res)
  if (!res.ok) throw new Error(body.error ?? "Request failed")
  return body.data as T
}

export const sitesQueryKey = ["sites"] as const
// Partial key — matches every cached ["pm-schedules", month] query
// regardless of month. Used when a mutation's effect isn't confined to the
// currently-active month (e.g. creating a visit dated outside the month
// currently shown), so every view relying on any month's data gets
// invalidated, not just the one currently on screen.
export const schedulesQueryKeyPrefix = ["pm-schedules"] as const
export const schedulesQueryKey = (month: string) => ["pm-schedules", month] as const

export function useSitesQuery() {
  return useQuery({
    queryKey: sitesQueryKey,
    queryFn:  () => fetchJson<Site[]>("/api/sites"),
    staleTime: 5 * 60_000, // sites change rarely
  })
}

// The single shared query every view (Matrix Grid, Weekly Board, Sites
// Overview, Calendar) reads from — switching tabs never triggers a new
// fetch, only changing `month` does.
export function useSchedulesQuery(month: string) {
  return useQuery({
    queryKey: schedulesQueryKey(month),
    queryFn:  () => fetchJson<PmSchedule[]>(`/api/pm-schedules?month=${month}`),
  })
}

export interface SchedulePatch {
  id:                string
  status?:           PmScheduleStatus
  assignees?:        string[]
  unit_count?:       number | null
  notes?:            string | null
  scheduled_date?:   string
  report_submitted?: boolean
}

// One mutation hook, reused identically by the grid's inline cells, the
// board's drag-drop handler, and the drawer's edit form — so an edit made
// in any of them behaves the same way everywhere (optimistic apply,
// rollback on failure).
//
// Not scoped to a single month's cache — a schedule row can be reached (via
// the Drawer, or the shared ScheduleTableRow) from a view showing a
// *different* month than whatever the global month picker currently says
// (Calendar and All Sites both render other months' rows). Scoping the
// optimistic write to just one month key would silently update the wrong
// cache entry for those cases. Instead this writes through every
// currently-cached pm-schedules query (any month already loaded, plus the
// "all" query All Sites uses) via setQueriesData's partial-key matching, so
// whichever cache actually holds this row gets updated no matter where the
// edit came from.
export function useUpdateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (patch: SchedulePatch) =>
      fetchJson<PmSchedule>(`/api/pm-schedules/${patch.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: schedulesQueryKeyPrefix })
      const previousEntries = queryClient.getQueriesData<PmSchedule[]>({ queryKey: schedulesQueryKeyPrefix })
      queryClient.setQueriesData<PmSchedule[]>({ queryKey: schedulesQueryKeyPrefix }, old =>
        old?.map(s => (s.id === patch.id ? { ...s, ...patch } : s)))
      return { previousEntries }
    },
    onError: (_err, _patch, context) => {
      context?.previousEntries.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schedulesQueryKeyPrefix })
    },
  })
}

// Backs the inline "+ Add New Site" flow in CreateScheduleDialog — sites
// change rarely (5min staleTime on useSitesQuery above), so a create just
// invalidates that one query instead of needing its own optimistic patch.
export function useCreateSite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) =>
      fetchJson<Site>("/api/sites", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sitesQueryKey })
    },
  })
}

export interface NewSchedule {
  site_id:        string
  scheduled_date: string
  status?:        PmScheduleStatus
  // Always optional, defaults to [] — never pre-filled at creation time,
  // including by the recurring generator (see lib/pm-schedule/recurring.ts
  // and the migration comment on pm_schedules.assignees).
  assignees?:     string[]
  unit_count?:    number | null
  notes?:         string | null
}

export function useCreateSchedule(month: string) {
  const queryClient = useQueryClient()
  const key = schedulesQueryKey(month)

  return useMutation({
    mutationFn: (row: NewSchedule) =>
      fetchJson<PmSchedule[]>("/api/pm-schedules", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(row),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

// Recurring generator posts N visit rows in one request — the API already
// batch-inserts an array body (see app/api/pm-schedules/route.ts). Kept as
// its own hook (distinct from useCreateSchedule) so call sites are explicit
// about single-visit vs batch intent, even though both hit the same endpoint.
export function useCreateBatchSchedules(month: string) {
  const queryClient = useQueryClient()
  const key = schedulesQueryKey(month)

  return useMutation({
    mutationFn: (rows: NewSchedule[]) =>
      fetchJson<PmSchedule[]>("/api/pm-schedules", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(rows),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

// Sites change rarely but unit_count is explicitly "editable anytime" (e.g.
// Sales upsells more units) — powers the inline edit in Sites Overview.
export function useUpdateSite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (patch: { id: string; unit_count?: number; name?: string; is_active?: boolean }) =>
      fetchJson<Site>(`/api/sites/${patch.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sitesQueryKey })
    },
  })
}

// All Sites reads the entire dataset once (no month filter — the route
// already supports omitting it) rather than mirroring Calendar's per-month
// fetch pattern: at this app's real scale (~20 sites) one unfiltered fetch
// is simpler, and both All Sites grouping modes (By Month & Week, By Site)
// derive from this single cached list via useMemo, so toggling between them
// is instant with no refetch.
export const allSchedulesQueryKey = ["pm-schedules", "all"] as const

export function useAllSchedulesQuery() {
  return useQuery({
    queryKey: allSchedulesQueryKey,
    queryFn:  () => fetchJson<PmSchedule[]>("/api/pm-schedules"),
  })
}

export interface BulkStatusItem {
  id:            string
  currentStatus: PmScheduleStatus
}

// Backs All Sites' bulk action bar. Each row's current status is checked
// against the target with the same isLegalStatusChange used everywhere else
// in the app — illegal transitions are silently skipped rather than failing
// the whole batch, and the caller gets a succeeded/skipped count to toast.
// Loops the existing single-item PATCH endpoint (no new bulk route) —
// consistent with how every other mutation in this app works; a batch POST
// only exists for schedule *creation* because Postgres can insert an array
// in one round trip, which PATCH/DELETE-per-row has no equivalent for.
export function useBulkUpdateStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ items, targetStatus }: { items: BulkStatusItem[]; targetStatus: PmScheduleStatus }) => {
      const legal = items.filter(i => isLegalStatusChange(i.currentStatus, targetStatus))
      await Promise.all(legal.map(i =>
        fetchJson<PmSchedule>(`/api/pm-schedules/${i.id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ status: targetStatus }),
        })
      ))
      return { succeeded: legal.length, skipped: items.length - legal.length }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schedulesQueryKeyPrefix })
    },
  })
}

export function useBulkDeleteSchedules() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => fetchJson<{ id: string }>(`/api/pm-schedules/${id}`, { method: "DELETE" })))
      return { deleted: ids.length }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schedulesQueryKeyPrefix })
    },
  })
}

// Same cross-month-safe cache targeting as useUpdateSchedule above — a
// delete triggered via the Drawer can be for a row from any month.
export function useDeleteSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ id: string }>(`/api/pm-schedules/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: schedulesQueryKeyPrefix })
      const previousEntries = queryClient.getQueriesData<PmSchedule[]>({ queryKey: schedulesQueryKeyPrefix })
      queryClient.setQueriesData<PmSchedule[]>({ queryKey: schedulesQueryKeyPrefix }, old => old?.filter(s => s.id !== id))
      return { previousEntries }
    },
    onError: (_err, _id, context) => {
      context?.previousEntries.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schedulesQueryKeyPrefix })
    },
  })
}
