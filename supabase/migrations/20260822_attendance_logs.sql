-- ============================================================
--  ATTENDANCE CLOCK-IN LOG (standalone)
--
--  Deliberately NOT linked to any employee/worker master table — that
--  data model doesn't exist yet. worker_name and site_name are free text
--  (mirrors the pm_schedules.assignee / purchase_requests.site_name
--  precedent for fields that intentionally don't FK into a master table).
--  Append-only audit log, like activity_logs — no updated_at/trigger.
-- ============================================================

CREATE TABLE public.attendance_logs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name            TEXT NOT NULL,
  -- Trimmed/lowercased/whitespace-collapsed — stable dedup/grouping key,
  -- also used by the duplicate-window abuse check. Keeps worker_name
  -- itself display-friendly (original casing) while giving the future
  -- Employee Master Data migration a canonical key to group on.
  worker_name_normalized TEXT GENERATED ALWAYS AS (
    lower(regexp_replace(trim(worker_name), '\s+', ' ', 'g'))
  ) STORED,
  -- Reserved for the future Employee Master Data migration. No FK yet —
  -- the referenced table doesn't exist this milestone. That migration
  -- becomes a backfill + ADD CONSTRAINT, not a schema change against a
  -- table that's already accumulating rows.
  employee_id            UUID,
  site_name              TEXT NOT NULL,
  selfie_storage_path    TEXT NOT NULL,
  latitude               DOUBLE PRECISION NOT NULL,
  longitude              DOUBLE PRECISION NOT NULL,
  -- GeolocationPosition.coords.accuracy in meters — a low-accuracy read
  -- (e.g. network-based fallback) is itself a fraud signal worth keeping.
  location_accuracy_m    DOUBLE PRECISION,
  -- Client device clock, kept ONLY for drift/tamper analysis against
  -- recorded_at below. Never used as the row's authoritative timestamp —
  -- see recorded_at.
  device_reported_at     TIMESTAMPTZ,
  user_agent             TEXT,
  -- The invisible time-lock: server-authoritative, DEFAULT NOW() at the
  -- database level. The insert payload from the API route must never
  -- include this column, so a compromised or spoofed client cannot set it.
  recorded_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_logs_recorded_at ON public.attendance_logs(recorded_at);
CREATE INDEX idx_attendance_logs_site_name   ON public.attendance_logs(site_name);
-- Backs the duplicate-window abuse check ("has this worker+site already
-- clocked in in the last N minutes?").
CREATE INDEX idx_attendance_logs_dedupe_window
  ON public.attendance_logs(worker_name_normalized, site_name, recorded_at);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_attendance_logs_all"
  ON public.attendance_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Diverges from the pm_schedules/sites anon-read precedent: this table
-- holds selfies + GPS (PII), so read access is authenticated-only, not anon.
CREATE POLICY "auth_attendance_logs_read"
  ON public.attendance_logs FOR SELECT TO authenticated USING (true);
