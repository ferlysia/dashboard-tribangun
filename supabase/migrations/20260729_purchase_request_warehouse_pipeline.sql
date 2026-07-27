-- ============================================================
--  PURCHASING REQUEST — WAREHOUSE 3-STEP PIPELINE & SEPARATION OF DUTIES
--  Run this AFTER 20260728_purchase_request_item_procurement_verification.sql.
--
--  Splits item lifecycle ownership cleanly by organizational responsibility:
--
--  1. procurement_status (Purchasing/Finance-owned, payment only):
--       AWAITING_PAYMENT -> PURCHASED
--     The 'RECEIVED' value added in 20260728 was a modeling mistake — physical
--     receipt verification is a Warehouse Operations responsibility, not
--     Purchasing's, and letting a "Diterima" checkbox live on the "Sudah
--     Dibayar" page violated separation of duties. Removed here.
--
--  2. warehouse_status (Warehouse Operations-owned, exclusively):
--       PENDING -> RECEIVED -> READY_FOR_DISPATCH -> DISPATCHED
--     Three real, sequential steps: (1) physical verification of goods
--     arriving at the central warehouse, (2) allocation into a dispatch
--     queue for a specific site, (3) selection into a batch Surat Jalan
--     upload (a PR's items routinely go out across multiple separate SJs
--     over time — already supported by purchase_request_surat_jalan).
--     DISPATCHED is only ever reachable via the surat-jalan upload route,
--     never a direct manual toggle — see lib/purchase-request/status-rules.ts.
--
--  The old `received` boolean + `received_at` timestamp are dropped — fully
--  superseded by warehouse_status='DISPATCHED' (single source of truth,
--  no redundant flag that could desync from the enum). Renamed to
--  `dispatched_at` for clarity.
-- ============================================================

-- ── 1. New warehouse_status column ────────────────────────────
ALTER TABLE public.purchase_request_items
  ADD COLUMN IF NOT EXISTS warehouse_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (warehouse_status IN ('PENDING', 'RECEIVED', 'READY_FOR_DISPATCH', 'DISPATCHED')),
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

COMMENT ON COLUMN public.purchase_request_items.warehouse_status IS
  'Warehouse Operations'' own 3-step pipeline: PENDING (not yet physically verified) -> RECEIVED (Step 1 done) -> READY_FOR_DISPATCH (Step 2, queued for site shipment) -> DISPATCHED (Step 3, linked to an uploaded Surat Jalan). Exclusively Warehouse-owned — Purchasing/Finance UI never writes this column. Only meaningful once the item has left Purchasing''s stage (see hasEnteredWarehousePipeline in status-rules.ts).';
COMMENT ON COLUMN public.purchase_request_items.dispatched_at IS
  'Timestamp the item reached warehouse_status=DISPATCHED (linked to a Surat Jalan). NULL until then.';


-- ── 2. Backfill from the columns being retired ────────────────
-- Order matters: this must run before the old columns are dropped.
UPDATE public.purchase_request_items SET
  warehouse_status = CASE
    WHEN received = TRUE THEN 'DISPATCHED'
    -- Best-effort reinterpretation of legacy test data: the old
    -- procurement_status='RECEIVED' meant "Purchasing believes the vendor
    -- shipped it," not a strict equivalent of Warehouse's own physical
    -- verification step. Mapping it to Step 1 (RECEIVED) here is a
    -- one-time, pragmatic carry-forward of whatever progress existed —
    -- not a claim that the two concepts were ever semantically identical.
    WHEN procurement_status = 'RECEIVED' THEN 'RECEIVED'
    ELSE 'PENDING'
  END,
  dispatched_at = CASE WHEN received = TRUE THEN received_at ELSE NULL END;

-- Downgrade any lingering procurement_status='RECEIVED' back to PURCHASED
-- before narrowing the CHECK constraint below.
UPDATE public.purchase_request_items
SET procurement_status = 'PURCHASED'
WHERE procurement_status = 'RECEIVED';


-- ── 3. Narrow procurement_status back to payment-only values ──
ALTER TABLE public.purchase_request_items
  DROP CONSTRAINT IF EXISTS purchase_request_items_procurement_status_check;
ALTER TABLE public.purchase_request_items
  ADD CONSTRAINT purchase_request_items_procurement_status_check
    CHECK (procurement_status IN ('AWAITING_PAYMENT', 'PURCHASED'));

COMMENT ON COLUMN public.purchase_request_items.procurement_status IS
  'BELI_BARU-only, Purchasing/Finance-owned payment progress: AWAITING_PAYMENT -> PURCHASED (PO placed). Irrelevant for STOK_INTERNAL. Does NOT track physical receipt — see warehouse_status for that, exclusively Warehouse-owned.';


-- ── 4. Drop the superseded boolean/timestamp ──────────────────
ALTER TABLE public.purchase_request_items
  DROP COLUMN IF EXISTS received,
  DROP COLUMN IF EXISTS received_at;


-- ── 5. Index for the new column ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pr_items_warehouse_status
  ON public.purchase_request_items(warehouse_status);

-- No RLS changes needed — existing table-level policies (USING (true) for
-- service_role, read-only for anon/authenticated) already cover all columns.
