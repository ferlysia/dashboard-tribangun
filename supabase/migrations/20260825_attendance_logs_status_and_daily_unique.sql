-- ============================================================
--  ATTENDANCE_LOGS: STATUS/REMARKS + ONE-ENTRY-PER-EMPLOYEE-PER-DAY
--
--  Phase 3 (HR status management) + the "user can clock in multiple
--  times a day" bug fix, done together since both touch the same rows.
--
--  1. status/remarks back the HR 1-door action menu (mark Sakit/Izin/
--     Cuti/Alpha, with a note) on top of the default 'masuk' a real
--     clock-in gets.
--  2. attendance_date is a generated Jakarta-calendar-day column (same
--     +07:00, no-DST boundary math as jakartaDayRangeUTC() in
--     app/hr-dashboard/attendance/_lib/week.ts, expressed in SQL) that
--     backs a UNIQUE(employee_id, attendance_date) constraint — this is
--     the actual fix for the multi-clock-in bug, enforced at the
--     database level rather than only the app-layer 5-minute window
--     (which only ever caught same-site rapid double-taps, not a second
--     clock-in at a different site later the same day).
--
--  selfie_storage_path/latitude/longitude are relaxed to nullable
--  because HR's manual status entries (marking someone Sakit/Izin/Cuti/
--  Alpha who never opened the clock-in app) have no selfie or GPS to
--  attach. Real clock-ins still require them — enforced at the API
--  layer (see app/api/attendance/route.ts), not the schema.
-- ============================================================

ALTER TABLE public.attendance_logs
  ALTER COLUMN selfie_storage_path DROP NOT NULL,
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;

ALTER TABLE public.attendance_logs
  ADD COLUMN status TEXT NOT NULL DEFAULT 'masuk'
    CHECK (status IN ('masuk', 'alpha', 'sakit', 'izin', 'cuti')),
  ADD COLUMN remarks TEXT;

ALTER TABLE public.attendance_logs
  ADD COLUMN attendance_date DATE GENERATED ALWAYS AS (
    (recorded_at AT TIME ZONE 'Asia/Jakarta')::date
  ) STORED;

ALTER TABLE public.attendance_logs
  ADD CONSTRAINT attendance_logs_employee_date_unique UNIQUE (employee_id, attendance_date);

CREATE INDEX idx_attendance_logs_status ON public.attendance_logs(status);
