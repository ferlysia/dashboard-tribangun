-- ============================================================
--  MAINTENANCE ASSETS SCHEMA  v2
--  PAC Climaveneta HVAC — Asset Management & Maintenance Tracking
--  Telkom Infra (TTC TBS · TTC BSD · TTC BUARA · TSO · TTC MERUYA)
--
--  BREAKING CHANGES FROM v1
--    • maintenance_contracts (asset-scoped) → REMOVED
--    • Replaced by site_contracts (site-scoped PO)
--    • contract_milestones keyed (site_contract_id, asset_id, visit_number)
--    • assets: removed capacity_kw, brand, model, customer_name,
--              installation_date, warranty_expiry_date
--    • assets: added room, maintenance_date, operational_status
--
--  WORKFLOW
--    1. Admin imports 8-column Excel → INSERT INTO assets
--    2. Admin creates site_contracts row for a site
--    3. Admin calls fn_generate_site_milestones(site_contract_id)
--       → bulk-inserts N × asset_count milestone rows
--    4. Technician uploads PM report PDF
--       → trg_milestone_upload_interlock: status=DONE, execution_date=TODAY
--    5. pg_cron calls fn_refresh_overdue_milestones() nightly
--       → PENDING rows past scheduled_date flip to OVERDUE
-- ============================================================

-- ── Migration: full wipe of v1 objects ───────────────────────
-- DROP TABLE CASCADE handles all FK-dependent child tables.
DROP TABLE    IF EXISTS public.asset_documents       CASCADE;
DROP TABLE    IF EXISTS public.contract_milestones   CASCADE;
DROP TABLE    IF EXISTS public.site_contracts        CASCADE;
DROP TABLE    IF EXISTS public.maintenance_contracts CASCADE;
DROP TABLE    IF EXISTS public.assets                CASCADE;
DROP VIEW     IF EXISTS public.assets_with_status;
DROP FUNCTION IF EXISTS public.fn_milestone_upload_interlock CASCADE;
DROP FUNCTION IF EXISTS public.fn_refresh_overdue_milestones CASCADE;
DROP FUNCTION IF EXISTS public.fn_generate_site_milestones   CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at                CASCADE;


