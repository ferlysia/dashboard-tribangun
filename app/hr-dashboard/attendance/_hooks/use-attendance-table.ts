"use client"

import { useQuery } from "@tanstack/react-query"

export type AttendanceStatus = "masuk" | "alpha" | "sakit" | "izin" | "cuti"

export interface AttendanceTableRow {
  employeeId: string
  fullName:   string
  siteName:   string | null
  recordedAt: string | null
  status:     AttendanceStatus
  remarks:    string | null
  // Remaining leave/PTO days — employees.time_off, decremented by 1 when
  // HR sets a day's status to Cuti and restored when it's changed away
  // from Cuti (see /api/hr/attendance/status). Null means the employee's
  // balance was never configured, not that it's zero.
  timeOff:    number | null
  latitude:           number | null
  longitude:          number | null
  locationFlagged:    boolean
  locationFlagReason: string | null
  updatedBy:          string | null
  updatedAt:          string | null
}

async function fetchTable(date: string): Promise<{ data: AttendanceTableRow[] }> {
  const res = await fetch(`/api/hr/attendance/table?date=${date}`)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Gagal memuat data kehadiran")
  return body
}

export function useAttendanceTable(date: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey:        ["hr-attendance-table", date],
    queryFn:         () => fetchTable(date),
    refetchInterval: options?.refetchInterval,
  })
}
