"use client"

import * as React from "react"
import { CalendarCheck, CalendarClock, ChevronRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useAttendanceHistory, type HistoryEntry, type HistoryStatus } from "../_hooks/use-attendance-history"
import { addDays, getJakartaToday, toDateKey } from "../_lib/date"

const DAY_ABBR = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] // JS Date#getDay(): 0 = Sunday

const STATUS_LABEL: Record<HistoryStatus, string> = {
  masuk: "Masuk",
  alpha: "Alpha",
  sakit: "Sakit",
  izin:  "Izin",
  cuti:  "Cuti",
}

const STATUS_DOT_CLASS: Record<HistoryStatus, string> = {
  masuk: "bg-hr-success",
  alpha: "bg-hr-danger",
  sakit: "bg-hr-warning",
  izin:  "bg-hr-info",
  cuti:  "bg-hr-rose",
}

const STATUS_BADGE_CLASS: Record<HistoryStatus, string> = {
  masuk: "bg-hr-success/12 text-hr-success-deep",
  alpha: "bg-hr-danger/12 text-hr-danger-deep",
  sakit: "bg-hr-warning/18 text-hr-warning-deep",
  izin:  "bg-hr-info/12 text-hr-info",
  cuti:  "bg-hr-blush-200 text-hr-rose-deep",
}

function formatFullDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })
}

function formatTime(recordedAt: string): string {
  return new Date(recordedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })
}

// Answers the two things a field tech keeps forgetting: "did I already
// absen today?" and "did my weekend shift actually get recorded?" — both
// at a glance, without leaving the main form. Lazy: only ever mounted
// (see clock-in-form.tsx) once an employee is picked, and its query is
// fully independent of the capture pipeline, so it can never add latency
// to the zero-lag submit path.
export function AttendanceHistory({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = React.useState(false)
  const { data, isLoading, isError } = useAttendanceHistory(employeeId)

  const byDate = React.useMemo(() => {
    const map = new Map<string, HistoryEntry>()
    for (const entry of data ?? []) map.set(entry.date, entry)
    return map
  }, [data])

  const todayKey = toDateKey(getJakartaToday())
  const todayEntry = byDate.get(todayKey)

  const stripDays = React.useMemo(() => {
    const today = getJakartaToday()
    return Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i)))
  }, [])

  if (isLoading) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-hr-2xl border border-hr-hairline bg-white px-4 py-3.5 shadow-hr-card">
        <div className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-hr-blush-100" />
        <div className="h-3 w-40 animate-pulse rounded-full bg-hr-blush-100" />
      </div>
    )
  }

  if (isError) {
    return (
      <p className="mt-4 px-1 font-hr-sans text-xs text-hr-text-3">
        Riwayat kehadiran tidak tersedia saat ini.
      </p>
    )
  }

  const SummaryIcon: LucideIcon = todayEntry ? CalendarCheck : CalendarClock

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex w-full items-center gap-3 rounded-hr-2xl border border-hr-hairline bg-white px-4 py-3.5 text-left shadow-hr-card transition active:scale-[0.99]"
      >
        <span className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full",
          todayEntry ? "bg-hr-success/12 text-hr-success-deep" : "bg-hr-blush-100 text-hr-rose-deep"
        )}>
          <SummaryIcon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-hr-sans text-sm font-semibold text-hr-ink">
            {todayEntry
              ? todayEntry.status === "masuk"
                ? `Sudah absen hari ini · ${formatTime(todayEntry.recordedAt)}`
                : `Status hari ini: ${STATUS_LABEL[todayEntry.status]}`
              : "Belum absen hari ini"}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            {stripDays.map(d => {
              const key = toDateKey(d)
              const entry = byDate.get(key)
              const isToday = key === todayKey
              return (
                <span
                  key={key}
                  title={`${DAY_ABBR[d.getDay()]} — ${entry ? STATUS_LABEL[entry.status] : "Belum ada data"}`}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold",
                    isToday ? "ring-2 ring-hr-rose ring-offset-1" : "",
                    entry ? cn(STATUS_DOT_CLASS[entry.status], "text-white") : "border border-hr-hairline text-hr-text-3"
                  )}
                >
                  {DAY_ABBR[d.getDay()].slice(0, 1)}
                </span>
              )
            })}
          </div>
        </div>

        <ChevronRight className="h-5 w-5 shrink-0 text-hr-text-3" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="flex max-h-[85vh] flex-col">
          <DrawerHeader className="shrink-0 text-left">
            <DrawerTitle className="font-hr-sans">Riwayat Kehadiran Saya</DrawerTitle>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {(!data || data.length === 0) && (
              <p className="px-2 py-6 text-center font-hr-sans text-sm text-hr-text-3">Belum ada riwayat kehadiran.</p>
            )}
            <div className="flex flex-col gap-1 pb-4">
              {data?.map(entry => (
                <div
                  key={entry.date}
                  className="flex items-center justify-between gap-3 rounded-hr-lg border border-hr-hairline px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-hr-sans text-sm font-medium capitalize text-hr-ink">
                      {formatFullDate(entry.date)}
                    </p>
                    {entry.siteName && (
                      <p className="truncate font-hr-sans text-xs text-hr-text-3">{entry.siteName}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {entry.status === "masuk" && (
                      <span className="font-hr-sans text-xs text-hr-text-2">{formatTime(entry.recordedAt)}</span>
                    )}
                    <span className={cn(
                      "rounded-hr-pill px-2.5 py-1 font-hr-sans text-[11px] font-semibold",
                      STATUS_BADGE_CLASS[entry.status]
                    )}>
                      {STATUS_LABEL[entry.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
