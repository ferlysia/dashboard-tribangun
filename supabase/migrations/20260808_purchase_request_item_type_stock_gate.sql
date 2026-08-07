-- ============================================================
--  PURCHASING REQUEST — WAREHOUSE STOCK-CHECK HANDOVER GATE
--  Run this AFTER 20260730_purchase_request_item_split.sql.
--
--  Material items must be stock-validated by Warehouse before Purchasing
--  ever sees them; non-material items (e.g. safety gear) bypass Warehouse
--  entirely. item_type drives which initial fulfillment_source a new item
--  gets (via trigger, since it depends on another column so a static
--  DEFAULT can't express it): MATERIAL -> PENDING_STOCK_CHECK (Warehouse's
--  queue), NON_MATERIAL -> BELI_BARU (Purchasing's queue immediately).
--
--  PENDING_STOCK_CHECK is a one-way gate: Warehouse's handover action moves
--  it to BELI_BARU (no stock, hand off to Purchasing) or STOK_INTERNAL
--  (stock found, item never reaches Purchasing) — enforced in
--  app/api/purchase-requests/[id]/items/[itemId]/route.ts, not the DB,
--  matching how the existing warehouse_status one-way DISPATCHED gate
--  is enforced in the same file rather than via a DB trigger.
-- ============================================================

ALTER TABLE public.purchase_request_items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'MATERIAL'
    CHECK (item_type IN ('MATERIAL', 'NON_MATERIAL'));

ALTER TABLE public.purchase_request_items
  ALTER COLUMN fulfillment_source DROP DEFAULT;

ALTER TABLE public.purchase_request_items
  DROP CONSTRAINT IF EXISTS purchase_request_items_fulfillment_source_check;
ALTER TABLE public.purchase_request_items
  ADD CONSTRAINT purchase_request_items_fulfillment_source_check
    CHECK (fulfillment_source IN ('PENDING_STOCK_CHECK', 'BELI_BARU', 'STOK_INTERNAL'));

-- Guard: NON_MATERIAL must never sit in the Warehouse stock-check queue.
ALTER TABLE public.purchase_request_items
  DROP CONSTRAINT IF EXISTS chk_non_material_never_pending_stock_check;
ALTER TABLE public.purchase_request_items
  ADD CONSTRAINT chk_non_material_never_pending_stock_check
    CHECK (NOT (item_type = 'NON_MATERIAL' AND fulfillment_source = 'PENDING_STOCK_CHECK'));

CREATE OR REPLACE FUNCTION public.fn_set_initial_fulfillment_source()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fulfillment_source IS NULL THEN
    NEW.fulfillment_source := CASE WHEN NEW.item_type = 'MATERIAL' THEN 'PENDING_STOCK_CHECK' ELSE 'BELI_BARU' END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_initial_fulfillment_source ON public.purchase_request_items;
CREATE TRIGGER trg_set_initial_fulfillment_source
  BEFORE INSERT ON public.purchase_request_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_initial_fulfillment_source();

CREATE INDEX IF NOT EXISTS idx_pr_items_item_type_fulfillment
  ON public.purchase_request_items(item_type, fulfillment_source);

COMMENT ON COLUMN public.purchase_request_items.item_type IS
  'MATERIAL = requires Warehouse stock validation before Purchasing sees it (fulfillment_source starts PENDING_STOCK_CHECK). NON_MATERIAL = bypasses Warehouse entirely (fulfillment_source starts BELI_BARU).';
COMMENT ON COLUMN public.purchase_request_items.fulfillment_source IS
  'PENDING_STOCK_CHECK = MATERIAL item awaiting Warehouse stock validation, not yet visible to Purchasing. BELI_BARU = sourced via vendor purchase (needs po_number, optional). STOK_INTERNAL = pulled from existing stock (no PO, always warehouse-ready). One-way: PENDING_STOCK_CHECK can only move to BELI_BARU or STOK_INTERNAL, never back.';

-- purchase_requests.status: add the new earliest display-only aggregate stage.
ALTER TABLE public.purchase_requests
  DROP CONSTRAINT IF EXISTS purchase_requests_status_check;
ALTER TABLE public.purchase_requests
  ADD CONSTRAINT purchase_requests_status_check
    CHECK (status IN ('DRAFT','PENDING_STOCK_CHECK','WAITING_PAYMENT','PURCHASED','ARRIVED_AT_WAREHOUSE','COMPLETED','REJECTED'));
