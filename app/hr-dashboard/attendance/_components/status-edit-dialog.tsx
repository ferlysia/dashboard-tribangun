"use client"

import * as React from "react"
import { toast } from "sonner"
import { UserCheck, UserX, Thermometer, FileText, Plane, Loader2, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateAttendanceStatus } from "../_hooks/use-update-attendance-status"
import type { AttendanceStatus, AttendanceTableRow } from "../_hooks/use-attendance-table"

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: LucideIcon }[] = [
  { value: "masuk", label: "Masuk", icon: UserCheck },
  { value: "alpha", label: "Alpha", icon: UserX },
  { value: "sakit", label: "Sakit", icon: Thermometer },
  { value: "izin",  label: "Izin",  icon: FileText },
  { value: "cuti",  label: "Cuti",  icon: Plane },
]

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

// HR's 1-door action: one click on a status pill in the table opens this
// straight away (no dropdown detour), a chip picker replaces the old
// plain <select>, and the leave balance panel (employees.time_off) gives
// HR the context they need before approving Cuti — setting Cuti here
// actually deducts 1 day from that balance server-side (restored if
// later changed away from Cuti; see /api/hr/attendance/status). Backed
// by useUpdateAttendanceStatus's optimistic cache patch, so the KPI
// cards and table update before the request even resolves.
export function StatusEditDialog({
  row,
  date,
  onClose,
}: {
  row:     AttendanceTableRow | null
  date:    string
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
        onSuccess: result => {
          toast.success(`Status ${row.fullName} diperbarui.`)
          if (result.leaveBalanceSkipped) {
            toast.warning("Saldo cuti karyawan ini belum diatur di data induk — status tetap disimpan.")
          } else if (result.timeOff != null && result.timeOff < 0) {
            toast.warning(`Sisa cuti ${row.fullName} menjadi minus (${result.timeOff} hari) setelah perubahan ini.`)
          }
          onClose()
        },
        onError: err => {
          toast.error(err instanceof Error ? err.message : "Gagal memperbarui status")
        },
      }
    )
  }

  const insufficientBalance = status === "cuti" && row?.status !== "cuti" && row?.timeOff != null && row.timeOff <= 0

  return (
    <Dialog open={row !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="overflow-hidden rounded-hr-3xl border-hr-hairline p-0 shadow-hr-card sm:max-w-md">
        <div className="flex items-center gap-3 bg-hr-cream-100 p-6">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-hr-brand font-hr-display text-sm font-black text-white">
            {row ? initials(row.fullName) : ""}
          </span>
          <div className="min-w-0">
            <p className="hr-eyebrow inline-block !px-2.5 !py-1 !text-[9px]">Ubah Status Kehadiran</p>
            <DialogHeader className="mt-0.5 p-0 text-left">
              <DialogTitle className="truncate font-hr-display text-lg font-black text-hr-ink">
                {row?.fullName}
              </DialogTitle>
            </DialogHeader>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-6 pt-5">
          <div className="flex flex-col gap-1.5 rounded-hr-xl border border-hr-hairline-brand bg-hr-blush-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-hr-sans text-xs font-semibold text-hr-text-2">Sisa Cuti</span>
              <span className="font-hr-display text-lg font-black text-hr-rose-deep">
                {row?.timeOff != null ? `${row.timeOff} hari` : "—"}
              </span>
            </div>
            {insufficientBalance && (
              <p className="font-hr-sans text-[11px] font-medium text-hr-danger-deep">
                Saldo cuti sudah habis — menyimpan sebagai Cuti akan membuatnya minus.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-hr-sans text-xs font-semibold uppercase tracking-hr-eyebrow text-hr-text-2">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map(opt => {
                const active = status === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-hr-xl border p-3 font-hr-sans text-xs font-semibold transition-all active:scale-95",
                      active
                        ? "border-hr-rose bg-hr-brand text-white shadow-hr-brand"
                        : "border-hr-hairline bg-white text-hr-text-2 hover:border-hr-hairline-brand hover:bg-hr-cream-100"
                    )}
                  >
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-hr-sans text-xs font-semibold uppercase tracking-hr-eyebrow text-hr-text-2">Catatan (opsional)</label>
            <Textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="mis. Surat dokter terlampir"
              className="rounded-hr-lg border-hr-hairline font-hr-sans"
            />
          </div>

          {row?.updatedBy && row.updatedAt && (
            <p className="font-hr-sans text-[11px] text-hr-text-3">
              Terakhir diubah oleh {row.updatedBy} ·{" "}
              {new Date(row.updatedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              className="rounded-hr-xl border-hr-hairline font-hr-sans"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Batal
            </Button>
            <Button
              className="rounded-hr-xl bg-hr-brand font-hr-sans font-semibold shadow-hr-brand hover:brightness-105"
              onClick={handleSave}
              disabled={mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
