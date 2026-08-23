"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getWeekDays, toDateKey, addWeeks } from "../_lib/week"

const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]

export function WeekNavigator({ selected, onSelect }: { selected: Date; onSelect: (d: Date) => void }) {
  const weekDays = getWeekDays(selected)
  const selectedKey = toDateKey(selected)
  const todayKey = toDateKey(new Date())

  return (
    <div className="flex flex-col gap-3 rounded-hr-3xl border border-hr-hairline bg-white/80 p-4 shadow-hr-card backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSelect(addWeeks(selected, -1))}
          className="grid h-8 w-8 place-items-center rounded-full border border-hr-hairline text-hr-rose transition hover:bg-hr-blush-50"
          aria-label="Minggu sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-hr-sans text-sm font-semibold text-hr-ink">
          {weekDays[0].toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
          {" – "}
          {weekDays[6].toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => onSelect(addWeeks(selected, 1))}
          className="grid h-8 w-8 place-items-center rounded-full border border-hr-hairline text-hr-rose transition hover:bg-hr-blush-50"
          aria-label="Minggu berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {weekDays.map((day, i) => {
          const key = toDateKey(day)
          const isSelected = key === selectedKey
          const isToday = key === todayKey
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(day)}
              className={cn(
                "flex min-w-[52px] flex-col items-center gap-0.5 rounded-hr-pill px-3 py-2 font-hr-sans text-xs font-semibold transition",
                isSelected
                  ? "bg-hr-brand text-white shadow-hr-brand"
                  : "border border-hr-hairline text-hr-text-2 hover:border-hr-hairline-brand hover:bg-hr-blush-50"
              )}
            >
              <span className="text-[10px] uppercase tracking-hr-eyebrow opacity-80">{DAY_LABELS[i]}</span>
              <span className="text-sm">{day.getDate()}</span>
              {isToday && !isSelected && <span className="h-1 w-1 rounded-full bg-hr-rose" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
