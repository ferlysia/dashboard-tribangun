export type InvoiceRecord = {
  id?: string
  no: number | null
  invoice_no: string
  customer: string
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
  payment_date: string
  payment_value: number
  selisih: number
  keterangan: string
  status: "PAID" | "UNPAID"
  is_placeholder: boolean
}
