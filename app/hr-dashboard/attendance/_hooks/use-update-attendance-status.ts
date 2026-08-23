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

function summaryFromRows(date: string, rows: AttendanceTableRow[], totalEmployees: number): AttendanceSummary {
  const present = rows.filter(r => r.status === "masuk").length
  const sick = rows.filter(r => r.status === "sakit").length
  const leave = rows.filter(r => r.status === "izin" || r.status === "cuti").length
  const alpha = Math.max(totalEmployees - present - sick - leave, 0)
  return { date, present, alpha, totalEmployees, sick, leave }
}

// HR's 1-door status action. The KPI cards must update "instantly" (per
// the Zero-Lag UI mandate), so this patches the table + summary query
// caches optimistically before the request even resolves, then
// reconciles with the server on settle — matching the pattern the
// realtime feed already uses (see use-attendance-realtime.ts) rather
// than waiting a full round-trip just to re-render four numbers.
export function useUpdateAttendanceStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateStatusInput) => {
      const res = await fetch("/api/hr/attendance/status", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(input),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Gagal memperbarui status")
      return body.data
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
        const nextRows = previousTable.data.map(row =>
          row.employeeId === input.employeeId ? { ...row, status: input.status, remarks: input.remarks } : row
        )
        queryClient.setQueryData(tableKey, { data: nextRows })
        queryClient.setQueryData(
          summaryKey,
          summaryFromRows(input.date, nextRows, previousSummary?.totalEmployees ?? nextRows.length)
        )
      }

      return { previousTable, previousSummary, tableKey, summaryKey }
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
