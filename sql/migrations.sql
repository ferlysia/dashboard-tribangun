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

-- ── 16. Tabel termin_invoices (Finance Milestone Workspace) ───────────────────
--  Menyimpan status lifecycle invoice per termin per proyek.
--  status: 'TERKUNCI' | 'SIAP_TAGIH' | 'PROSES_COLLECT' | 'LUNAS'
--  SOW Bridge: status auto-naik ke SIAP_TAGIH saat physical_progress >= target_progres.
CREATE TABLE IF NOT EXISTS termin_invoices (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_key     TEXT        NOT NULL,
  termin_id       TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'TERKUNCI',
  amount_billed   NUMERIC,
  invoice_date    DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_key, termin_id)
);

CREATE INDEX IF NOT EXISTS idx_termin_invoices_project_key
  ON termin_invoices(project_key);

-- ── 17. Kolom pic_name di project_details (Doc Con Gallery Card PIC) ──────────
--  Nama penanggung jawab lapangan per proyek — ditampilkan di kartu galeri Doc Con.
ALTER TABLE project_details
  ADD COLUMN IF NOT EXISTS pic_name TEXT;

-- ── 18. Security auth columns di app_user_profiles ───────────────────────────
ALTER TABLE app_user_profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS totp_secret   TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled  BOOLEAN DEFAULT false;

-- ── 19. Fungsi cascade delete proyek (ADMIN-only, dipanggil via API) ──────────
--  Menghapus semua baris terkait project_key secara atomik dalam satu transaksi.
--  Urutan: child tables dulu → project_details terakhir (hindari orphaned rows).
--  SECURITY DEFINER: fungsi berjalan dengan hak pemilik (melewati RLS),
--  otorisasi ADMIN dilakukan di layer API sebelum RPC ini dipanggil.
CREATE OR REPLACE FUNCTION public.delete_project_cascade(p_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_escalations INTEGER := 0;
  r_costs       INTEGER := 0;
  r_logs        INTEGER := 0;
  r_schedule    INTEGER := 0;
  r_termins     INTEGER := 0;
  r_detail      INTEGER := 0;
BEGIN
  -- Child tables (no FK constraints but logically dependent)
  DELETE FROM project_escalations   WHERE project_key = p_key;
  GET DIAGNOSTICS r_escalations = ROW_COUNT;

  DELETE FROM project_costs          WHERE project_key = p_key;
  GET DIAGNOSTICS r_costs = ROW_COUNT;

  DELETE FROM project_weekly_logs    WHERE project_key = p_key;
  GET DIAGNOSTICS r_logs = ROW_COUNT;

  DELETE FROM project_schedule_items WHERE project_key = p_key;
  GET DIAGNOSTICS r_schedule = ROW_COUNT;

  DELETE FROM termin_invoices         WHERE project_key = p_key;
  GET DIAGNOSTICS r_termins = ROW_COUNT;

  -- Master record — deleted last
  DELETE FROM project_details         WHERE project_key = p_key;
  GET DIAGNOSTICS r_detail = ROW_COUNT;

  RETURN jsonb_build_object(
    'project_key',            p_key,
    'project_details',        r_detail,
    'project_costs',          r_costs,
    'project_weekly_logs',    r_logs,
    'project_schedule_items', r_schedule,
    'project_escalations',    r_escalations,
    'termin_invoices',        r_termins,
    'total_rows_deleted',     r_escalations + r_costs + r_logs + r_schedule + r_termins + r_detail
  );
END;
$$;

-- ── 20. Target selesai proyek (due_date) ─────────────────────────────────────
ALTER TABLE project_details
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- ── 21. Auto-bump project updated_at dari mutasi child tables ────────────────
--  Fungsi dan 3 trigger ini memastikan updated_at di project_details selalu
--  mencerminkan aktivitas terbaru lintas modul (costs, logs, schedule).
--  DB menangani ini secara otomatis — API routes tidak perlu diubah.

CREATE OR REPLACE FUNCTION public.bump_project_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE project_details
    SET updated_at = NOW()
    WHERE project_key = COALESCE(
      (CASE WHEN TG_OP = 'DELETE' THEN OLD.project_key ELSE NEW.project_key END),
      ''
    );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_costs_bump_project    ON project_costs;
CREATE TRIGGER trg_costs_bump_project
  AFTER INSERT OR UPDATE OR DELETE ON project_costs
  FOR EACH ROW EXECUTE FUNCTION public.bump_project_updated_at();

DROP TRIGGER IF EXISTS trg_logs_bump_project     ON project_weekly_logs;
CREATE TRIGGER trg_logs_bump_project
  AFTER INSERT OR UPDATE OR DELETE ON project_weekly_logs
  FOR EACH ROW EXECUTE FUNCTION public.bump_project_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_bump_project ON project_schedule_items;
CREATE TRIGGER trg_schedule_bump_project
  AFTER INSERT OR UPDATE OR DELETE ON project_schedule_items
  FOR EACH ROW EXECUTE FUNCTION public.bump_project_updated_at();
