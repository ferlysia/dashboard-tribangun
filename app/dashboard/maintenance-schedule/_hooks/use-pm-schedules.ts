"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { PmSchedule, PmScheduleStatus, Site } from "@/types/pm-schedule"

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
export function useUpdateSchedule(month: string) {
  const queryClient = useQueryClient()
  const key = schedulesQueryKey(month)

  return useMutation({
    mutationFn: (patch: SchedulePatch) =>
      fetchJson<PmSchedule>(`/api/pm-schedules/${patch.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PmSchedule[]>(key)
      queryClient.setQueryData<PmSchedule[]>(key, old =>
        old?.map(s => (s.id === patch.id ? { ...s, ...patch } : s)))
      return { previous }
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
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

export function useDeleteSchedule(month: string) {
  const queryClient = useQueryClient()
  const key = schedulesQueryKey(month)

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ id: string }>(`/api/pm-schedules/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PmSchedule[]>(key)
      queryClient.setQueryData<PmSchedule[]>(key, old => old?.filter(s => s.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
