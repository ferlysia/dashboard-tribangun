-- ============================================================
--  ATTENDANCE_LOGS: SWITCH FROM FREE-TEXT NAME TO EMPLOYEE_ID FK
--
--  Cuts over from the free-text worker_name (with its generated
--  worker_name_normalized dedup key) to a hard reference into the new
--  Employee Master Data table (public.employees, see
--  20260822_employees.sql — run that first, this depends on it).
--
--  DROP COLUMN ... CASCADE removes worker_name, its dependent generated
--  column worker_name_normalized, and the old dedupe index that referenced
--  it, all in one step.
-- ============================================================

ALTER TABLE public.attendance_logs DROP COLUMN IF EXISTS worker_name CASCADE;

ALTER TABLE public.attendance_logs
  ADD COLUMN employee_id TEXT REFERENCES public.employees(employee_id);

-- Left NULLABLE deliberately: any existing rows from before this migration
-- have no employee_id to backfill. Once you've confirmed there are no
-- orphaned rows (delete test/pre-cutover rows, or backfill employee_id
-- manually), tighten with:
--   ALTER TABLE public.attendance_logs ALTER COLUMN employee_id SET NOT NULL;
-- The API route enforces "required" at the application layer in the
-- meantime (see app/api/attendance/route.ts).

CREATE INDEX idx_attendance_logs_dedupe_window
  ON public.attendance_logs(employee_id, site_name, recorded_at);
