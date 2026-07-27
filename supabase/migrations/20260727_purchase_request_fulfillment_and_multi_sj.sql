-- ============================================================
--  PURCHASING REQUEST — PER-ITEM FULFILLMENT & MULTI SURAT JALAN
--  Run this AFTER the other 20260724_purchase_request*.sql files.
--
--  1. Per-item fulfillment source (Beli Baru vs Stok Internal), PO number,
--     and procurement_status. The ITEM is the unit of procurement progress,
--     not the PR: purchase_requests.status is a derived, display-only
--     aggregate (see deriveOverallStatus in lib/purchase-request/status-rules.ts)
--     computed server-side after every item mutation, except for the two
--     explicit manual states DRAFT and REJECTED. Warehouse checkoff
--     eligibility for an item is fully decoupled from the parent PR's
--     status — a STOK_INTERNAL item (or a BELI_BARU item already marked
--     PURCHASED) is receivable immediately even while sibling BELI_BARU
--     items on the same PR are still AWAITING_PAYMENT.
--
--  2. Multiple Surat Jalan per PR (partial deliveries). A PR can now receive
--     several SJ documents over time, each covering a subset of items.
--     purchase_request_items.surat_jalan_id links each item to the single SJ
--     that delivered it (an item is received exactly once, so no join table
--     is needed). Completion (status -> COMPLETED) is no longer a DB-trigger
--     side effect of a scalar sj_document_url column — it is driven by
--     application code (status-rules.ts's deriveOverallStatus, called from
--     the surat-jalan and per-item routes) once every item on the PR is
--     received.
--
--  The old scalar sj_document_url/sj_uploaded_by/sj_uploaded_at columns are
--  renamed (not dropped) to legacy_* and backfilled into the new table so
--  historical COMPLETED PRs aren't orphaned. Nothing outside this feature
--  reads them (confirmed via repo-wide search).
--
--  3. (Unrelated concern, bundled into this same not-yet-deployed migration
--     to avoid a confusing 2-file trail — see the bottom of this file.)
--     fn_next_pr_no is rewritten to compute the next sequence number from
--     actual current purchase_requests rows instead of a one-way counter
--     table, so deleting a PR frees its number back up for reuse.
-- ============================================================

-- ── 1. Per-item fulfillment source + PO number + procurement progress ──
ALTER TABLE public.purchase_request_items
  ADD COLUMN IF NOT EXISTS fulfillment_source TEXT NOT NULL DEFAULT 'BELI_BARU'
    CHECK (fulfillment_source IN ('BELI_BARU', 'STOK_INTERNAL')),
  ADD COLUMN IF NOT EXISTS po_number TEXT,
  ADD COLUMN IF NOT EXISTS procurement_status TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT'
    CHECK (procurement_status IN ('AWAITING_PAYMENT', 'PURCHASED'));

ALTER TABLE public.purchase_request_items
  DROP CONSTRAINT IF EXISTS chk_pr_item_stok_internal_no_po;
ALTER TABLE public.purchase_request_items
  ADD CONSTRAINT chk_pr_item_stok_internal_no_po
    CHECK (fulfillment_source <> 'STOK_INTERNAL' OR po_number IS NULL);

COMMENT ON COLUMN public.purchase_request_items.fulfillment_source IS
  'BELI_BARU = sourced via vendor purchase (needs po_number). STOK_INTERNAL = pulled from existing stock (no PO, always warehouse-ready).';
COMMENT ON COLUMN public.purchase_request_items.po_number IS
  'Purchase order number for BELI_BARU items. Always NULL for STOK_INTERNAL items.';
COMMENT ON COLUMN public.purchase_request_items.procurement_status IS
  'BELI_BARU-only progress marker: AWAITING_PAYMENT until Purchasing marks it PURCHASED. Irrelevant for STOK_INTERNAL (always implicitly warehouse-ready). Drives per-item Warehouse checkoff eligibility independent of the parent PR''s (derived) status — see lib/purchase-request/status-rules.ts.';


