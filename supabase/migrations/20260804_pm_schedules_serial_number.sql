-- Optional Serial Number (SN) per visit — e.g. the specific unit serviced,
-- filled in on the "Jadwalkan Kunjungan" form. Nullable, no default: most
-- visits won't set it, and it's never required for status/unit logic.
ALTER TABLE public.pm_schedules ADD COLUMN IF NOT EXISTS sn TEXT;
