"use client"

import { useQuery } from "@tanstack/react-query"

export interface AttendanceSummary {
  date:           string
  present:        number
  alpha:          number
  totalEmployees: number
  sick:           number
  leave:          number
}

async function fetchSummary(date: string): Promise<AttendanceSummary> {
  const res = await fetch(`/api/hr/attendance/summary?date=${date}`)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Gagal memuat ringkasan kehadiran")
  return body
}

export function useAttendanceSummary(date: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey:        ["hr-attendance-summary", date],
    queryFn:         () => fetchSummary(date),
    refetchInterval: options?.refetchInterval,
  })
}
