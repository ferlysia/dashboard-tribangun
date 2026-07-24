-- ============================================================
--  PURCHASING REQUEST — ARRIVED_AT_WAREHOUSE STAGE
--  Run this AFTER 20260724_purchase_requests.sql.
--
--  Inserts an explicit "Sampai di Gudang" stage between PURCHASED
--  and COMPLETED, and re-targets the SJ interlock:
--
--    DRAFT -> WAITING_PAYMENT -> PURCHASED -> ARRIVED_AT_WAREHOUSE -> COMPLETED
--    (any of the first four) -> REJECTED  [terminal, reason required]
--
--  SURAT JALAN (SJ) SUB-WORKFLOW (re-targeted)
--    status -> ARRIVED_AT_WAREHOUSE (first time) => sj_status = PENDING_SIGNED_SJ
--    sj_document_url set (first time)             => sj_status = BILLING_READY,
--                                                     status auto-advances to COMPLETED
--  i.e. uploading the signed Surat Jalan is what completes the PR —
--  COMPLETED *is* "Billing Ready".
-- ============================================================

-- ── 1. Widen the status CHECK to allow ARRIVED_AT_WAREHOUSE ─────
ALTER TABLE public.purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_status_check;
ALTER TABLE public.purchase_requests ADD CONSTRAINT purchase_requests_status_check
  CHECK (status IN ('DRAFT', 'WAITING_PAYMENT', 'PURCHASED', 'ARRIVED_AT_WAREHOUSE', 'COMPLETED', 'REJECTED'));


-- ── 2. Re-target the lifecycle interlock ─────────────────────────
CREATE OR REPLACE FUNCTION public.fn_pr_lifecycle_interlock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'ARRIVED_AT_WAREHOUSE' AND OLD.status IS DISTINCT FROM 'ARRIVED_AT_WAREHOUSE' THEN
    NEW.sj_status := 'PENDING_SIGNED_SJ';
  END IF;

  IF NEW.sj_document_url IS NOT NULL AND (OLD.sj_document_url IS NULL OR OLD.sj_document_url = '') THEN
    NEW.sj_status      := 'BILLING_READY';
    NEW.sj_uploaded_at := NOW();
    NEW.status         := 'COMPLETED';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists (trg_pr_lifecycle_interlock) and points at this
-- function by name, so CREATE OR REPLACE above is enough — no re-wiring needed.
