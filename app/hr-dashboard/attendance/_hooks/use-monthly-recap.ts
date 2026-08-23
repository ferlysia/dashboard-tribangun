"use client"

import { useQuery } from "@tanstack/react-query"
import type { PayrollPeriodDay } from "../_lib/week"

export interface MonthlyRecapEmployee {
  employeeId: string
  fullName:   string
  // One entry per day in the payroll period (aligned index-for-index
  // with MonthlyRecap.dayHeaders) — the exact display string already
  // computed server-side (clock-in time, a status label, "Libur", or ""
  // for a not-yet-happened day), so the client and the Excel export
  // never have to re-derive weekday/weekend/future logic.
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
  year:            number
  month:           number
  // Human-readable payroll cut-off range, e.g. "26 Jul - 25 Ags 2026" —
  // the period runs the 26th of the prior month through the 25th of
  // `month`, not the calendar month itself (per HR's payroll cycle).
  periodLabel:     string
  daysInPeriod:    number
  // Benchmark: total Mon-Fri calendar days in the whole period (a fixed
  // target, not prorated by how much has elapsed) — compare against
  // each employee's totals.weekdayMasuk.
  expectedWorkdays: number
  dayHeaders:      PayrollPeriodDay[]
  employees:       MonthlyRecapEmployee[]
}

async function fetchMonthlyRecap(year: number, month: number): Promise<MonthlyRecap> {
  const res = await fetch(`/api/hr/attendance/monthly?year=${year}&month=${month}`)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Gagal memuat rekap periode")
  return body
}

export function useMonthlyRecap(year: number, month: number) {
  return useQuery({
    queryKey: ["hr-attendance-monthly", year, month],
    queryFn:  () => fetchMonthlyRecap(year, month),
    staleTime: 60_000,
  })
}
