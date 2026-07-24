export type PRStatus = "DRAFT" | "WAITING_PAYMENT" | "PURCHASED" | "COMPLETED" | "REJECTED"

export type SJStatus = "PENDING_SIGNED_SJ" | "BILLING_READY" | null

export interface PurchaseRequestItem {
  id:                   string
  purchase_request_id:  string
  line_no:              number
  qty:                  number
  satuan:               string
  nama_barang:          string
}

export interface PurchaseRequestRecord {
  id:                  string
  pr_no:               string
  site_maintenance:    string
  unit:                string
  permintaan_tanggal:  string   // ISO date
  status:              PRStatus
  rejection_reason:    string | null
  sj_status:           SJStatus
  sj_document_url:     string | null
  sj_uploaded_by:      string | null
  sj_uploaded_at:      string | null
  requested_by:        string | null
  notes:               string | null
  created_at:          string
  updated_at:          string
  items:               PurchaseRequestItem[]
}
