-- ============================================================
--  PM MAINTENANCE SCHEDULE & OPERATIONS DASHBOARD
--
--  A new, standalone site-level operational scheduling/dispatch layer for
--  preventive-maintenance visits. Deliberately NOT linked to
--  site_contracts/contract_milestones (sql/maintenance_assets_schema.sql) —
--  those track asset-level PM compliance with report uploads; this tracks
--  "who's visiting which site when" for planning/dispatch. See the PM
--  Maintenance Schedule dashboard plan for the full rationale.
--
--  `sites` is new and purely additive: it does not touch the pre-existing
--  free-text site_name/site_maintenance columns on purchase_requests,
--  assets, or site_contracts.
-- ============================================================

CREATE TABLE public.sites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.pm_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  scheduled_date  DATE NOT NULL,
  -- Generated, indexed month bucket — drives the Matrix Grid's month/week
  -- grouping and the KPI bar's "target visits this month" without a
  -- date_trunc() on every query. Cast to ::timestamp (not left as date) so
  -- Postgres resolves the IMMUTABLE date_trunc(text, timestamp) overload —
  -- left implicit, it resolves to the timestamptz overload instead, which
  -- is only STABLE (timezone-dependent) and generated columns require an
  -- immutable expression.
  scheduled_month DATE GENERATED ALWAYS AS (date_trunc('month', scheduled_date::timestamp)::date) STORED,
  status          TEXT NOT NULL DEFAULT 'PLANNED'
                    CHECK (status IN ('PLANNED', 'ANNOUNCED', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULED')),
  -- Technician/team, free text — UI is a datalist-backed autocomplete
  -- sourced from previously used names, not a separate technicians table.
  assignee        TEXT,
  notes           TEXT,
  -- A status toggle, not a file upload (that's explicitly out of scope) —
  -- lets the KPI bar's "Pending Reports" counter mean something: a
  -- COMPLETED visit whose report hasn't been logged as submitted yet.
  report_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.pm_schedules.status IS
  'Lifecycle: PLANNED -> ANNOUNCED -> IN_PROGRESS -> COMPLETED. RESCHEDULED is a side-branch (not a forward step) reachable from PLANNED/ANNOUNCED/IN_PROGRESS when a visit is pushed to a new date, and re-enters the flow at PLANNED/ANNOUNCED once the new date is set — see lib/pm-schedule/status-rules.ts.';

-- Composite indexes for the two access patterns the UI actually needs:
-- "this month's matrix" and "this site's history" — mirrors the only other
-- date-range index precedent in the repo (contract_milestones' partial
-- index idx_milestones_overdue_scan).
CREATE INDEX idx_pm_schedules_month_status ON public.pm_schedules(scheduled_month, status);
CREATE INDEX idx_pm_schedules_site_date    ON public.pm_schedules(site_id, scheduled_date);

CREATE TRIGGER trg_pm_schedules_updated_at
  BEFORE UPDATE ON public.pm_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_sites_all"
  ON public.sites FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_pm_schedules_all"
  ON public.pm_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_sites_read"
  ON public.sites FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth_pm_schedules_read"
  ON public.pm_schedules FOR SELECT TO anon, authenticated USING (true);