-- ── 2. Multiple Surat Jalan documents per PR ─────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_request_surat_jalan (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id  UUID        NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  file_url             TEXT        NOT NULL,
  file_name            TEXT,
  uploaded_by          TEXT,
  uploaded_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.purchase_request_surat_jalan IS
  'One row per Surat Jalan upload event. A PR can have multiple rows for partial deliveries.';

CREATE INDEX IF NOT EXISTS idx_pr_surat_jalan_pr_id
  ON public.purchase_request_surat_jalan(purchase_request_id);

ALTER TABLE public.purchase_request_items
  ADD COLUMN IF NOT EXISTS surat_jalan_id UUID
    REFERENCES public.purchase_request_surat_jalan(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pr_items_surat_jalan_id
  ON public.purchase_request_items(surat_jalan_id);

COMMENT ON COLUMN public.purchase_request_items.surat_jalan_id IS
  'The Surat Jalan document that delivered this item, if received. An item is received exactly once.';


-- ── 3+4. Rename the old scalar SJ columns + backfill (non-destructive) ────
-- Guarded so this whole migration is safe to re-run: RENAME COLUMN has no
-- IF EXISTS form in Postgres, and a naive re-run of the backfill INSERT
-- would duplicate rows on a second pass. Both only execute the first time
-- (i.e. while sj_document_url still exists under its original name).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_requests' AND column_name = 'sj_document_url'
  ) THEN
    ALTER TABLE public.purchase_requests RENAME COLUMN sj_document_url TO legacy_sj_document_url;
    ALTER TABLE public.purchase_requests RENAME COLUMN sj_uploaded_by  TO legacy_sj_uploaded_by;
    ALTER TABLE public.purchase_requests RENAME COLUMN sj_uploaded_at  TO legacy_sj_uploaded_at;

    COMMENT ON COLUMN public.purchase_requests.legacy_sj_document_url IS
      'Deprecated. Pre-multi-SJ-refactor single document URL, kept for historical backfill only. New code reads purchase_request_surat_jalan instead.';

    -- Under the OLD trigger, legacy_sj_document_url could only ever be set
    -- in the same instant status flipped to COMPLETED, which itself
    -- required every item to already be received. So every PR with a
    -- non-null legacy URL is, by construction, COMPLETED with 100% of its
    -- items received.
    INSERT INTO public.purchase_request_surat_jalan
      (purchase_request_id, file_url, uploaded_by, uploaded_at, created_at)
    SELECT id, legacy_sj_document_url, legacy_sj_uploaded_by,
           COALESCE(legacy_sj_uploaded_at, updated_at), COALESCE(legacy_sj_uploaded_at, updated_at)
    FROM public.purchase_requests
    WHERE legacy_sj_document_url IS NOT NULL;

    UPDATE public.purchase_request_items pri
    SET surat_jalan_id = sj.id
    FROM public.purchase_request_surat_jalan sj
    WHERE sj.purchase_request_id = pri.purchase_request_id
      AND pri.received = TRUE
      AND pri.surat_jalan_id IS NULL;
  END IF;
END $$;


-- ── 5. Rewrite the lifecycle interlock ────────────────────────────
-- Completion is now application-driven (surat-jalan upload route checks
-- 100% receipt after each partial upload and patches status itself), so
-- this trigger only needs to handle entering ARRIVED_AT_WAREHOUSE.
CREATE OR REPLACE FUNCTION public.fn_pr_lifecycle_interlock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'ARRIVED_AT_WAREHOUSE' AND OLD.status IS DISTINCT FROM 'ARRIVED_AT_WAREHOUSE' THEN
    NEW.sj_status := 'PENDING_SIGNED_SJ';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists (trg_pr_lifecycle_interlock) and points at this
-- function by name, so CREATE OR REPLACE above is enough — no re-wiring needed.


-- ── 6. RLS for the new table ──────────────────────────────────────
-- CREATE POLICY has no IF NOT EXISTS form — drop-then-create keeps this
-- migration safe to re-run.
ALTER TABLE public.purchase_request_surat_jalan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_pr_surat_jalan_all" ON public.purchase_request_surat_jalan;
CREATE POLICY "service_role_pr_surat_jalan_all"
  ON public.purchase_request_surat_jalan FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_pr_surat_jalan_read" ON public.purchase_request_surat_jalan;
CREATE POLICY "auth_pr_surat_jalan_read"
  ON public.purchase_request_surat_jalan FOR SELECT TO anon, authenticated USING (true);


-- ============================================================
--  7. PR NUMBER GENERATOR — reclaim numbers freed by deletion
--
--  The original fn_next_pr_no (20260724_purchase_requests.sql) drew from a
--  persisted pr_number_counters(period_month, period_year, last_seq) table
--  that only ever increments — deleting a PR (e.g. during testing) left a
--  permanent gap since the counter never rewinds. Replaced with a version
--  that computes the next sequence number from the actual current
--  purchase_requests rows for that period, so a deleted PR's number is
--  immediately available again, while a still-existing REJECTED PR
--  correctly keeps holding its own number.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_next_pr_no(p_date DATE)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_month INT := EXTRACT(MONTH FROM p_date);
  v_year  INT := EXTRACT(YEAR FROM p_date);
  v_seq   INT;
BEGIN
  -- Serializes concurrent number generation for the same period so two
  -- simultaneous "Buat PR" submissions can't compute the same next number.
  -- Transaction-scoped, released automatically at commit/rollback.
  PERFORM pg_advisory_xact_lock(hashtext('pr_no:' || v_month || ':' || v_year));

  SELECT COALESCE(MAX((regexp_match(pr_no, '^(\d+)/'))[1]::INT), 0) + 1
  INTO v_seq
  FROM public.purchase_requests
  WHERE EXTRACT(MONTH FROM permintaan_tanggal) = v_month
    AND EXTRACT(YEAR  FROM permintaan_tanggal) = v_year;

  RETURN lpad(v_seq::text, 3, '0') || '/' ||
         (ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[v_month] || '/' ||
         v_year::text;
END;
$$;

COMMENT ON FUNCTION public.fn_next_pr_no(DATE) IS
  'Computes the next PR number (NNN/ROMAN/YYYY) from the current MAX existing sequence for that (month,year) — deleting the highest-numbered PR frees its number back up. Serialized via advisory lock to stay race-safe under concurrent creates.';

-- pr_number_counters is no longer read by anything (confirmed via repo-wide
-- search) — drop it along with its RLS policy rather than leave dead state.
DROP TABLE IF EXISTS public.pr_number_counters;
