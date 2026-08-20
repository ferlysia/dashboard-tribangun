-- ============================================================
--  WEEKLY TOOL INSPECTION FORM
--
--  Digitizes the physical "PT Tribangun Usaha Persada — Weekly
--  Tool Inspection Form". A per-site master catalog of tools is
--  defined once; each week's inspection snapshots the active
--  catalog into tool_inspection_items so the inspector only
--  touches exceptions (condition changes, qty used, damage).
--
--  ASSET vs CONSUMABLE (item_kind discriminator):
--    ASSET      -> tracked by condition (GOOD/DAMAGED/MISSING/REPAIR)
--    CONSUMABLE -> tracked by usage (qty_used / qty_remaining)
--  Enforced by chk_item_kind_fields below, mirroring the
--  item_type-driven discriminator on purchase_request_items
--  (20260808_purchase_request_item_type_stock_gate.sql).
--
--  Photos are only ever attached to an ASSET item in a bad
--  condition (DAMAGED/MISSING/REPAIR) — enforced at the DB layer
--  by fn_enforce_photo_requires_bad_condition, not just app-side,
--  so a buggy client can't silently create orphaned photo rows.
--
--  Signatures (Inspected By / Responsible Person / Project
--  Manager Review) are stored as inline SVG/base64 text on the
--  parent row, not as Storage files — they're a few KB of vector
--  ink, not worth a bucket + upload round trip.
-- ============================================================