-- ── TABLE 1: assets ──────────────────────────────────────────
-- Static baseline registry — 8 attributes from Excel import spec.
CREATE TABLE IF NOT EXISTS public.assets (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ne_id               TEXT          NOT NULL UNIQUE,
  serial_number       TEXT          NOT NULL UNIQUE,
  maintenance_date    DATE          NOT NULL,
  room                TEXT          NOT NULL,
  site_name           TEXT          NOT NULL,
  floor               TEXT          NOT NULL,
  type_pac            TEXT          NOT NULL,
  operational_status  TEXT          NOT NULL DEFAULT 'RUNNING'
                                    CHECK (operational_status IN ('RUNNING', 'STANDBY', 'OFF')),
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.assets                    IS 'Physical PAC unit registry. Populated from 8-column Excel import. One row per installed unit.';
COMMENT ON COLUMN public.assets.ne_id              IS 'Telkom composite NE ID, e.g. BSD101/L02/CLM/001/01.';
COMMENT ON COLUMN public.assets.serial_number      IS 'Absolute hardware identifier stamped on the unit. Primary key for manufacturer warranty claims.';
COMMENT ON COLUMN public.assets.maintenance_date   IS 'Baseline registry timestamp from Excel import. Static post-import.';
COMMENT ON COLUMN public.assets.room               IS 'Physical room location, e.g. MMR, Chiller Room, Server Room.';
COMMENT ON COLUMN public.assets.operational_status IS 'Initial state from import. Updated by field technicians during PM visits.';


-- ── TABLE 2: site_contracts ───────────────────────────────────
-- PO contracts scoped to a site boundary, NOT per-asset.
-- All assets whose site_name matches this row fall under it.
CREATE TABLE IF NOT EXISTS public.site_contracts (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name               TEXT          NOT NULL,
  po_number               TEXT          NOT NULL UNIQUE,
  contract_start_date     DATE          NOT NULL,
  contract_duration_years NUMERIC(4,2)  NOT NULL CHECK (contract_duration_years > 0),
  total_planned_visits    INTEGER       NOT NULL CHECK (total_planned_visits > 0),
  status                  TEXT          NOT NULL DEFAULT 'ACTIVE'
                                        CHECK (status IN ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED')),
  created_by              TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.site_contracts                          IS 'PO contracts scoped to a site. One row covers all assets at that site. Drives bulk milestone generation.';
COMMENT ON COLUMN public.site_contracts.contract_duration_years IS 'Decimal years (e.g. 2.5). Combined with total_planned_visits to derive evenly-spaced visit dates.';
COMMENT ON COLUMN public.site_contracts.total_planned_visits    IS 'N-visit plan. fn_generate_site_milestones() generates N × asset_count rows.';


-- ── TABLE 3: contract_milestones ──────────────────────────────
-- Intersection entity: (site_contract_id, asset_id, visit_number).
-- Bulk-generated by fn_generate_site_milestones().
CREATE TABLE IF NOT EXISTS public.contract_milestones (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  site_contract_id      UUID          NOT NULL REFERENCES public.site_contracts(id) ON DELETE CASCADE,
  asset_id              UUID          NOT NULL REFERENCES public.assets(id)         ON DELETE CASCADE,
  visit_number          INTEGER       NOT NULL CHECK (visit_number > 0),
  scheduled_date        DATE          NOT NULL,
  execution_date        DATE,
  status                TEXT          NOT NULL DEFAULT 'PENDING'
                                      CHECK (status IN ('PENDING', 'DONE', 'OVERDUE')),
  pm_report_url         TEXT,
  pm_report_filename    TEXT,
  pm_report_size_bytes  INTEGER,
  pm_report_uploaded_at TIMESTAMPTZ,
  uploaded_by           TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (site_contract_id, asset_id, visit_number)
);

COMMENT ON TABLE  public.contract_milestones               IS 'One row per (site_contract, asset, visit). Bulk-generated. Upload-interlocked via trigger.';
COMMENT ON COLUMN public.contract_milestones.pm_report_url IS 'Supabase Storage path. Setting this fires trg_milestone_upload_interlock → status=DONE.';
COMMENT ON COLUMN public.contract_milestones.execution_date IS 'Auto-stamped by trigger when pm_report_url is first set.';


-- ── TABLE 4: asset_documents ──────────────────────────────────
-- Centralised vault per asset. ATP_REPORT = manufacturer warranty claim doc.
CREATE TABLE IF NOT EXISTS public.asset_documents (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID          NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  document_type   TEXT          NOT NULL
                                CHECK (document_type IN (
                                  'ATP_REPORT', 'PM_LOG', 'INCIDENT_REPORT', 'CONTRACT_COPY', 'OTHER'
                                )),
  document_name   TEXT          NOT NULL,
  file_url        TEXT          NOT NULL,
  file_size_bytes INTEGER,
  uploaded_by     TEXT          NOT NULL,
  uploaded_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  notes           TEXT
);

COMMENT ON TABLE  public.asset_documents               IS 'Per-asset document vault. ATP_REPORT is critical for manufacturer warranty claims during site breakdowns.';
COMMENT ON COLUMN public.asset_documents.document_type IS 'ATP_REPORT = factory acceptance doc. Highest retrieval priority in the field.';


-- ============================================================
--  INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_assets_serial_number    ON public.assets(serial_number);
CREATE INDEX IF NOT EXISTS idx_assets_ne_id            ON public.assets(ne_id);
CREATE INDEX IF NOT EXISTS idx_assets_site_name        ON public.assets(site_name);
CREATE INDEX IF NOT EXISTS idx_site_contracts_site     ON public.site_contracts(site_name);
CREATE INDEX IF NOT EXISTS idx_site_contracts_status   ON public.site_contracts(status);
CREATE INDEX IF NOT EXISTS idx_milestones_asset_id     ON public.contract_milestones(asset_id);
CREATE INDEX IF NOT EXISTS idx_milestones_contract_id  ON public.contract_milestones(site_contract_id);
-- Composite for Function 4 nightly overdue scan:
CREATE INDEX IF NOT EXISTS idx_milestones_overdue_scan ON public.contract_milestones(status, scheduled_date)
  WHERE pm_report_url IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_asset_type    ON public.asset_documents(asset_id, document_type);


-- ============================================================
--  UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_assets_updated_at
    BEFORE UPDATE ON public.assets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_site_contracts_updated_at
    BEFORE UPDATE ON public.site_contracts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_milestones_updated_at
    BEFORE UPDATE ON public.contract_milestones
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
--  FUNCTION 3: Upload-Triggered State Interlock
--  SET   pm_report_url → status=DONE, execution_date=TODAY
--  UNSET pm_report_url → status=OVERDUE|PENDING, execution_date=NULL
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_milestone_upload_interlock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.pm_report_url IS NOT NULL AND (OLD.pm_report_url IS NULL OR OLD.pm_report_url = '') THEN
    NEW.status                := 'DONE';
    NEW.execution_date        := CURRENT_DATE;
    NEW.pm_report_uploaded_at := NOW();
  END IF;

  IF NEW.pm_report_url IS NULL AND OLD.pm_report_url IS NOT NULL THEN
    NEW.execution_date        := NULL;
    NEW.pm_report_uploaded_at := NULL;
    NEW.status := CASE WHEN NEW.scheduled_date < CURRENT_DATE THEN 'OVERDUE' ELSE 'PENDING' END;
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_milestone_upload_interlock
    BEFORE UPDATE ON public.contract_milestones
    FOR EACH ROW EXECUTE FUNCTION public.fn_milestone_upload_interlock();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
--  FUNCTION 4: Overdue Refresh (cron-compatible)
--  Schedule: SELECT cron.schedule('0 0 * * *', 'SELECT public.fn_refresh_overdue_milestones()');
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_refresh_overdue_milestones()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE public.contract_milestones
  SET    status = 'OVERDUE'
  WHERE  status = 'PENDING'
    AND  scheduled_date < CURRENT_DATE
    AND  pm_report_url IS NULL;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;


-- ============================================================
--  FUNCTION: Bulk Milestone Generation
--  Call after INSERT/UPDATE on site_contracts.
--  Generates total_planned_visits evenly-spaced rows per asset at site.
--  DONE/OVERDUE rows preserved — only PENDING slots regenerated.
--  Returns total rows inserted/updated.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_generate_site_milestones(p_site_contract_id UUID)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_sc              public.site_contracts%ROWTYPE;
  v_asset_id        UUID;
  v_months_interval NUMERIC;
  v_visit           INTEGER;
  v_sched_date      DATE;
  v_rows_affected   INTEGER := 0;
BEGIN
  SELECT * INTO v_sc FROM public.site_contracts WHERE id = p_site_contract_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'site_contracts row % not found', p_site_contract_id;
  END IF;

  v_months_interval := (v_sc.contract_duration_years * 12.0) / v_sc.total_planned_visits;

  DELETE FROM public.contract_milestones
  WHERE  site_contract_id = p_site_contract_id
    AND  status           = 'PENDING';

  FOR v_asset_id IN (
    SELECT id FROM public.assets WHERE site_name = v_sc.site_name
  ) LOOP
    FOR v_visit IN 1..v_sc.total_planned_visits LOOP
      v_sched_date := v_sc.contract_start_date
                      + (v_months_interval * v_visit || ' months')::INTERVAL;

      INSERT INTO public.contract_milestones
        (site_contract_id, asset_id, visit_number, scheduled_date)
      VALUES
        (p_site_contract_id, v_asset_id, v_visit, v_sched_date)
      ON CONFLICT (site_contract_id, asset_id, visit_number)
        DO UPDATE
          SET scheduled_date = EXCLUDED.scheduled_date,
              updated_at     = NOW()
        WHERE public.contract_milestones.status = 'PENDING';

      v_rows_affected := v_rows_affected + 1;
    END LOOP;
  END LOOP;

  RETURN v_rows_affected;
END;
$$;

COMMENT ON FUNCTION public.fn_generate_site_milestones(UUID) IS
  'Bulk-generates N evenly-spaced milestone rows for every asset at the site. '
  'Call after INSERT/UPDATE on site_contracts. '
  'DONE/OVERDUE milestones are preserved; PENDING slots are regenerated. '
  'Returns total rows inserted/updated.';


-- ============================================================
--  HELPER VIEW: assets_with_status
--  asset → active site_contract → milestone aggregates (single round-trip).
-- ============================================================

CREATE OR REPLACE VIEW public.assets_with_status AS
SELECT
  a.id,
  a.ne_id,
  a.serial_number,
  a.maintenance_date,
  a.room,
  a.site_name,
  a.floor,
  a.type_pac,
  a.operational_status,
  a.notes,
  sc.id                     AS site_contract_id,
  sc.po_number,
  sc.contract_start_date,
  sc.contract_duration_years,
  sc.total_planned_visits,
  sc.status                 AS contract_status,
  EXISTS (
    SELECT 1 FROM public.contract_milestones m
    WHERE  m.site_contract_id = sc.id
      AND  m.asset_id         = a.id
      AND  m.status           = 'OVERDUE'
  )                         AS has_overdue,
  (SELECT m.scheduled_date
   FROM   public.contract_milestones m
   WHERE  m.site_contract_id = sc.id AND m.asset_id = a.id AND m.status = 'PENDING'
   ORDER  BY m.visit_number LIMIT 1) AS next_scheduled_date,
  (SELECT m.execution_date
   FROM   public.contract_milestones m
   WHERE  m.site_contract_id = sc.id AND m.asset_id = a.id AND m.status = 'DONE'
   ORDER  BY m.visit_number DESC LIMIT 1) AS last_execution_date,
  (SELECT COUNT(*)
   FROM   public.contract_milestones m
   WHERE  m.site_contract_id = sc.id AND m.asset_id = a.id AND m.status = 'DONE'
  )                         AS visits_done
FROM  public.assets a
LEFT  JOIN public.site_contracts sc
       ON  sc.site_name = a.site_name AND sc.status = 'ACTIVE';


-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.assets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_contracts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_documents     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_assets_all"
  ON public.assets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_site_contracts_all"
  ON public.site_contracts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_milestones_all"
  ON public.contract_milestones FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_documents_all"
  ON public.asset_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anon_assets_read"
  ON public.assets FOR SELECT TO anon USING (true);
CREATE POLICY "anon_site_contracts_read"
  ON public.site_contracts FOR SELECT TO anon USING (true);
CREATE POLICY "anon_milestones_read"
  ON public.contract_milestones FOR SELECT TO anon USING (true);
CREATE POLICY "anon_documents_read"
  ON public.asset_documents FOR SELECT TO anon USING (true);


-- ============================================================
--  SUPABASE STORAGE BUCKET (run once in dashboard)
-- ============================================================
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('maintenance-docs', 'maintenance-docs', false)
-- ON CONFLICT (id) DO NOTHING;
--
-- Storage path convention:
--   pm-reports/{site_contract_id}/{asset_id}/visit-{N}.pdf
--   vault/{asset_id}/{document_type}/{filename}.pdf
