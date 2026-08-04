import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { supabaseConfig } from "@/lib/supabase/config"

// Maps every plausible legacy Excel header variant (normalized) → our
// internal field key. Same adaptive-header-scan approach as
// app/api/project-costs/import/route.ts, scaled down — this schema is flat
// (one row = one invoice), no dual-category column splitting needed.
const COLUMN_MAP: Record<string, string> = {
  vendor:             "vendor",
  "vendor name":      "vendor",
  "nama vendor":      "vendor",
  pt:                 "vendor",
  supplier:           "vendor",
  "po date":          "po_date",
  "tanggal po":       "po_date",
  "po number":        "po_number",
  "no po":            "po_number",
  "nomor po":         "po_number",
  project:            "project_name",
  "project name":     "project_name",
  "nama project":     "project_name",
  proyek:             "project_name",
  "invoice date":     "invoice_date",
  "tanggal invoice":  "invoice_date",
  "tgl invoice":      "invoice_date",
  "invoice number":   "invoice_number",
  "no invoice":       "invoice_number",
  "nomor invoice":    "invoice_number",
  dpp:                "dpp_amount",
  "dpp amount":       "dpp_amount",
  "nilai dpp":        "dpp_amount",
  ppn:                "ppn_amount",
  "ppn amount":       "ppn_amount",
  pph:                "pph_amount",
  "pph amount":       "pph_amount",
  total:              "total_amount",
  "total amount":     "total_amount",
  jumlah:             "total_amount",
  "due date":         "due_date",
  "jatuh tempo":      "due_date",
  "tanggal jatuh tempo": "due_date",
  "payment date":     "payment_date",
  "tanggal bayar":    "payment_date",
  "tgl bayar":        "payment_date",
}

const REQUIRED_CORE_FIELDS = ["vendor", "invoice_number", "invoice_date"]
const PRICE_FIELDS         = ["dpp_amount", "total_amount"]
const MAX_HEADER_SCAN_ROWS = 30

function normalizeHeader(h: unknown): string {
  return String(h ?? "").toLowerCase().replace(/\(.*?\)/g, "").replace(/\./g, "").replace(/\s+/g, " ").trim()
}

function normalizeDate(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split("T")[0]
  if (typeof val === "number") return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().split("T")[0]
  const d = new Date(String(val).trim())
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0]
}

function toAmount(val: unknown): number {
  if (typeof val === "number") return Math.round(val)
  const digits = String(val ?? "").replace(/[^0-9]/g, "")
  return digits ? parseInt(digits, 10) : 0
}

function scoreHeaderRow(cells: unknown[]): Set<string> {
  const fields = new Set<string>()
  for (const cell of cells) {
    const mapped = COLUMN_MAP[normalizeHeader(cell)]
    if (mapped) fields.add(mapped)
  }
  return fields
}

