"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { AttendanceStatus, AttendanceTableRow } from "./use-attendance-table"
import type { AttendanceSummary } from "./use-attendance-summary"

interface UpdateStatusInput {
  employeeId: string
  date:       string
  status:     AttendanceStatus
  remarks:    string | null
}

interface UpdateStatusResult {
  data:                unknown
  timeOff:             number | null
  leaveBalanceSkipped: boolean
}

function summaryFromRows(date: string, rows: AttendanceTableRow[], totalEmployees: number): AttendanceSummary {
  const present = rows.filter(r => r.status === "masuk").length
  const sick = rows.filter(r => r.status === "sakit").length
  const leave = rows.filter(r => r.status === "izin" || r.status === "cuti").length
  const alpha = Math.max(totalEmployees - present - sick - leave, 0)
  return { date, present, alpha, totalEmployees, sick, leave }
}

// HR's 1-door status action. The KPI cards (and the leave balance shown
// in the next dialog opened) must update "instantly" (per the Zero-Lag
// UI mandate), so this patches the table + summary query caches
// optimistically before the request even resolves — including the same
// Cuti deduct/restore arithmetic the server applies to employees.time_off
// — then reconciles with the server's actual numbers on success/settle,
// matching the pattern the realtime feed already uses (see
// use-attendance-realtime.ts) rather than waiting a full round-trip.
export function useUpdateAttendanceStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateStatusInput): Promise<UpdateStatusResult> => {
      const res = await fetch("/api/hr/attendance/status", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(input),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Gagal memperbarui status")
      return body
    },
    onMutate: async input => {
      const tableKey = ["hr-attendance-table", input.date]
      const summaryKey = ["hr-attendance-summary", input.date]

      await Promise.all([
        queryClient.cancelQueries({ queryKey: tableKey }),
        queryClient.cancelQueries({ queryKey: summaryKey }),
      ])

      const previousTable = queryClient.getQueryData<{ data: AttendanceTableRow[] }>(tableKey)
      const previousSummary = queryClient.getQueryData<AttendanceSummary>(summaryKey)

      if (previousTable) {
        const nextRows = previousTable.data.map(row => {
          if (row.employeeId !== input.employeeId) return row
          const leaveDelta = (row.status === "cuti" ? -1 : 0) + (input.status === "cuti" ? 1 : 0)
          const nextTimeOff = row.timeOff != null && leaveDelta !== 0 ? row.timeOff - leaveDelta : row.timeOff
          return { ...row, status: input.status, remarks: input.remarks, timeOff: nextTimeOff }
        })
        queryClient.setQueryData(tableKey, { data: nextRows })
        queryClient.setQueryData(
          summaryKey,
          summaryFromRows(input.date, nextRows, previousSummary?.totalEmployees ?? nextRows.length)
        )
      }

      return { previousTable, previousSummary, tableKey, summaryKey }
    },
    onSuccess: (result, input) => {
      const tableKey = ["hr-attendance-table", input.date]
      const current = queryClient.getQueryData<{ data: AttendanceTableRow[] }>(tableKey)
      if (!current) return
      // Reconcile the optimistic guess with the server's actual balance —
      // covers drift if another HR session changed the same employee's
      // leave in between.
      queryClient.setQueryData(tableKey, {
        data: current.data.map(row => row.employeeId === input.employeeId ? { ...row, timeOff: result.timeOff } : row),
      })
    },
    onError: (_err, _input, context) => {
      if (!context) return
      if (context.previousTable) queryClient.setQueryData(context.tableKey, context.previousTable)
      if (context.previousSummary) queryClient.setQueryData(context.summaryKey, context.previousSummary)
    },
    onSettled: (_data, _err, input) => {
      queryClient.invalidateQueries({ queryKey: ["hr-attendance-table", input.date] })
      queryClient.invalidateQueries({ queryKey: ["hr-attendance-summary", input.date] })
    },
  })
}
