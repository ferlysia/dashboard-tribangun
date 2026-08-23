"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateAttendanceStatus } from "../_hooks/use-update-attendance-status"
import type { AttendanceStatus, AttendanceTableRow } from "../_hooks/use-attendance-table"

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "masuk", label: "Masuk" },
  { value: "alpha", label: "Alpha" },
  { value: "sakit", label: "Sakit" },
  { value: "izin",  label: "Izin" },
  { value: "cuti",  label: "Cuti" },
]

// HR's 1-door action: change one employee's status for the selected day
// and optionally leave a note. Backed by useUpdateAttendanceStatus's
// optimistic cache patch, so the KPI cards and table reflect the change
// immediately — this dialog just needs to close and let the mutation's
// error handler show a toast if the server disagrees.
export function StatusEditDialog({
  row,
  date,
  onClose,
}: {
  row:    AttendanceTableRow | null
  date:   string
  onClose: () => void
}) {
  const [status, setStatus] = React.useState<AttendanceStatus>("masuk")
  const [remarks, setRemarks] = React.useState("")
  const mutation = useUpdateAttendanceStatus()

  React.useEffect(() => {
    if (row) {
      setStatus(row.status)
      setRemarks(row.remarks ?? "")
    }
  }, [row])

  const handleSave = () => {
    if (!row) return
    mutation.mutate(
      { employeeId: row.employeeId, date, status, remarks: remarks.trim() || null },
      {
        onSuccess: () => {
          toast.success(`Status ${row.fullName} diperbarui.`)
          onClose()
        },
        onError: err => {
          toast.error(err instanceof Error ? err.message : "Gagal memperbarui status")
        },
      }
    )
  }

  return (
    <Dialog open={row !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-hr-display">Ubah Status Kehadiran</DialogTitle>
          <DialogDescription className="font-hr-sans">{row?.fullName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-hr-sans text-xs font-semibold text-hr-text-2">Status</label>
            <Select value={status} onValueChange={v => setStatus(v as AttendanceStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-hr-sans text-xs font-semibold text-hr-text-2">Catatan (opsional)</label>
            <Textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="mis. Surat dokter terlampir"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Batal</Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
