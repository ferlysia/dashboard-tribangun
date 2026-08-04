"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"

// Sticky bar, same shape as the bulk-action bar in all-sites-view.tsx
// (app/dashboard/maintenance-schedule) — appears once >=1 row is selected.
export function BulkActionBar({ count, onMarkPaid, onClear }: {
  count:       number
  onMarkPaid:  () => void
  onClear:     () => void
}) {
  if (count === 0) return null

  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 rounded-lg border-2 border-primary/40 bg-primary/5 dark:bg-primary/10 px-3 py-2 shadow-sm">
      <span className="text-xs font-semibold text-foreground">{count} dipilih</span>
      <div className="flex-1" />
      <Button type="button" size="sm" className="gap-1.5 text-xs" onClick={onMarkPaid}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Mark {count} as Paid
      </Button>
      <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={onClear}>
        Batal
      </Button>
    </div>
  )
}
