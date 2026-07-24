-- ============================================================
--  PURCHASING REQUEST — GRANULAR ITEM RECEIVING
--  Run this AFTER 20260724_purchase_requests_arrived_at_warehouse.sql.
--
--  Deliveries often arrive in partial shipments. Adds per-item
--  receiving state so warehouse staff can check off individual
--  items as they physically arrive while a PR is in the
--  ARRIVED_AT_WAREHOUSE stage, instead of an all-or-nothing flag.
--  Enforced in the API layer:
--    - items can only be toggled while the PR is ARRIVED_AT_WAREHOUSE
--    - Surat Jalan upload is blocked until every item is received
-- ============================================================

ALTER TABLE public.purchase_request_items
  ADD COLUMN IF NOT EXISTS received    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

COMMENT ON COLUMN public.purchase_request_items.received IS
  'Per-item warehouse receiving checkbox. All items must be true before a signed Surat Jalan can be uploaded for the parent PR.';
