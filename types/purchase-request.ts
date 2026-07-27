export type PRStatus = "DRAFT" | "WAITING_PAYMENT" | "PURCHASED" | "ARRIVED_AT_WAREHOUSE" | "COMPLETED" | "REJECTED"

export type SJStatus = "PENDING_SIGNED_SJ" | "BILLING_READY" | null

export type FulfillmentSource = "BELI_BARU" | "STOK_INTERNAL"

export interface PurchaseRequestItem {
  id:                   string
  purchase_request_id:  string
  line_no:              number
  qty:                  number
  satuan:               string
  nama_barang:          string
  fulfillment_source:   FulfillmentSource
  po_number:            string | null
  received:             boolean
  received_at:          string | null
  surat_jalan_id:       string | null
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
