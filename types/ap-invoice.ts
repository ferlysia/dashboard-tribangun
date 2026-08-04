export interface ApVendor {
  id:         string
  name:       string
  is_active:  boolean
  created_at: string
}

export interface ApInvoice {
  id:              string
  vendor_id:       string
  po_date:         string | null
  po_number:       string | null
  project_name:    string | null
  invoice_date:    string   // ISO date
  invoice_number:  string
  dpp_amount:      number
  ppn_amount:      number
  pph_amount:      number
  total_amount:    number
  // NULL = Type B "Open Debt" — tracked by aging (invoice_date -> today)
  // instead of a countdown. Non-null = Type A, tracked by days remaining.
  due_date:        string | null
  // NULL = unpaid/active. Non-null = Paid/Done, moved to History.
  payment_date:    string | null
  notes:           string | null
  created_at:      string
  updated_at:      string
  // Embedded via PostgREST select=*,ap_vendors(*) on the list endpoint.
  ap_vendors?:     ApVendor
}
