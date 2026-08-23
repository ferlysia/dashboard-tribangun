"use client"

import { useQuery } from "@tanstack/react-query"

export type HistoryStatus = "masuk" | "alpha" | "sakit" | "izin" | "cuti"

export interface HistoryEntry {
  date:       string
  status:     HistoryStatus
  recordedAt: string
  siteName:   string | null
}

async function fetchHistory(employeeId: string): Promise<HistoryEntry[]> {
  const res = await fetch(`/api/attendance/history?employee_id=${encodeURIComponent(employeeId)}&days=14`)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Gagal memuat riwayat")
  return body.data
}

// Only ever fires once an employee is picked (enabled: !!employeeId), and
// has no read of / write to any state the capture pipeline touches — kept
// fully decoupled from position acquisition, compression, and upload so
// this convenience feature can never add latency to the 0-3s zero-lag
// submit path.
export function useAttendanceHistory(employeeId: string | null) {
  return useQuery({
    queryKey:  ["clockin-attendance-history", employeeId],
    queryFn:   () => fetchHistory(employeeId as string),
    enabled:   !!employeeId,
    staleTime: 60_000,
  })
}
