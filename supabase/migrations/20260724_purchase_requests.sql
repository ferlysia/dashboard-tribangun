-- ============================================================
--  PURCHASING REQUEST (PR) SCHEMA
--  Replaces the manual Excel + WhatsApp screenshot PR process.
--
--  LIFECYCLE
--    DRAFT -> WAITING_PAYMENT -> PURCHASED -> COMPLETED
--    (any of the first three) -> REJECTED  [terminal, reason required]
--
--  SURAT JALAN (SJ) SUB-WORKFLOW
--    status -> COMPLETED (first time)   => sj_status = PENDING_SIGNED_SJ
--    sj_document_url set (first time)   => sj_status = BILLING_READY
--  Enforced by fn_pr_lifecycle_interlock, mirroring the
--  fn_milestone_upload_interlock pattern in maintenance_assets_schema.sql.
-- ============================================================

-- ── TABLE 1: pr_number_counters ────────────────────────────────
-- One row per (month, year). fn_next_pr_no() atomically bumps last_seq.
CREATE TABLE IF NOT EXISTS public.pr_number_counters (
  period_month INTEGER NOT NULL,
  period_year  INTEGER NOT NULL,
  last_seq     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (period_month, period_year)
);


-- ── TABLE 2: purchase_requests ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_no               TEXT          NOT NULL UNIQUE,
  site_maintenance    TEXT          NOT NULL,
  unit                TEXT          NOT NULL,
  permintaan_tanggal  DATE          NOT NULL,
  status              TEXT          NOT NULL DEFAULT 'DRAFT'
                                     CHECK (status IN ('DRAFT', 'WAITING_PAYMENT', 'PURCHASED', 'COMPLETED', 'REJECTED')),
  rejection_reason    TEXT,
  -- Surat Jalan sub-workflow — only populated once status reaches COMPLETED
  sj_status           TEXT          CHECK (sj_status IN ('PENDING_SIGNED_SJ', 'BILLING_READY')),
  sj_document_url     TEXT,
  sj_uploaded_by      TEXT,
  sj_uploaded_at      TIMESTAMPTZ,
  requested_by        TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_pr_rejection_reason CHECK (status <> 'REJECTED' OR (rejection_reason IS NOT NULL AND rejection_reason <> ''))
);

COMMENT ON TABLE  public.purchase_requests               IS 'PR header. Replaces the manual Excel + WhatsApp screenshot process.';
COMMENT ON COLUMN public.purchase_requests.pr_no          IS 'Auto-generated via fn_next_pr_no(), format NNN/ROMAN/YYYY. Immutable once issued.';
COMMENT ON COLUMN public.purchase_requests.sj_status      IS 'Surat Jalan sub-state, only meaningful once status = COMPLETED. NULL until then.';


-- ── TABLE 3: purchase_request_items ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_request_items (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id   UUID        NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  line_no               INTEGER     NOT NULL,
  qty                   NUMERIC     NOT NULL CHECK (qty > 0),
  satuan                TEXT        NOT NULL,
  nama_barang           TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.purchase_request_items IS 'Line items for a PR. One row per requested item.';


-- ============================================================
--  INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_pr_status         ON public.purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_pr_sj_status      ON public.purchase_requests(sj_status);
CREATE INDEX IF NOT EXISTS idx_pr_items_pr_id    ON public.purchase_request_items(purchase_request_id);


-- ============================================================
--  FUNCTION: Sequential PR Number Generator
--  Format: NNN/ROMAN/YYYY, e.g. 001/VII/2026. Counter resets per
--  (month, year) of the PR's permintaan_tanggal.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_next_pr_no(p_date DATE)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_month INT := EXTRACT(MONTH FROM p_date);
  v_year  INT := EXTRACT(YEAR FROM p_date);
  v_seq   INT;
BEGIN
  INSERT INTO public.pr_number_counters (period_month, period_year, last_seq)
  VALUES (v_month, v_year, 1)
  ON CONFLICT (period_month, period_year)
    DO UPDATE SET last_seq = public.pr_number_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN lpad(v_seq::text, 3, '0') || '/' ||
         (ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[v_month] || '/' ||
         v_year::text;
END;
$$;

COMMENT ON FUNCTION public.fn_next_pr_no(DATE) IS
  'Atomically increments the per-(month,year) counter and returns the PR number as NNN/ROMAN/YYYY.';


-- ============================================================
--  UPDATED_AT TRIGGER
--  Reuses public.set_updated_at(), already defined in supabase/schema.sql.
-- ============================================================

DO $$ BEGIN
  CREATE TRIGGER trg_purchase_requests_updated_at
    BEFORE UPDATE ON public.purchase_requests
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
--  FUNCTION: PR Lifecycle Interlock
--  status -> COMPLETED (first time)   => sj_status = PENDING_SIGNED_SJ
--  sj_document_url set (first time)   => sj_status = BILLING_READY, sj_uploaded_at = NOW()
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_pr_lifecycle_interlock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED' THEN
    NEW.sj_status := 'PENDING_SIGNED_SJ';
  END IF;

  IF NEW.sj_document_url IS NOT NULL AND (OLD.sj_document_url IS NULL OR OLD.sj_document_url = '') THEN
    NEW.sj_status      := 'BILLING_READY';
    NEW.sj_uploaded_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_pr_lifecycle_interlock
    BEFORE UPDATE ON public.purchase_requests
    FOR EACH ROW EXECUTE FUNCTION public.fn_pr_lifecycle_interlock();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.pr_number_counters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_pr_counters_all"
  ON public.pr_number_counters FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_purchase_requests_all"
  ON public.purchase_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_pr_items_all"
  ON public.purchase_request_items FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_purchase_requests_read"
  ON public.purchase_requests FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth_pr_items_read"
  ON public.purchase_request_items FOR SELECT TO anon, authenticated USING (true);


-- ============================================================
--  SUPABASE STORAGE BUCKET (run once in the dashboard)
-- ============================================================
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('surat-jalan-docs', 'surat-jalan-docs', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- Storage path convention:
--   {purchase_request_id}/{timestamp}-{filename}
