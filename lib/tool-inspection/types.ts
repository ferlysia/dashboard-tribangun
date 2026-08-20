export type ItemKind = "ASSET" | "CONSUMABLE"
export type Condition = "GOOD" | "DAMAGED" | "MISSING" | "REPAIR"
export type InspectionStatus = "DRAFT" | "SUBMITTED"

// Construction/Project division registry (GAIA Data Center, ...) —
// deliberately separate from public.sites, which is Maintenance-division-
// only (HITACHI, SUPERNOVA). See 20260821_tool_inspection_projects.sql.
export interface ToolInspectionProject {
  id:         string
  name:       string
  location:   string | null
  is_active:  boolean
  created_at: string
  updated_at: string
}

export interface ToolCatalogItem {
  id:          string
  project_id:  string
  line_no:     number
  name:        string
  category:    string | null
  item_kind:   ItemKind
  unit:        string
  default_qty: number
  asset_no:    string | null
  is_active:   boolean
  created_at:  string
  updated_at:  string
}

export interface ToolInspectionPhoto {
  id:                  string
  inspection_item_id:  string
  storage_path:        string
  url:                 string
  created_at:          string
}

export interface ToolInspectionItem {
  id:                string
  inspection_id:     string
  catalog_item_id:   string | null
  line_no:           number
  name:              string
  item_kind:         ItemKind
  unit:              string
  qty:               number
  asset_no:          string | null
  condition:         Condition | null
  action_required:   string | null
  due_date:          string | null
  qty_used:          number | null
  qty_remaining:     number | null
  remarks:           string | null
  created_at:        string
  updated_at:        string
  tool_inspection_photos?: ToolInspectionPhoto[]
}

export interface ToolInspection {
  id:                        string
  project_id:                string
  project_name:              string
  project_location:          string | null
  inspection_date:           string
  week_label:                string
  responsible_person:        string
  inspector:                 string
  status:                    InspectionStatus
  corrective_notes:          string | null
  inspected_by_signature:    string | null
  inspected_by_signed_at:    string | null
  responsible_signature:     string | null
  responsible_signed_at:     string | null
  reviewer_name:             string | null
  reviewer_signature:        string | null
  reviewer_signed_at:        string | null
  created_at:                string
  updated_at:                string
  tool_inspection_items?:    ToolInspectionItem[]
}

// A row is "bad" (needs corrective attention / eligible for a photo) once its
// condition is anything other than GOOD. Kept centralized so the frontend's
// "does the photo control render?" check and any future filtering agree.
export function isBadCondition(condition: Condition | null | undefined): boolean {
  return condition === "DAMAGED" || condition === "MISSING" || condition === "REPAIR"
}
