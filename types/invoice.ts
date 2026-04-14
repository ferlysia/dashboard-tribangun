export type InvoiceRecord = {
  id?: string
  no: number | null
  invoice_no: string
  project_type: "Maintenance" | "Material/PAC" | "Project/Instalasi" | "Jasa" | "Lainnya" | ""
  customer: string
  site_name: string
  description: string
  date: string
  year: number
  month: number
  po_number: string
  po_date: string
  po_value: number
  sheet_name: string
  workbook_year: number
  source_file: string
  tax_type: "PPN" | "NON_PPN"
  dpp: number
  ppn: number
  total: number
  invoice_sent_date: string
  terms_of_payment: 15 | 30 | 45 | 60 | 90 | 120 | null
  payment_date: string
  payment_value: number
  selisih: number
  keterangan: string
  status: "PAID" | "UNPAID"
  is_placeholder: boolean
}
