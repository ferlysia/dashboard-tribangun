import { z } from "zod"

// Progressive Entry: Finance can create a draft with just a vendor and fill
// the rest in over the following days as PO/invoice documents arrive. Only
// vendor_id is required — every other field is nullable, but if a value IS
// present it must still be well-formed.
export const apInvoiceFormSchema = z.object({
  vendor_id:       z.string().min(1, "Vendor wajib dipilih"),
  po_date:         z.string().nullable().optional(),
  po_number:       z.string().trim().nullable().optional(),
  project_name:    z.string().trim().nullable().optional(),
  invoice_date:    z.string().nullable().optional(),
  invoice_number:  z.string().trim().nullable().optional(),
  dpp_amount:      z.number().nonnegative("DPP tidak boleh negatif").nullable().optional(),
  ppn_amount:      z.number().nonnegative("PPN tidak boleh negatif").nullable().optional(),
  pph_amount:      z.number().nonnegative("PPh tidak boleh negatif").nullable().optional(),
  total_amount:    z.number().nullable().optional(), // may be hand-overridden away from DPP+PPN-PPh, so no sign constraint
  due_date:        z.string().nullable().optional(),
  payment_date:    z.string().nullable().optional(),
  notes:           z.string().trim().nullable().optional(),
})

export type ApInvoiceFormValues = z.infer<typeof apInvoiceFormSchema>
