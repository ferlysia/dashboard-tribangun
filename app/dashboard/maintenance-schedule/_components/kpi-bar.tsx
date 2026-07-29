import { Building2, Target, FileClock, CheckCircle2 } from "lucide-react"
import type { ScheduleKpis } from "@/lib/pm-schedule/status-rules"

interface CardTheme {
  border: string
  bg:     string
  icon:   string
  text:   string
}

const THEMES: Record<"neutral" | "blue" | "amber" | "green", CardTheme> = {
  neutral: {
    border: "border-slate-300 dark:border-slate-700",
    bg:     "bg-slate-50 dark:bg-slate-900/40",
    icon:   "bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900",
    text:   "text-slate-900 dark:text-slate-100",
  },
  blue: {
    border: "border-blue-300 dark:border-blue-800",
    bg:     "bg-blue-50 dark:bg-blue-950/30",
    icon:   "bg-blue-500 text-white",
    text:   "text-blue-700 dark:text-blue-400",
  },
  amber: {
    border: "border-amber-300 dark:border-amber-800",
    bg:     "bg-amber-50 dark:bg-amber-950/30",
    icon:   "bg-amber-500 text-white",
    text:   "text-amber-700 dark:text-amber-400",
  },
  green: {
    border: "border-green-300 dark:border-green-800",
    bg:     "bg-green-50 dark:bg-green-950/30",
    icon:   "bg-green-500 text-white",
    text:   "text-green-700 dark:text-green-400",
  },
}

// High-contrast, Monday.com-style stat tile — distinct colored border +
// tinted surface + bold icon chip + a prominent (text-3xl/font-bold) KPI
// number, deliberately bolder than the pale StatCard convention used
// elsewhere in the app (purchasing-request, maintenance-assets), matching
// the "flat/invisible" feedback on this specific page.
function StatCard({ icon: Icon, label, value, sub, theme }: {
  icon:  React.ElementType
  label: string
  value: string | number
  sub?:  string
  theme: CardTheme
}) {
  return (
    <div className={`rounded-xl border-2 ${theme.border} ${theme.bg} p-4 flex items-start gap-3 shadow-sm`}>
      <div className={`mt-0.5 rounded-lg p-2.5 shrink-0 ${theme.icon}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-3xl font-bold tracking-tight leading-none mt-1.5 ${theme.text}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
      </div>
    </div>
  )
}

export function KpiBar({ kpis, monthLabel }: { kpis: ScheduleKpis; monthLabel: string }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        icon={Building2} label="Active Sites" value={kpis.activeSites}
        sub={`with a visit in ${monthLabel}`} theme={THEMES.neutral}
      />
      <StatCard
        icon={Target} label="Target Visits" value={kpis.targetVisits}
        sub={monthLabel} theme={THEMES.blue}
      />
      <StatCard
        icon={FileClock} label="Pending Reports" value={kpis.pendingReports}
        sub="completed, report not submitted" theme={THEMES.amber}
      />
      <StatCard
        icon={CheckCircle2} label="Completed Visits" value={kpis.completedVisits}
        sub={monthLabel} theme={THEMES.green}
      />
    </div>
  )
}
