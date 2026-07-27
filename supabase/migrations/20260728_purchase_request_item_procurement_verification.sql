-- ============================================================
--  PURCHASING REQUEST — PROCUREMENT-SIDE RECEIPT VERIFICATION
--  Run this AFTER 20260727_purchase_request_fulfillment_and_multi_sj.sql.
--
--  Adds a third procurement_status value, RECEIVED, sitting between
--  PURCHASED (PO placed, vendor shipment in transit) and the existing
--  warehouse-side `received` boolean (physically checked in against an
--  uploaded Surat Jalan). This is a distinct checkpoint: Purchasing
--  verifying "the vendor delivered this to us" BEFORE the item is ever
--  handed off to the Warehouse pipeline for SJ-based check-in.
--
--  Item procurement lifecycle (BELI_BARU items only — STOK_INTERNAL is
--  always implicitly warehouse-ready, see lib/purchase-request/status-rules.ts):
--    AWAITING_PAYMENT -> PURCHASED (PO entered, "Tandai Dibeli")
--                      -> RECEIVED  (Purchasing verifies vendor delivery,
--                                    "Diterima" checklist toggle)
--  Only once procurement_status = RECEIVED (or the item is STOK_INTERNAL)
--  does it become eligible for the Warehouse (SJ) pipeline / checkbox
--  batch-upload flow — see isWarehouseReady().
-- ============================================================

ALTER TABLE public.purchase_request_items
  DROP CONSTRAINT IF EXISTS purchase_request_items_procurement_status_check;
ALTER TABLE public.purchase_request_items
  ADD CONSTRAINT purchase_request_items_procurement_status_check
    CHECK (procurement_status IN ('AWAITING_PAYMENT', 'PURCHASED', 'RECEIVED'));

COMMENT ON COLUMN public.purchase_request_items.procurement_status IS
  'BELI_BARU-only progress marker: AWAITING_PAYMENT -> PURCHASED (PO placed) -> RECEIVED (Purchasing verified vendor delivery). Irrelevant for STOK_INTERNAL (always implicitly warehouse-ready). Only RECEIVED (or STOK_INTERNAL) items are eligible for the Warehouse (SJ) pipeline — see lib/purchase-request/status-rules.ts.';