function detectHeader(rawRows: unknown[][]): { fieldIndex: Record<string, number>; dataStartRow: number } | null {
  const scanLimit = Math.min(rawRows.length, MAX_HEADER_SCAN_ROWS)
  let best: { cells: unknown[]; fields: Set<string>; dataStartRow: number } | null = null

  for (let i = 0; i < scanLimit; i++) {
    const cells = rawRows[i] ?? []
    const fields = scoreHeaderRow(cells)
    if (!best || fields.size > best.fields.size) best = { cells, fields, dataStartRow: i + 1 }
  }

  if (!best) return null
  const hasCore  = REQUIRED_CORE_FIELDS.every(f => best!.fields.has(f))
  const hasPrice = PRICE_FIELDS.some(f => best!.fields.has(f))
  if (!hasCore || !hasPrice) return null

  const fieldIndex: Record<string, number> = {}
  best.cells.forEach((cell, idx) => {
    const mapped = COLUMN_MAP[normalizeHeader(cell)]
    if (mapped) fieldIndex[mapped] = idx
  })
  return { fieldIndex, dataStartRow: best.dataStartRow }
}

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 })

    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!["xlsx", "xls", "csv"].includes(ext ?? ""))
      return NextResponse.json({ error: "Only .xlsx, .xls, or .csv files are accepted" }, { status: 400 })

    const buffer   = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
    const sheet    = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows  = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" })

    if (rawRows.length === 0)
      return NextResponse.json({ error: "File is empty or has no data rows" }, { status: 400 })

    const header = detectHeader(rawRows)
    if (!header)
      return NextResponse.json({
        error: "Tidak dapat menemukan baris header tabel (kolom Vendor / Invoice Number / Invoice Date / DPP dst tidak ditemukan).",
      }, { status: 400 })

    const { fieldIndex, dataStartRow } = header
    const dataRows = rawRows.slice(dataStartRow)
    const get = (row: unknown[], field: string): unknown => (fieldIndex[field] !== undefined ? row[fieldIndex[field]] : "")

    const errors: string[] = []
    type ParsedRow = {
      vendor_name: string; po_date: string | null; po_number: string | null; project_name: string | null
      invoice_date: string; invoice_number: string
      dpp_amount: number; ppn_amount: number; pph_amount: number; total_amount: number
      due_date: string | null; payment_date: string | null
    }
    const parsed: ParsedRow[] = []

    dataRows.forEach((row, i) => {
      const rowNum = dataStartRow + i + 1
      if (row.every(c => String(c ?? "").trim() === "")) return

      const vendorName = String(get(row, "vendor") || "").trim()
      const invoiceNumber = String(get(row, "invoice_number") || "").trim()
      const invoiceDate = normalizeDate(get(row, "invoice_date"))

      if (!vendorName || !invoiceNumber || !invoiceDate) {
        errors.push(`Baris ${rowNum}: vendor, invoice number, dan invoice date wajib diisi — dilewati`)
        return
      }

      const dpp = toAmount(get(row, "dpp_amount"))
      const ppn = toAmount(get(row, "ppn_amount"))
      const pph = toAmount(get(row, "pph_amount"))
      const totalRaw = get(row, "total_amount")
      const total = totalRaw !== "" ? toAmount(totalRaw) : dpp + ppn - pph

      parsed.push({
        vendor_name:  vendorName,
        po_date:      normalizeDate(get(row, "po_date")),
        po_number:    String(get(row, "po_number") || "").trim() || null,
        project_name: String(get(row, "project_name") || "").trim() || null,
        invoice_date: invoiceDate,
        invoice_number: invoiceNumber,
        dpp_amount: dpp, ppn_amount: ppn, pph_amount: pph, total_amount: total,
        due_date:     normalizeDate(get(row, "due_date")),
        payment_date: normalizeDate(get(row, "payment_date")),
      })
    })

    if (parsed.length === 0)
      return NextResponse.json({ error: "Tidak ada baris valid untuk diimpor", errors }, { status: 400 })

    // Resolve/auto-create vendors — every distinct vendor name in the sheet
    // that doesn't already exist gets created rather than failing the row.
    const vendorsRes = await fetch(`${supabaseConfig.url}/rest/v1/ap_vendors?select=id,name`, { headers: headers() })
    if (!vendorsRes.ok) throw new Error(await vendorsRes.text())
    const existingVendors: { id: string; name: string }[] = await vendorsRes.json()
    const vendorIdByName = new Map(existingVendors.map(v => [v.name.trim().toLowerCase(), v.id]))

    const newVendorNames = Array.from(new Set(parsed.map(r => r.vendor_name.toLowerCase())))
      .filter(name => !vendorIdByName.has(name))
      .map(name => parsed.find(r => r.vendor_name.toLowerCase() === name)!.vendor_name)

    if (newVendorNames.length > 0) {
      const createRes = await fetch(`${supabaseConfig.url}/rest/v1/ap_vendors`, {
        method: "POST",
        headers: { ...headers(), Prefer: "return=representation" },
        body: JSON.stringify(newVendorNames.map(name => ({ name }))),
      })
      if (!createRes.ok) throw new Error(await createRes.text())
      const created: { id: string; name: string }[] = await createRes.json()
      created.forEach(v => vendorIdByName.set(v.name.trim().toLowerCase(), v.id))
    }

    // Match existing invoices by (vendor_id, invoice_number) so a repeat
    // import of the same legacy sheet updates in place instead of
    // duplicating every row.
    const existingInvRes = await fetch(
      `${supabaseConfig.url}/rest/v1/ap_invoices?select=id,vendor_id,invoice_number`,
      { headers: headers() }
    )
    if (!existingInvRes.ok) throw new Error(await existingInvRes.text())
    const existingInvoices: { id: string; vendor_id: string; invoice_number: string }[] = await existingInvRes.json()
    const existingIdByKey = new Map(existingInvoices.map(inv => [`${inv.vendor_id}|${inv.invoice_number}`, inv.id]))

    let inserted = 0
    let updated  = 0
    const toUpsert = parsed.map(row => {
      const vendor_id = vendorIdByName.get(row.vendor_name.toLowerCase())!
      const key = `${vendor_id}|${row.invoice_number}`
      const existingId = existingIdByKey.get(key)
      if (existingId) updated++; else inserted++

      const { vendor_name, ...rest } = row
      void vendor_name
      return {
        ...(existingId ? { id: existingId } : {}),
        vendor_id,
        ...rest,
      }
    })

    const res = await fetch(`${supabaseConfig.url}/rest/v1/ap_invoices?on_conflict=id`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=representation" },
      body:    JSON.stringify(toUpsert),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()

    return NextResponse.json({ data, errors, summary: { inserted, updated, vendorsCreated: newVendorNames.length } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import invoices" },
      { status: 500 }
    )
  }
}
