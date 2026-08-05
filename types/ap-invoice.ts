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
  // Progressive Entry: only vendor_id is required to create a draft row —
  // every other field below is filled in over several days as documents
  // arrive, so all are nullable ("not entered yet" vs. a real 0/value).
  invoice_date:    string | null
  invoice_number:  string | null
  dpp_amount:      number | null
  ppn_amount:      number | null
  pph_amount:      number | null
  total_amount:    number | null
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
