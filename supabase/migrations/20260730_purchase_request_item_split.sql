-- ============================================================
--  PURCHASING REQUEST — ITEM QUANTITY SPLITTING
--  Run this AFTER 20260729_purchase_request_warehouse_pipeline.sql.
--
--  Operational reality: a requested qty N is often only partially available
--  in the internal warehouse (M units), with the remaining N-M requiring a
--  new PO. A purchase_request_items row was previously atomically 100%
--  STOK_INTERNAL or 100% BELI_BARU (fulfillment_source is single-valued).
--
--  Modeled as sibling-row splitting, not allocation sub-tables: the original
--  row is mutated down to the BELI_BARU remainder (keeps its id), and a new
--  STOK_INTERNAL row is inserted for the split-off qty, linked back via
--  parent_item_id. Every predicate in status-rules.ts (hasEnteredWarehouse-
--  Pipeline, canSelectForSJ, isDispatched, canMarkPurchased, deriveOverall-
--  Status) already operates per-item over the full items array, so a split
--  line is handled correctly with zero changes to that file.
-- ============================================================

-- ── 1. New self-referencing column ─────────────────────────────
ALTER TABLE public.purchase_request_items
  ADD COLUMN IF NOT EXISTS parent_item_id UUID REFERENCES public.purchase_request_items(id) ON DELETE CASCADE;

-- At most one child per parent (v1: a single binary split; a child row can
-- itself be split again later with no further schema change).
CREATE UNIQUE INDEX IF NOT EXISTS uq_pr_item_parent
  ON public.purchase_request_items(parent_item_id) WHERE parent_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pr_item_parent_lookup
  ON public.purchase_request_items(parent_item_id);

COMMENT ON COLUMN public.purchase_request_items.parent_item_id IS
  'Set on the STOK_INTERNAL child row created by fn_split_purchase_request_item. NULL for ordinary (unsplit) items and for the BELI_BARU remainder row, which keeps the original item id. Used only for display grouping/traceability — every status-rules.ts predicate treats split rows as ordinary independent items.';


-- ── 2. Split RPC ────────────────────────────────────────────────
-- Atomically: shrink the original row to the BELI_BARU remainder, insert a
-- new STOK_INTERNAL sibling for the split-off qty. Mirrors the
-- fn_create_purchase_request pattern (single RPC round trip, real
-- transactional atomicity via plpgsql).
CREATE OR REPLACE FUNCTION public.fn_split_purchase_request_item(
  p_item_id           UUID,
  p_stok_internal_qty NUMERIC
)
RETURNS SETOF public.purchase_request_items LANGUAGE plpgsql AS $$
DECLARE
  v_item public.purchase_request_items;
BEGIN
  SELECT * INTO v_item FROM public.purchase_request_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_item.parent_item_id IS NOT NULL THEN
    RAISE EXCEPTION 'Item ini adalah hasil split dan tidak dapat displit lagi' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.purchase_request_items WHERE parent_item_id = p_item_id) THEN
    RAISE EXCEPTION 'Item ini sudah pernah displit' USING ERRCODE = '22023';
  END IF;
  IF p_stok_internal_qty IS NULL OR p_stok_internal_qty <= 0 OR p_stok_internal_qty >= v_item.qty THEN
    RAISE EXCEPTION 'Qty stok internal harus lebih dari 0 dan kurang dari qty total' USING ERRCODE = '22023';
  END IF;

  UPDATE public.purchase_request_items SET
    qty                 = v_item.qty - p_stok_internal_qty,
    fulfillment_source  = 'BELI_BARU',
    po_number           = NULL,
    procurement_status  = 'AWAITING_PAYMENT'
  WHERE id = p_item_id;

  RETURN QUERY
    INSERT INTO public.purchase_request_items
      (purchase_request_id, line_no, qty, satuan, nama_barang, fulfillment_source, warehouse_status, parent_item_id)
    VALUES
      (v_item.purchase_request_id, v_item.line_no, p_stok_internal_qty, v_item.satuan, v_item.nama_barang, 'STOK_INTERNAL', 'PENDING', p_item_id)
    RETURNING *;

  RETURN QUERY SELECT * FROM public.purchase_request_items WHERE id = p_item_id;
END;
$$;

COMMENT ON FUNCTION public.fn_split_purchase_request_item(UUID, NUMERIC) IS
  'Splits a pre-pipeline item into a BELI_BARU remainder (mutated in place, keeps original id) and a new STOK_INTERNAL sibling row. Returns both rows. Guarded (via the unique index and explicit checks) against splitting an already-split-from or already-split-into row.';


-- ── 3. Unsplit RPC ──────────────────────────────────────────────
-- Reverse of the above, only while the STOK_INTERNAL child hasn't been
-- physically touched by Warehouse yet.
CREATE OR REPLACE FUNCTION public.fn_unsplit_purchase_request_item(
  p_child_item_id UUID
)
RETURNS public.purchase_request_items LANGUAGE plpgsql AS $$
DECLARE
  v_child  public.purchase_request_items;
  v_parent public.purchase_request_items;
BEGIN
  SELECT * INTO v_child FROM public.purchase_request_items WHERE id = p_child_item_id FOR UPDATE;
  IF NOT FOUND OR v_child.parent_item_id IS NULL THEN
    RAISE EXCEPTION 'Item bukan hasil split' USING ERRCODE = '22023';
  END IF;
  IF v_child.warehouse_status <> 'PENDING' THEN
    RAISE EXCEPTION 'Split tidak dapat dibatalkan setelah verifikasi gudang dimulai' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_parent FROM public.purchase_request_items WHERE id = v_child.parent_item_id FOR UPDATE;

  UPDATE public.purchase_request_items SET qty = qty + v_child.qty
  WHERE id = v_parent.id
  RETURNING * INTO v_parent;

  DELETE FROM public.purchase_request_items WHERE id = p_child_item_id;

  RETURN v_parent;
END;
$$;

COMMENT ON FUNCTION public.fn_unsplit_purchase_request_item(UUID) IS
  'Merges a STOK_INTERNAL split-child back into its BELI_BARU parent (qty restored, child row deleted). Only legal while the child is still warehouse_status=PENDING.';

-- No RLS changes needed — existing table-level policies (USING (true) for
-- service_role, read-only for anon/authenticated) already cover all columns
-- and the RPC functions run as the invoking role.
