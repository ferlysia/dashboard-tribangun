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

-- ── 6. Kolom po_number di project_details (Anchor ID) ───────
ALTER TABLE project_details
  ADD COLUMN IF NOT EXISTS po_number TEXT;

-- ── 7. Kolom cost_stream di project_costs (Modul 4) ─────────
--  'main' = PO Utama, 'vo' = Kerja Tambah / Variation Order
ALTER TABLE project_costs
  ADD COLUMN IF NOT EXISTS cost_stream TEXT NOT NULL DEFAULT 'main';

-- ── 8. Kolom budget VO di project_details (Modul 4) ─────────
ALTER TABLE project_details
  ADD COLUMN IF NOT EXISTS op_budget_vo NUMERIC DEFAULT 0;

-- ── 9. Kolom biaya operasional stream Kerja Tambah/VO ────────
ALTER TABLE project_details ADD COLUMN IF NOT EXISTS op_vo_gaji        NUMERIC DEFAULT 0;
ALTER TABLE project_details ADD COLUMN IF NOT EXISTS op_vo_material    NUMERIC DEFAULT 0;
ALTER TABLE project_details ADD COLUMN IF NOT EXISTS op_vo_transport   NUMERIC DEFAULT 0;
ALTER TABLE project_details ADD COLUMN IF NOT EXISTS op_vo_operasional NUMERIC DEFAULT 0;
ALTER TABLE project_details ADD COLUMN IF NOT EXISTS op_vo_sewa        NUMERIC DEFAULT 0;
ALTER TABLE project_details ADD COLUMN IF NOT EXISTS op_vo_lainnya     NUMERIC DEFAULT 0;

-- ── 10. Tabel project_escalations (VO Escalation Gate) ──────────────────────
--  Rekam jejak setiap kali biaya VO mendekati/melewati budget yang disetujui.
--  escalation_type: 'vo_budget_80pct' | 'vo_budget_exceeded'
CREATE TABLE IF NOT EXISTS project_escalations (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_key      TEXT        NOT NULL,
  escalation_type  TEXT        NOT NULL DEFAULT 'vo_budget_80pct',
  threshold_pct    NUMERIC     NOT NULL DEFAULT 80,
  triggered_at     TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_by  TEXT,
  acknowledged_at  TIMESTAMPTZ,
  notes            TEXT
);

CREATE INDEX IF NOT EXISTS idx_escalations_project_key
  ON project_escalations(project_key);

-- ── 11. Kolom vo_entries JSONB (Multi-VO PO per proyek) ──────────────────────
--  Menyimpan array data Kerja Tambah: [{id, po_number, description, nilai_po}]
--  op_budget_vo tetap diisi sebagai agregat (sum nilai_po) untuk backward compat.
ALTER TABLE project_details
  ADD COLUMN IF NOT EXISTS vo_entries JSONB DEFAULT '[]'::jsonb;

-- ── 12. Kolom termin_schedule JSONB (TOP milestone per proyek) ────────────────
--  Menyimpan jadwal milestone pembayaran:
--  [{id, nama, target_progres, persen_tagihan}]
--  target_progres = % fisik minimum sebelum termin bisa ditagihkan.
--  persen_tagihan = % dari total nilai kontrak yang ditagih di termin ini.
--  Validasi bisnis: sum(persen_tagihan) harus = 100%.
ALTER TABLE project_details
  ADD COLUMN IF NOT EXISTS termin_schedule JSONB DEFAULT '[]'::jsonb;

-- ── 13. Kolom progress_pct di project_weekly_logs ────────────────────────────
--  Snapshot progres fisik proyek saat log mingguan dibuat.
--  Memungkinkan setiap kartu log menampilkan progress yang berbeda per minggu.
ALTER TABLE project_weekly_logs
  ADD COLUMN IF NOT EXISTS progress_pct INTEGER DEFAULT 0;

-- ── 14. Kolom end_week di project_schedule_items ─────────────────────────────
--  Minggu selesai untuk bar Gantt multi-minggu.
--  Jika NULL, bar hanya menempati satu minggu (week_number).
ALTER TABLE project_schedule_items
  ADD COLUMN IF NOT EXISTS end_week INTEGER;

-- ── 15. Kolom phase_id di project_weekly_logs ─────────────────────────────────
--  FK ke project_schedule_items.id — menghubungkan log mingguan ke fase jadwal.
--  Memungkinkan auto-provisioning kartu log saat fase baru ditambahkan.
ALTER TABLE project_weekly_logs
  ADD COLUMN IF NOT EXISTS phase_id TEXT;

CREATE INDEX IF NOT EXISTS idx_weekly_logs_phase_id
  ON project_weekly_logs(phase_id);
