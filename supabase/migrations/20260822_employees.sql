-- ============================================================
--  EMPLOYEE MASTER DATA
--
--  Backing table for the Employee Master Data import. Column names and
--  nullability mirror the confirmed source sample exactly — spellings
--  like `adress`/`martial_status` are kept as-is to match the source data,
--  not corrected, so imports map 1:1 without a translation layer.
--
--  `employee_id`, `id_number`, `bjps_kes_number`, `bpjs_tk_number`,
--  `account_number`, and `phone_number` are strictly TEXT (not numeric):
--  the source data carries leading zeros and Excel string markers
--  (e.g. '0000462966816) that a numeric type would silently destroy.
--
--  IMPORTANT — run this migration BEFORE
--  supabase/migrations/20260822_attendance_logs.sql (updated): that file's
--  attendance_logs.employee_id now has a FOREIGN KEY into
--  public.employees(employee_id), even though this file's name sorts
--  after it alphabetically — attendance_logs predates this table existing.
-- ============================================================

CREATE TABLE public.employees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         TEXT NOT NULL,
  position          TEXT,
  adress            TEXT,
  religion          TEXT,
  martial_status    TEXT,
  status_employee   TEXT,
  bank              TEXT,
  last_education    TEXT,
  email             TEXT,
  family_status     TEXT,
  join_date         DATE,
  -- Unparsed source strings (e.g. "Tarutung , 28 Agustus 1979") — mixes
  -- place-of-birth into the same field with inconsistent formatting, so
  -- it isn't safely parseable into a DATE yet.
  date_birth        TEXT,
  time_off          INTEGER,
  -- Business employee code (distinct from the UUID PK `id`) — this is the
  -- identity attendance_logs.employee_id references. UNIQUE so it can be
  -- an FK target.
  employee_id       TEXT UNIQUE,
  id_number         TEXT,
  bjps_kes_number   TEXT,
  bpjs_tk_number    TEXT,
  account_number    TEXT,
  phone_number      TEXT
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_employees_all"
  ON public.employees FOR ALL TO service_role USING (true) WITH CHECK (true);

-- PII (address, religion, marital status, bank/ID numbers) — authenticated-
-- only read, same reasoning as attendance_logs.
CREATE POLICY "auth_employees_read"
  ON public.employees FOR SELECT TO authenticated USING (true);
