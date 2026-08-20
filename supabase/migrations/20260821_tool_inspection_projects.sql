-- ============================================================
--  DECOUPLE TOOL INSPECTION FROM `sites`
--
--  `public.sites` belongs to the Maintenance division (HITACHI,
--  SUPERNOVA — recurring PM visits, see 20260731_pm_schedules.sql).
--  The Weekly Tool Inspection Form belongs to the Construction/
--  Project division (GAIA Data Center, ...) — a different set of
--  entities that should never have been forced through the same
--  registry. This was a modeling mistake in the original
--  20260820_tool_inspections_schema.sql migration: it locked the
--  inspection UI to picking from Maintenance's site list.
--
--  Fix: a dedicated tool_inspection_projects registry, decoupled
--  from sites entirely. tool_catalog_items/tool_inspections now
--  scope off project_id instead of site_id. tool_inspections keeps
--  its free-text project_name/project_location columns (unchanged)
--  so a project rename later doesn't rewrite historical forms —
--  same snapshot principle as tool_inspection_items vs
--  tool_catalog_items — but they now default from, rather than
--  substitute for, a real project record.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tool_inspection_projects (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT          NOT NULL UNIQUE,
  location    TEXT,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.tool_inspection_projects IS
  'Construction/Project division registry for the Weekly Tool Inspection Form (e.g. GAIA Data Center). Deliberately separate from public.sites, which is Maintenance-division-only.';

DO $$ BEGIN
  CREATE TRIGGER trg_tool_inspection_projects_updated_at
    BEFORE UPDATE ON public.tool_inspection_projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.tool_inspection_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_tool_inspection_projects_all"
  ON public.tool_inspection_projects FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "auth_tool_inspection_projects_read"
  ON public.tool_inspection_projects FOR SELECT TO anon, authenticated USING (true);


-- ── Data migration: seed projects from any inspections already
-- created under the old site_id scoping, so nothing existing is
-- orphaned. Real usage going forward always has an explicit
-- project_id from the UI. ────────────────────────────────────

INSERT INTO public.tool_inspection_projects (name, location)
SELECT DISTINCT ON (project_name) project_name, project_location
FROM public.tool_inspections
ORDER BY project_name, created_at ASC
ON CONFLICT (name) DO NOTHING;


-- ── tool_inspections: site_id -> project_id ─────────────────

ALTER TABLE public.tool_inspections
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.tool_inspection_projects(id) ON DELETE RESTRICT;

UPDATE public.tool_inspections ti
SET project_id = p.id
FROM public.tool_inspection_projects p
WHERE p.name = ti.project_name AND ti.project_id IS NULL;

ALTER TABLE public.tool_inspections ALTER COLUMN project_id SET NOT NULL;

DROP INDEX IF EXISTS idx_tool_inspections_keyset;
CREATE INDEX IF NOT EXISTS idx_tool_inspections_keyset
  ON public.tool_inspections (project_id, created_at DESC, id DESC);

ALTER TABLE public.tool_inspections DROP COLUMN IF EXISTS site_id;


-- ── tool_catalog_items: site_id -> project_id ───────────────

ALTER TABLE public.tool_catalog_items
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.tool_inspection_projects(id) ON DELETE RESTRICT;

-- Map each existing catalog item to whichever project its
-- snapshotted inspection items actually ended up under.
UPDATE public.tool_catalog_items c
SET project_id = sub.project_id
FROM (
  SELECT DISTINCT ON (ii.catalog_item_id) ii.catalog_item_id, p.id AS project_id
  FROM public.tool_inspection_items ii
  JOIN public.tool_inspections ti ON ti.id = ii.inspection_id
  JOIN public.tool_inspection_projects p ON p.name = ti.project_name
  WHERE ii.catalog_item_id IS NOT NULL
) sub
WHERE sub.catalog_item_id = c.id AND c.project_id IS NULL;

-- Any catalog item never referenced by an inspection (only possible
-- for pre-launch test rows) falls back to the first known project —
-- purely to satisfy NOT NULL below.
UPDATE public.tool_catalog_items
SET project_id = (SELECT id FROM public.tool_inspection_projects ORDER BY created_at LIMIT 1)
WHERE project_id IS NULL;

ALTER TABLE public.tool_catalog_items ALTER COLUMN project_id SET NOT NULL;

DROP INDEX IF EXISTS uq_tool_catalog_items_active_line_no;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tool_catalog_items_active_line_no
  ON public.tool_catalog_items (project_id, line_no)
  WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_tool_catalog_items_project_id
  ON public.tool_catalog_items (project_id);

ALTER TABLE public.tool_catalog_items DROP COLUMN IF EXISTS site_id;
