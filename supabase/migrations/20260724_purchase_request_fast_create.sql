-- ============================================================
--  PURCHASING REQUEST — FASTER "Buat PR" SUBMISSION
--  Run this AFTER the other 20260724_purchase_request*.sql files.
--
--  The create flow previously took 2 sequential round trips just for
--  the header (RPC fn_next_pr_no, then INSERT purchase_requests) before
--  the items could even be inserted. This combines both into a single
--  RPC call, cutting one full network round trip off "Buat PR".
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_create_purchase_request(
  p_site_maintenance   TEXT,
  p_unit               TEXT,
  p_permintaan_tanggal DATE,
  p_requested_by       TEXT DEFAULT NULL,
  p_notes              TEXT DEFAULT NULL
)
RETURNS public.purchase_requests LANGUAGE plpgsql AS $$
DECLARE
  v_row public.purchase_requests;
BEGIN
  INSERT INTO public.purchase_requests
    (pr_no, site_maintenance, unit, permintaan_tanggal, requested_by, notes)
  VALUES
    (public.fn_next_pr_no(p_permintaan_tanggal), p_site_maintenance, p_unit, p_permintaan_tanggal, p_requested_by, p_notes)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.fn_create_purchase_request(TEXT, TEXT, DATE, TEXT, TEXT) IS
  'Generates the next PR number and inserts the purchase_requests header row in one round trip. Returns the created row.';