-- ── TABLE 1: tool_catalog_items ──────────────────────────────
-- Per-site master tool register. Rarely changes; edited when
-- tools are procured/retired, not on a weekly cadence.
CREATE TABLE IF NOT EXISTS public.tool_catalog_items (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID          NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  line_no       INTEGER       NOT NULL,
  name          TEXT          NOT NULL,
  category      TEXT,
  item_kind     TEXT          NOT NULL CHECK (item_kind IN ('ASSET', 'CONSUMABLE')),
  unit          TEXT          NOT NULL,
  default_qty   NUMERIC       NOT NULL DEFAULT 0 CHECK (default_qty >= 0),
  asset_no      TEXT,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.tool_catalog_items IS
  'Per-site master tool/equipment register. A new weekly tool_inspections row bulk-snapshots the active rows here into tool_inspection_items.';

-- Retired tools (is_active = false) keep their history but free up
-- the line_no for a replacement — so uniqueness only applies among
-- currently-active rows, not retired ones.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tool_catalog_items_active_line_no
  ON public.tool_catalog_items (site_id, line_no)
  WHERE is_active;


-- ── TABLE 2: tool_inspections ────────────────────────────────
-- Parent — one row per weekly form.
CREATE TABLE IF NOT EXISTS public.tool_inspections (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                   UUID          NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  project_name              TEXT          NOT NULL,
  project_location          TEXT,
  inspection_date           DATE          NOT NULL,
  week_label                TEXT          NOT NULL,
  responsible_person        TEXT          NOT NULL,
  inspector                 TEXT          NOT NULL,
  status                    TEXT          NOT NULL DEFAULT 'DRAFT'
                                           CHECK (status IN ('DRAFT', 'SUBMITTED')),
  corrective_notes          TEXT,
  -- Signature block — one slot per box on the physical form.
  -- Populated (name + signature + timestamp together) only at submit time.
  inspected_by_signature    TEXT,
  inspected_by_signed_at    TIMESTAMPTZ,
  responsible_signature     TEXT,
  responsible_signed_at     TIMESTAMPTZ,
  reviewer_name             TEXT,
  reviewer_signature        TEXT,
  reviewer_signed_at        TIMESTAMPTZ,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_tool_inspections_submitted_signed
    CHECK (status <> 'SUBMITTED' OR (
      inspected_by_signature IS NOT NULL AND
      responsible_signature  IS NOT NULL
    ))
);

COMMENT ON TABLE public.tool_inspections IS
  'Weekly Tool Inspection Form header. Stays DRAFT (autosaving per-item edits) until the inspector signs off and submits.';
COMMENT ON COLUMN public.tool_inspections.reviewer_signature IS
  'Project Manager / Review signature. Optional at submit time — the physical form allows this box to be countersigned later.';

CREATE INDEX IF NOT EXISTS idx_tool_inspections_keyset
  ON public.tool_inspections (site_id, created_at DESC, id DESC);


-- ── TABLE 3: tool_inspection_items ───────────────────────────
-- Child — this week's snapshot + findings, one row per tool.
CREATE TABLE IF NOT EXISTS public.tool_inspection_items (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id     UUID          NOT NULL REFERENCES public.tool_inspections(id) ON DELETE CASCADE,
  -- Nullable: SET NULL on catalog deletion keeps the historical inspection
  -- row intact even if the catalog entry is later removed outright.
  catalog_item_id   UUID          REFERENCES public.tool_catalog_items(id) ON DELETE SET NULL,
  line_no           INTEGER       NOT NULL,
  name              TEXT          NOT NULL,
  item_kind         TEXT          NOT NULL CHECK (item_kind IN ('ASSET', 'CONSUMABLE')),
  unit              TEXT          NOT NULL,
  qty               NUMERIC       NOT NULL CHECK (qty >= 0),
  asset_no          TEXT,
  -- ASSET-only fields
  condition         TEXT          CHECK (condition IN ('GOOD', 'DAMAGED', 'MISSING', 'REPAIR')),
  action_required   TEXT,
  due_date          DATE,
  -- CONSUMABLE-only fields
  qty_used          NUMERIC       CHECK (qty_used >= 0),
  qty_remaining     NUMERIC       CHECK (qty_remaining >= 0),
  remarks           TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_item_kind_fields CHECK (
    (item_kind = 'ASSET'      AND qty_used IS NULL AND qty_remaining IS NULL) OR
    (item_kind = 'CONSUMABLE' AND condition IS NULL AND action_required IS NULL AND due_date IS NULL)
  )
);

COMMENT ON TABLE public.tool_inspection_items IS
  'One row per tool for a given weekly inspection. name/unit/item_kind are snapshotted from tool_catalog_items at creation time so a later catalog rename does not rewrite history.';

CREATE INDEX IF NOT EXISTS idx_tool_inspection_items_inspection_id
  ON public.tool_inspection_items (inspection_id);
CREATE INDEX IF NOT EXISTS idx_tool_inspection_items_catalog_item_id
  ON public.tool_inspection_items (catalog_item_id);


-- ── TABLE 4: tool_inspection_photos ──────────────────────────
-- Only ever created for an ASSET item in a bad condition.
CREATE TABLE IF NOT EXISTS public.tool_inspection_photos (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_item_id    UUID          NOT NULL REFERENCES public.tool_inspection_items(id) ON DELETE CASCADE,
  storage_path          TEXT          NOT NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.tool_inspection_photos IS
  'Damage/missing/repair evidence photos, uploaded to the tool-inspection-photos bucket after client-side compression. storage_path is relative to the bucket root: {inspection_id}/{inspection_item_id}/{timestamp}.webp';

CREATE INDEX IF NOT EXISTS idx_tool_inspection_photos_item_id
  ON public.tool_inspection_photos (inspection_item_id);


-- ============================================================
--  TRIGGERS
-- ============================================================

-- updated_at bookkeeping — reuses public.set_updated_at(), already
-- defined in supabase/schema.sql (see 20260724_purchase_requests.sql).
DO $$ BEGIN
  CREATE TRIGGER trg_tool_catalog_items_updated_at
    BEFORE UPDATE ON public.tool_catalog_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_tool_inspections_updated_at
    BEFORE UPDATE ON public.tool_inspections
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_tool_inspection_items_updated_at
    BEFORE UPDATE ON public.tool_inspection_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- DB-level guard: a photo can only be attached to an ASSET item
-- currently in a bad condition. Belt-and-suspenders alongside the
-- client-side rule that hides the upload control otherwise.
CREATE OR REPLACE FUNCTION public.fn_enforce_photo_requires_bad_condition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_item_kind  TEXT;
  v_condition  TEXT;
BEGIN
  SELECT item_kind, condition INTO v_item_kind, v_condition
  FROM public.tool_inspection_items
  WHERE id = NEW.inspection_item_id;

  IF v_item_kind IS DISTINCT FROM 'ASSET'
     OR v_condition IS NULL
     OR v_condition = 'GOOD' THEN
    RAISE EXCEPTION
      'Photos may only be attached to ASSET items in DAMAGED, MISSING, or REPAIR condition (item %, kind=%, condition=%)',
      NEW.inspection_item_id, v_item_kind, v_condition;
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_tool_inspection_photos_guard
    BEFORE INSERT ON public.tool_inspection_photos
    FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_photo_requires_bad_condition();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
--  SUPABASE STORAGE BUCKET (run once in the dashboard)
-- ============================================================
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('tool-inspection-photos', 'tool-inspection-photos', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- Storage path convention:
--   {inspection_id}/{inspection_item_id}/{timestamp}.webp
