-- ============================================================
--  TRIBANGUN DASHBOARD – DATABASE MIGRATIONS
--  Jalankan di Supabase SQL Editor
-- ============================================================

-- ── 1. Tambah kolom onedrive_folder_url ke project_details ──
ALTER TABLE project_details
  ADD COLUMN IF NOT EXISTS onedrive_folder_url TEXT;

-- ── 2. Kolom pendukung "Create New Project" secara manual ───
ALTER TABLE project_details
  ADD COLUMN IF NOT EXISTS created_manually BOOLEAN DEFAULT FALSE;

ALTER TABLE project_details
  ADD COLUMN IF NOT EXISTS customer_name TEXT;

ALTER TABLE project_details
  ADD COLUMN IF NOT EXISTS project_status TEXT DEFAULT 'BERJALAN';

-- ── 3. Tabel project_weekly_logs ────────────────────────────
CREATE TABLE IF NOT EXISTS project_weekly_logs (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  project_key   TEXT          NOT NULL,
  week_number   INTEGER       NOT NULL DEFAULT 1,
  description   TEXT          NOT NULL DEFAULT '',
  photo_url     TEXT          DEFAULT '',
  created_by    TEXT          DEFAULT '',
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_logs_project_key
  ON project_weekly_logs(project_key);

-- ── 4. Tabel project_schedule_items ─────────────────────────
CREATE TABLE IF NOT EXISTS project_schedule_items (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_key       TEXT        NOT NULL,
  week_number       INTEGER     NOT NULL DEFAULT 1,
  task_description  TEXT        NOT NULL DEFAULT '',
  progress_weight   INTEGER     NOT NULL DEFAULT 10,
  is_done           BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_items_project_key
  ON project_schedule_items(project_key);

-- ── 5. Bucket Supabase Storage untuk foto lapangan ──────────
--  Buat bucket "project-photos" di Supabase Dashboard > Storage
--  (atau lewat SQL di bawah ini, pastikan ekstensi storage aktif)
-- INSERT INTO storage.buckets (id, name, public)
--   VALUES ('project-photos', 'project-photos', true)
--   ON CONFLICT (id) DO NOTHING;

-- ── 6. Kolom cost_stream di project_costs (Modul 4) ─────────
--  'main' = PO Utama, 'vo' = Kerja Tambah / Variation Order
ALTER TABLE project_costs
  ADD COLUMN IF NOT EXISTS cost_stream TEXT NOT NULL DEFAULT 'main';

-- ── 7. Kolom budget VO di project_details (Modul 4) ─────────
ALTER TABLE project_details
  ADD COLUMN IF NOT EXISTS op_budget_vo NUMERIC DEFAULT 0;
