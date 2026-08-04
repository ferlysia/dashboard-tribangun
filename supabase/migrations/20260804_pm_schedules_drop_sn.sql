-- Rollback of the single visit-level `sn` column added earlier today
-- (20260804_pm_schedules_serial_number.sql). Wrong data model: a single
-- visit can service multiple units, so the serial number is per-unit, not
-- per-visit. Replaced by an `sns` array nested inside each pm_schedules/
-- sites.unit_types JSONB entry (no schema change needed for that — it's
-- already a flexible jsonb column).
ALTER TABLE public.pm_schedules DROP COLUMN IF EXISTS sn;
