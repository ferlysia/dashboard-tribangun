"use client"

import * as React from "react"
import { useSchedulesQuery } from "../_hooks/use-pm-schedules"
import { STATUS_CFG } from "./status-badge"

const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number)
  const date = new Date(Date.UTC(year, m - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`
}

function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number)
  return `${MONTH_NAMES_ID[m - 1]} ${year}`
}

// Stable reference so `data ?? EMPTY` doesn't create a new array every
// render while a month's query is loading, which would otherwise defeat
// the useMemo below.
const EMPTY_SCHEDULES: never[] = []

// One month's grid — fetches its own data via the same shared
// useSchedulesQuery cache everything else in the dashboard uses, so a month
// that's already loaded elsewhere (e.g. the Matrix Grid's active month) is
// reused instantly instead of re-fetched.
const MonthSection = React.memo(function MonthSection({ month, onOpenDrawer }: {
  month:        string
  onOpenDrawer: (id: string) => void
}) {
  const { data, isLoading } = useSchedulesQuery(month)
  const schedules = data ?? EMPTY_SCHEDULES

  const byDay = React.useMemo(() => {
    const map = new Map<string, typeof schedules>()
    for (const s of schedules) {
      const day = s.scheduled_date.slice(0, 10)
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(s)
    }
    return map
  }, [schedules])

  const cells = React.useMemo(() => {
    const [year, monthIdx] = month.split("-").map(Number)
    const firstOfMonth = new Date(Date.UTC(year, monthIdx - 1, 1))
    const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7 // 0 = Monday
    const gridStart = new Date(firstOfMonth)
    gridStart.setUTCDate(gridStart.getUTCDate() - firstWeekday)

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart)
      date.setUTCDate(date.getUTCDate() + i)
      return { date, inMonth: date.getUTCMonth() === monthIdx - 1 }
    })
  }, [month])

  return (
    <div className="border-b-4 border-border">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-3 py-2 border-b border-border">
        <h3 className="text-sm font-bold text-foreground">{monthLabel(month)}</h3>
      </div>
      {isLoading ? (
        <div className="p-6 text-center text-xs text-muted-foreground">Memuat...</div>
      ) : (
        <div className="grid grid-cols-7">
          {cells.map(({ date, inMonth }) => {
            const day = isoDay(date)
            const items = byDay.get(day) ?? []
            return (
              <div
                key={day}
                className={`min-h-[100px] border-b border-r border-border p-1.5 last:border-r-0 ${inMonth ? "" : "bg-muted/10"}`}
              >
                <p className={`text-[11px] mb-1 ${inMonth ? "text-foreground" : "text-muted-foreground/50"}`}>
                  {date.getUTCDate()}
                </p>
                <div className="flex flex-col gap-1">
                  {items.slice(0, 3).map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onOpenDrawer(s.id)}
                      title={s.sites?.name ?? ""}
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate text-left ${STATUS_CFG[s.status].badge}`}
                    >
                      {s.sites?.name ?? "—"}
                    </button>
                  ))}
                  {items.length > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1.5">+{items.length - 3} lagi</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

const INITIAL_MONTHS_AHEAD = 6
const LOAD_MORE_MONTHS = 6

// Continuous vertical scroll (agenda-style, like a calendar app) instead of
// a single month + Prev/Next buttons — scrolling down keeps revealing
// future months via an IntersectionObserver sentinel. `anchorMonth` (the
// month selected elsewhere in the dashboard) is only the starting point;
// scrolling here is otherwise independent of that shared single-month
// state, since a continuous calendar inherently needs a range, not one
// month at a time.
export function CalendarView({ anchorMonth, onOpenDrawer }: {
  anchorMonth:  string
  onOpenDrawer: (id: string) => void
}) {
  const [monthCount, setMonthCount] = React.useState(INITIAL_MONTHS_AHEAD)
  const sentinelRef = React.useRef<HTMLDivElement>(null)

  // Jumping the global month picker resets the range to start there again.
  React.useEffect(() => { setMonthCount(INITIAL_MONTHS_AHEAD) }, [anchorMonth])

  const months = React.useMemo(
    () => Array.from({ length: monthCount }, (_, i) => shiftMonth(anchorMonth, i)),
    [anchorMonth, monthCount]
  )

  React.useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) setMonthCount(c => c + LOAD_MORE_MONTHS) },
      { rootMargin: "400px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAY_LABELS.map(label => (
          <div key={label} className="px-2 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center">
            {label}
          </div>
        ))}
      </div>
      <div className="max-h-[75vh] overflow-y-auto">
        {months.map(month => (
          <MonthSection key={month} month={month} onOpenDrawer={onOpenDrawer} />
        ))}
        <div ref={sentinelRef} className="h-10 flex items-center justify-center text-[11px] text-muted-foreground">
          Memuat bulan berikutnya...
        </div>
      </div>
    </div>
  )
}
