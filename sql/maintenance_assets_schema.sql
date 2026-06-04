-- ============================================================
--  MAINTENANCE ASSETS SCHEMA
--  PAC Climaveneta HVAC — Asset Management & Maintenance Tracking
--  Jalankan di Supabase SQL Editor
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- TABLE 1: assets
-- Core registry of all physical PAC units.
-- serial_number = absolute unit identifier from our company.
-- ne_id         = Telkomsel composite identifier (site+floor+type).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.assets (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number         TEXT          NOT NULL UNIQUE,
  ne_id                 TEXT          NOT NULL UNIQUE,
  site_id               TEXT          NOT NULL,
  site_name             TEXT          NOT NULL,
  floor                 TEXT          NOT NULL,
  type_pac              TEXT          NOT NULL,
  brand                 TEXT          NOT NULL DEFAULT 'Climaveneta',
  model                 TEXT,
  capacity_kw           NUMERIC(10,2),
  customer_name         TEXT          NOT NULL,
  installation_date     DATE,
  warranty_expiry_date  DATE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.assets                      IS 'Physical PAC unit registry. One row per installed unit.';
COMMENT ON COLUMN public.assets.serial_number        IS 'Absolute unique hardware identifier stamped on the unit by our company.';
COMMENT ON COLUMN public.assets.ne_id                IS 'Telkomsel composite NE ID, e.g. TNG337/L02/CLM/052/03.';
COMMENT ON COLUMN public.assets.warranty_expiry_date IS 'Manufacturer warranty expiry. Critical for ATP report-backed warranty claims.';


-- ────────────────────────────────────────────────────────────
-- TABLE 2: maintenance_contracts
-- PO-driven, fully flexible contracts.
-- One asset can have multiple contracts over its lifetime
-- (previous contract completed → new PO → new contract row).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.maintenance_contracts (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id              UUID          NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  po_number             TEXT          NOT NULL,
  contract_start_date   DATE          NOT NULL,
  contract_end_date     DATE          NOT NULL,
  total_planned_visits  INTEGER       NOT NULL CHECK (total_planned_visits > 0),
  contract_value        NUMERIC(15,2),
  status                TEXT          NOT NULL DEFAULT 'ACTIVE'
                                      CHECK (status IN ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED')),
  created_by            TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_contract_dates CHECK (contract_end_date > contract_start_date)
);

COMMENT ON TABLE  public.maintenance_contracts                    IS 'PO-driven maintenance contracts. Duration and visit count are fully flexible per PO.';
COMMENT ON COLUMN public.maintenance_contracts.total_planned_visits IS 'Admin-defined visit count. Drives N-milestone generation in contract_milestones.';


-- ────────────────────────────────────────────────────────────
-- TABLE 3: contract_milestones
-- N dynamically-generated visit slots per contract.
-- Each slot maps to one PM visit.
-- Upload-triggered state interlock is handled by the trigger below.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contract_milestones (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id             UUID          NOT NULL REFERENCES public.maintenance_contracts(id) ON DELETE CASCADE,
  visit_number            INTEGER       NOT NULL CHECK (visit_number > 0),
  scheduled_date          DATE          NOT NULL,
  execution_date          DATE,
  status                  TEXT          NOT NULL DEFAULT 'PENDING'
                                        CHECK (status IN ('PENDING', 'DONE', 'OVERDUE')),
  pm_report_url           TEXT,
  pm_report_filename      TEXT,
  pm_report_size_bytes    INTEGER,
  pm_report_uploaded_at   TIMESTAMPTZ,
  uploaded_by             TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, visit_number)
);

COMMENT ON TABLE  public.contract_milestones                 IS 'One row per planned PM visit. N rows auto-generated when a contract is created.';
COMMENT ON COLUMN public.contract_milestones.pm_report_url   IS 'Supabase Storage path. Populating this field auto-triggers DONE status via trigger.';
COMMENT ON COLUMN public.contract_milestones.execution_date  IS 'Auto-stamped by trigger the moment pm_report_url is first set.';


-- ────────────────────────────────────────────────────────────
-- TABLE 4: asset_documents
-- Centralized document vault per asset:
--   ATP_REPORT      → factory acceptance / warranty claim docs
--   PM_LOG          → standard PM execution logs
--   INCIDENT_REPORT → emergency troubleshooting records
--   CONTRACT_COPY   → signed PO / contract scan
--   OTHER           → catch-all
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asset_documents (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id          UUID          NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  document_type     TEXT          NOT NULL
                                  CHECK (document_type IN (
                                    'ATP_REPORT', 'PM_LOG', 'INCIDENT_REPORT',
                                    'CONTRACT_COPY', 'OTHER'
                                  )),
  document_name     TEXT          NOT NULL,
  file_url          TEXT          NOT NULL,
  file_size_bytes   INTEGER,
  uploaded_by       TEXT          NOT NULL,
  uploaded_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  notes             TEXT
);

COMMENT ON TABLE  public.asset_documents              IS 'Foundational document vault per asset. ATP reports are critical for manufacturer warranty claims.';
COMMENT ON COLUMN public.asset_documents.document_type IS 'ATP_REPORT is the highest-priority type — required for manufacturer warranty claims during breakdowns.';


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_assets_serial_number       ON public.assets(serial_number);
CREATE INDEX IF NOT EXISTS idx_assets_ne_id               ON public.assets(ne_id);
CREATE INDEX IF NOT EXISTS idx_assets_site_id             ON public.assets(site_id);
CREATE INDEX IF NOT EXISTS idx_contracts_asset_id         ON public.maintenance_contracts(asset_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status           ON public.maintenance_contracts(status);
CREATE INDEX IF NOT EXISTS idx_milestones_contract_id     ON public.contract_milestones(contract_id);
-- Composite index for Function 4 (overdue detection query):
CREATE INDEX IF NOT EXISTS idx_milestones_overdue_scan    ON public.contract_milestones(status, scheduled_date)
  WHERE pm_report_url IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_asset_type       ON public.asset_documents(asset_id, document_type);


-- ============================================================
-- UPDATED_AT TRIGGERS
-- Reuse set_updated_at() if it already exists in your schema.
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
  CREATE TRIGGER trg_contracts_updated_at
    BEFORE UPDATE ON public.maintenance_contracts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_milestones_updated_at
    BEFORE UPDATE ON public.contract_milestones
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- FUNCTION 3: Upload-Triggered State Interlocking
-- When pm_report_url is SET   → status = DONE, execution_date = TODAY
-- When pm_report_url is UNSET → status = OVERDUE | PENDING, execution_date = NULL
-- This fires BEFORE UPDATE so the trigger logic is atomic with the row write.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_milestone_upload_interlock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.pm_report_url IS NOT NULL AND (OLD.pm_report_url IS NULL OR OLD.pm_report_url = '') THEN
    NEW.status         := 'DONE';
    NEW.execution_date := CURRENT_DATE;
  END IF;

  IF NEW.pm_report_url IS NULL AND OLD.pm_report_url IS NOT NULL THEN
    NEW.execution_date := NULL;
    IF NEW.scheduled_date < CURRENT_DATE THEN
      NEW.status := 'OVERDUE';
    ELSE
      NEW.status := 'PENDING';
    END IF;
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
-- FUNCTION 4: Overdue Refresh (cron-compatible)
-- Schedule via pg_cron: SELECT cron.schedule('0 0 * * *', 'SELECT public.fn_refresh_overdue_milestones()');
-- Returns count of newly-flagged overdue milestones.
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
-- HELPER VIEW: assets_with_status
-- Joins asset → active contract → next pending milestone.
-- Used by the dashboard list query (single round-trip).
-- ============================================================

CREATE OR REPLACE VIEW public.assets_with_status AS
SELECT
  a.id,
  a.serial_number,
  a.ne_id,
  a.site_id,
  a.site_name,
  a.floor,
  a.type_pac,
  a.brand,
  a.model,
  a.capacity_kw,
  a.customer_name,
  a.installation_date,
  a.warranty_expiry_date,
  a.notes,
  c.id               AS contract_id,
  c.po_number,
  c.contract_start_date,
  c.contract_end_date,
  c.total_planned_visits,
  c.status           AS contract_status,
  -- Overdue flag: true if any PENDING milestone for this asset is past due with no report
  EXISTS (
    SELECT 1 FROM public.contract_milestones m2
    WHERE  m2.contract_id = c.id
      AND  m2.status = 'OVERDUE'
  )                  AS has_overdue,
  -- Next scheduled visit
  (SELECT m.scheduled_date FROM public.contract_milestones m
   WHERE  m.contract_id = c.id AND m.status = 'PENDING'
   ORDER  BY m.visit_number LIMIT 1) AS next_scheduled_date,
  -- Last completed visit
  (SELECT m.execution_date FROM public.contract_milestones m
   WHERE  m.contract_id = c.id AND m.status = 'DONE'
   ORDER  BY m.visit_number DESC LIMIT 1) AS last_execution_date,
  -- Visits done count
  (SELECT COUNT(*) FROM public.contract_milestones m
   WHERE  m.contract_id = c.id AND m.status = 'DONE') AS visits_done
FROM  public.assets a
LEFT  JOIN public.maintenance_contracts c
       ON  c.asset_id = a.id AND c.status = 'ACTIVE';


-- ============================================================
-- ROW LEVEL SECURITY
-- Pattern matches existing tables in this project.
-- ============================================================

ALTER TABLE public.assets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_contracts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_milestones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_documents        ENABLE ROW LEVEL SECURITY;

-- Service role: full access (used by all API routes via SUPABASE_SERVICE_ROLE_KEY)
CREATE POLICY "service_role_assets_all"
  ON public.assets FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_contracts_all"
  ON public.maintenance_contracts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_milestones_all"
  ON public.contract_milestones FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_documents_all"
  ON public.asset_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon: read-only
CREATE POLICY "anon_assets_read"
  ON public.assets FOR SELECT TO anon USING (true);

CREATE POLICY "anon_contracts_read"
  ON public.maintenance_contracts FOR SELECT TO anon USING (true);

CREATE POLICY "anon_milestones_read"
  ON public.contract_milestones FOR SELECT TO anon USING (true);

CREATE POLICY "anon_documents_read"
  ON public.asset_documents FOR SELECT TO anon USING (true);


-- ============================================================
-- SUPABASE STORAGE BUCKET
-- Run once in your Supabase dashboard or via management API.
-- Bucket is private; access through signed URLs via service role.
-- ============================================================
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('maintenance-docs', 'maintenance-docs', false)
-- ON CONFLICT (id) DO NOTHING;
--
-- Storage path convention:
--   pm-reports/{asset_id}/{contract_id}/visit-{N}.pdf
--   vault/{asset_id}/{document_type}/{filename}.pdf
