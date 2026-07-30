-- ============================================================
--  PM SCHEDULE — ACTUAL COMPLETED UNITS + RESCHEDULE AUDIT TRAIL
--  Run this AFTER 20260801_pm_schedules_recurring.sql.
-- ============================================================

-- ── 1. Actual completed units (partial-completion / split-visit support) ──
ALTER TABLE public.pm_schedules
  ADD COLUMN actual_unit_count INTEGER CHECK (actual_unit_count IS NULL OR actual_unit_count >= 0);
COMMENT ON COLUMN public.pm_schedules.actual_unit_count IS
  'Units actually completed on this visit. NULL until the visit is marked COMPLETED, at which point the API auto-fills it to the visit''s target (unit_count override, or the site default) unless the client explicitly supplies a value in the same request. Admin can edit it afterward for partial completion (e.g. 4 of 8 done due to a client audit cutting the visit short).';

-- ── 2. Reschedule audit trail ───────────────────────────────────────────
ALTER TABLE public.pm_schedules
  ADD COLUMN reschedule_history JSONB NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.pm_schedules.reschedule_history IS
  'Append-only log of every scheduled_date change: [{"from": "...", "to": "...", "at": "..."}, ...] (ISO date/timestamp strings). Logged on ANY date edit to this row, not just ones made via the RESCHEDULED status, so the original planned date is never silently lost.';
