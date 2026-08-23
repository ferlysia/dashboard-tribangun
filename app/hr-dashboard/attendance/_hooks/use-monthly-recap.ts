"use client"

import { useQuery } from "@tanstack/react-query"

export interface MonthlyRecapEmployee {
  employeeId: string
  fullName:   string
  // One entry per calendar day (index 0 = day 1) — the exact display
  // string already computed server-side (clock-in time, a status label,
  // "Libur", or "" for a not-yet-happened day), so the client and the
  // Excel export never have to re-derive weekday/weekend/future logic.
  cells: string[]
  totals: {
    weekdayMasuk:  number
    weekendShifts: number
    cuti:          number
    sakit:         number
    izin:          number
    alpha:         number
  }
  keterangan: string
}

export interface MonthlyRecap {
  year:        number
  month:       number
  daysInMonth: number
  monthLabel:  string
  dayHeaders:  { day: number; label: string; isWeekend: boolean }[]
  employees:   MonthlyRecapEmployee[]
}

async function fetchMonthlyRecap(year: number, month: number): Promise<MonthlyRecap> {
  const res = await fetch(`/api/hr/attendance/monthly?year=${year}&month=${month}`)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Gagal memuat rekap bulanan")
  return body
}

export function useMonthlyRecap(year: number, month: number) {
  return useQuery({
    queryKey: ["hr-attendance-monthly", year, month],
    queryFn:  () => fetchMonthlyRecap(year, month),
    staleTime: 60_000,
  })
}
