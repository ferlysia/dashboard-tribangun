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
  assignee?:         string | null
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

export interface NewSchedule {
  site_id:        string
  scheduled_date: string
  status?:        PmScheduleStatus
  assignee?:      string | null
  notes?:         string | null
}

export function useCreateSchedule(month: string) {
  const queryClient = useQueryClient()
  const key = schedulesQueryKey(month)

  return useMutation({
    mutationFn: (rows: NewSchedule | NewSchedule[]) =>
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
