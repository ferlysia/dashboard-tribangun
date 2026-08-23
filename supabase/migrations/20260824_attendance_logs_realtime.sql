-- ============================================================
--  ATTENDANCE_LOGS: ENABLE REALTIME
--
--  The HR Attendance Dashboard listens for new clock-ins via a
--  server-side Supabase Realtime subscription (service-role, never
--  exposed to the browser — see app/api/hr/attendance/stream/route.ts,
--  which relays events to connected dashboard clients over SSE).
--  postgres_changes only fires for tables added to the supabase_realtime
--  publication, hence this migration.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
