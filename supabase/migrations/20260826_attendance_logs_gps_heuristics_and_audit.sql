-- ============================================================
--  ATTENDANCE_LOGS: GPS SPOOFING HEURISTICS + HR AUDIT TRAIL
--
--  altitude/altitude_accuracy/speed: raw GeolocationPosition.coords
--  fields the client already receives but wasn't sending — feeds the
--  server-side mock-GPS heuristic in app/api/attendance/route.ts.
--
--  location_flagged/location_flag_reason: best-effort, non-blocking.
--  Client-reported location can never be cryptographically verified
--  from a web PWA (a spoofing app controls what the Geolocation API
--  itself reports), so this is a soft signal for HR review, not a
--  gate — false positives from legitimate low-precision indoor GPS
--  would otherwise lock out real field techs.
--
--  updated_by/updated_at: audit trail for HR's 1-door status action
--  (app/api/hr/attendance/status/route.ts) — who last changed a
--  status/remarks and when, distinct from recorded_at (the original
--  clock-in/creation instant, never overwritten by a later edit).
-- ============================================================

ALTER TABLE public.attendance_logs
  ADD COLUMN altitude             DOUBLE PRECISION,
  ADD COLUMN altitude_accuracy    DOUBLE PRECISION,
  ADD COLUMN speed                DOUBLE PRECISION,
  ADD COLUMN location_flagged     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN location_flag_reason TEXT,
  ADD COLUMN updated_by           TEXT,
  ADD COLUMN updated_at           TIMESTAMPTZ;

CREATE INDEX idx_attendance_logs_location_flagged
  ON public.attendance_logs(location_flagged) WHERE location_flagged;
