import { Building2, Target, FileClock, CheckCircle2 } from "lucide-react"
import type { ScheduleKpis } from "@/lib/pm-schedule/status-rules"

// Same shape as StatCard in app/dashboard/purchasing-request/page.tsx and
// app/dashboard/maintenance-assets/page.tsx — kept page-local like those
// two, matching this repo's existing (duplicated, not shared) convention.
function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon:   React.ElementType
  label:  string
  value:  string | number
  sub?:   string
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <div className={`mt-0.5 rounded-lg p-2 shrink-0 ${accent ?? "bg-muted"}`}>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground tracking-tight leading-none mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export function KpiBar({ kpis, monthLabel }: { kpis: ScheduleKpis; monthLabel: string }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        icon={Building2} label="Active Sites" value={kpis.activeSites}
        sub={`with a visit in ${monthLabel}`}
      />
      <StatCard
        icon={Target} label="Target Visits" value={kpis.targetVisits}
        sub={monthLabel} accent="bg-blue-50 dark:bg-blue-950/40"
      />
      <StatCard
        icon={FileClock} label="Pending Reports" value={kpis.pendingReports}
        sub="completed, report not submitted" accent="bg-amber-50 dark:bg-amber-950/40"
      />
      <StatCard
        icon={CheckCircle2} label="Completed Visits" value={kpis.completedVisits}
        sub={monthLabel} accent="bg-emerald-50 dark:bg-emerald-950/40"
      />
    </div>
  )
}
