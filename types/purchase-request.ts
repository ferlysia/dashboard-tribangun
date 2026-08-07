export type PRStatus = "DRAFT" | "PENDING_STOCK_CHECK" | "WAITING_PAYMENT" | "PURCHASED" | "ARRIVED_AT_WAREHOUSE" | "COMPLETED" | "REJECTED"

export type SJStatus = "PENDING_SIGNED_SJ" | "BILLING_READY" | null

// MATERIAL = Warehouse must stock-validate before Purchasing sees the item
// (fulfillment_source starts PENDING_STOCK_CHECK). NON_MATERIAL bypasses
// Warehouse entirely (starts BELI_BARU). Item-level, not PR-level — a PR
// can be a hybrid, same as fulfillment_source already is.
export type ItemType = "MATERIAL" | "NON_MATERIAL"

// PENDING_STOCK_CHECK = MATERIAL item awaiting Warehouse's stock-check
// handover, not yet visible to Purchasing. One-way: only ever moves to
// BELI_BARU or STOK_INTERNAL, never back — see status-rules.ts.
export type FulfillmentSource = "PENDING_STOCK_CHECK" | "BELI_BARU" | "STOK_INTERNAL"

// Purchasing/Finance-owned, payment progress only: AWAITING_PAYMENT ->
// PURCHASED (PO placed). Does NOT track physical receipt — that's
// warehouse_status below, exclusively Warehouse Operations' domain.
export type ProcurementStatus = "AWAITING_PAYMENT" | "PURCHASED"

// Warehouse Operations-owned, exclusively: PENDING (not yet physically
// verified) -> RECEIVED (Step 1) -> READY_FOR_DISPATCH (Step 2, queued for
// site shipment) -> DISPATCHED (Step 3, linked to an uploaded Surat Jalan).
// DISPATCHED is only ever reachable via the surat-jalan upload endpoint,
// never a direct manual toggle — see status-rules.ts.
export type WarehouseStatus = "PENDING" | "RECEIVED" | "READY_FOR_DISPATCH" | "DISPATCHED"

export interface PurchaseRequestItem {
  id:                   string
  purchase_request_id:  string
  line_no:              number
  qty:                  number
  satuan:               string
  nama_barang:          string
  item_type:            ItemType
  fulfillment_source:   FulfillmentSource
  po_number:            string | null
  procurement_status:   ProcurementStatus
  warehouse_status:     WarehouseStatus
  dispatched_at:        string | null
  surat_jalan_id:       string | null
  parent_item_id:       string | null
}

export interface PurchaseRequestSuratJalan {
  id:                   string
  purchase_request_id:  string
  file_url:             string
  file_name:            string | null
  uploaded_by:          string | null
  uploaded_at:          string
  created_at:           string
}

export interface PurchaseRequestRecord {
  id:                       string
  pr_no:                    string
  site_maintenance:         string
  unit:                     string
  permintaan_tanggal:       string   // ISO date
  status:                   PRStatus
  rejection_reason:         string | null
  sj_status:                SJStatus
  surat_jalan_documents:    PurchaseRequestSuratJalan[]
  requested_by:             string | null
  notes:                    string | null
  created_at:               string
  updated_at:               string
  items:                    PurchaseRequestItem[]
}
