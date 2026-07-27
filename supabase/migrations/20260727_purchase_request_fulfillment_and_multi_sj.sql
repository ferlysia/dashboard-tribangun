-- ============================================================
--  PURCHASING REQUEST — PER-ITEM FULFILLMENT & MULTI SURAT JALAN
--  Run this AFTER the other 20260724_purchase_request*.sql files.
--
--  1. Per-item fulfillment source (Beli Baru vs Stok Internal) + PO number.
--     - STOK_INTERNAL items never carry a po_number (enforced by CHECK).
--     - If EVERY item on a PR is STOK_INTERNAL, the app layer allows the PR
--       to skip WAITING_PAYMENT entirely (DRAFT -> PURCHASED directly).
--       See lib/purchase-request/status-rules.ts.
--
--  2. Multiple Surat Jalan per PR (partial deliveries). A PR can now receive
--     several SJ documents over time, each covering a subset of items.
--     purchase_request_items.surat_jalan_id links each item to the single SJ
--     that delivered it (an item is received exactly once, so no join table
--     is needed). Completion (status -> COMPLETED) is no longer a DB-trigger
--     side effect of a scalar sj_document_url column — it is driven by
--     application code in the surat-jalan upload route once every item on
--     the PR is received.
--
--  The old scalar sj_document_url/sj_uploaded_by/sj_uploaded_at columns are
--  renamed (not dropped) to legacy_* and backfilled into the new table so
--  historical COMPLETED PRs aren't orphaned. Nothing outside this feature
--  reads them (confirmed via repo-wide search).
-- ============================================================

-- ── 1. Per-item fulfillment source + PO number ──────────────────
ALTER TABLE public.purchase_request_items
  ADD COLUMN IF NOT EXISTS fulfillment_source TEXT NOT NULL DEFAULT 'BELI_BARU'
    CHECK (fulfillment_source IN ('BELI_BARU', 'STOK_INTERNAL')),
  ADD COLUMN IF NOT EXISTS po_number TEXT;

ALTER TABLE public.purchase_request_items
  DROP CONSTRAINT IF EXISTS chk_pr_item_stok_internal_no_po;
ALTER TABLE public.purchase_request_items
  ADD CONSTRAINT chk_pr_item_stok_internal_no_po
    CHECK (fulfillment_source <> 'STOK_INTERNAL' OR po_number IS NULL);

COMMENT ON COLUMN public.purchase_request_items.fulfillment_source IS
  'BELI_BARU = sourced via vendor purchase (needs po_number). STOK_INTERNAL = pulled from existing stock (no PO, bypasses payment wait if the whole PR is internal).';
COMMENT ON COLUMN public.purchase_request_items.po_number IS
  'Purchase order number for BELI_BARU items. Always NULL for STOK_INTERNAL items.';


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


-- ── 3. Rename the old scalar SJ columns (non-destructive) ────────
ALTER TABLE public.purchase_requests RENAME COLUMN sj_document_url TO legacy_sj_document_url;
ALTER TABLE public.purchase_requests RENAME COLUMN sj_uploaded_by  TO legacy_sj_uploaded_by;
ALTER TABLE public.purchase_requests RENAME COLUMN sj_uploaded_at  TO legacy_sj_uploaded_at;

COMMENT ON COLUMN public.purchase_requests.legacy_sj_document_url IS
  'Deprecated. Pre-multi-SJ-refactor single document URL, kept for historical backfill only. New code reads purchase_request_surat_jalan instead.';


-- ── 4. Backfill historical single-SJ data into the new table ─────
-- Under the OLD trigger, legacy_sj_document_url could only ever be set in
-- the same instant status flipped to COMPLETED, which itself required every
-- item to already be received. So every PR with a non-null legacy URL is,
-- by construction, COMPLETED with 100% of its items received.
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
ALTER TABLE public.purchase_request_surat_jalan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_pr_surat_jalan_all"
  ON public.purchase_request_surat_jalan FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "auth_pr_surat_jalan_read"
  ON public.purchase_request_surat_jalan FOR SELECT TO anon, authenticated USING (true);
