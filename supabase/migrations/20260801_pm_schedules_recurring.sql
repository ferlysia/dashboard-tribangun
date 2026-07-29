-- ============================================================
--  PM SCHEDULE — RECURRING GENERATOR, MULTI-ASSIGNEE, UNIT COUNT
--  Run this AFTER 20260731_pm_schedules.sql.
-- ============================================================

-- ── 1. Hybrid unit_count: site-level master + per-visit override ──────
ALTER TABLE public.sites
  ADD COLUMN unit_count INTEGER NOT NULL DEFAULT 0 CHECK (unit_count >= 0);
COMMENT ON COLUMN public.sites.unit_count IS
  'Master total units/equipment at this site. Editable anytime (e.g. Sales upsells more units). Falls through to pm_schedules.unit_count as the default when a visit has no override.';

ALTER TABLE public.pm_schedules
  ADD COLUMN unit_count INTEGER CHECK (unit_count IS NULL OR unit_count >= 0);
COMMENT ON COLUMN public.pm_schedules.unit_count IS
  'Per-visit override of sites.unit_count. NULL (the default) means "use the site''s current total" — e.g. a site normally has 10 units but only 4 are serviceable today due to an audit, so this visit gets unit_count=4 while the site total stays 10.';


-- ── 2. assignee (single TEXT) -> assignees (TEXT[]) ────────────────────
-- Same backfill-then-drop shape as 20260729_purchase_request_warehouse_pipeline.sql.
-- Never pre-filled at creation time (technicians are assigned dynamically
-- ~1 week out, not when a schedule is first planned) — see
-- lib/pm-schedule/recurring.ts and the create-schedule-dialog recurring
-- generator, which always creates rows with assignees = '{}'.
ALTER TABLE public.pm_schedules ADD COLUMN assignees TEXT[] NOT NULL DEFAULT '{}';
UPDATE public.pm_schedules
  SET assignees = CASE WHEN assignee IS NOT NULL THEN ARRAY[assignee] ELSE '{}'::text[] END;
ALTER TABLE public.pm_schedules DROP COLUMN assignee;

COMMENT ON COLUMN public.pm_schedules.assignees IS
  'Technicians/team assigned to this visit. Always optional and empty by default, including on recurring/batch-generated visits — assignment happens dynamically roughly a week before the visit date, not at scheduling time.';
