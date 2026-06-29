import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { supabaseConfig } from "@/lib/supabase/config"

// Maps every plausible Excel header variant (normalized) → our internal field key.
// Two parallel pairs distinguish the row's category: Harga Sat/Total Harga → Material,
// Unit Price/Total Price → Jasa Instalasi. Total Sat/Total are the already-merged
// "final" columns some sheets export instead of (or in addition to) the per-category pair.
const COLUMN_MAP: Record<string, string> = {
  tanggal:                         "tanggal",
  date:                            "tanggal",
  "no po":                         "no_po",
  nopo:                            "no_po",
  "po number":                     "no_po",
  "nomor po":                      "no_po",
  supplier:                        "supplier",
  vendor:                          "supplier",
  description:                     "description",
  deskripsi:                       "description",
  keterangan:                      "description",
  qty:                             "qty",
  quantity:                        "qty",
  jumlah:                          "qty",
  "harga sat":                     "harga_sat",
  "harga satuan":                  "harga_sat",
  "total harga":                   "total_harga",
  "unit price":                    "unit_price",
  "total price":                   "total_price",
  "total sat":                     "total_sat",
  "total satuan":                  "total_sat",
  total:                           "total",
  "total harga sat + pph 2%":      "harga_sat_pph",
  "harga sat + pph 2%":            "harga_sat_pph",
  "harga satuan + pph 2%":         "harga_sat_pph",
  "total harga + pph 2%":          "total_pph",
  "total + pph 2%":                "total_pph",
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\(.*?\)/g, "").replace(/\./g, "").replace(/\s+/g, " ").trim()
}

function normalizeDate(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split("T")[0]
  if (typeof val === "number") {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.toISOString().split("T")[0]
  }
  const s = String(val).trim()
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]
  return null
}

// Rupiah amounts are always whole numbers in this app — strip everything but digits.
function toAmount(val: unknown): number {
  if (typeof val === "number") return Math.round(val)
  const digits = String(val ?? "").replace(/[^0-9]/g, "")
  return digits ? parseInt(digits, 10) : 0
}

function toQty(val: unknown): number | null {
  if (val === "" || val === null || val === undefined) return null
  if (typeof val === "number") return val
  const s = String(val).trim().replace(/\./g, "").replace(",", ".")
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function getHeaders() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function POST(request: Request) {
  try {
    const formData   = await request.formData()
    const file        = formData.get("file") as File | null
    const projectKey  = String(formData.get("project_key") || "")
    const costStream  = formData.get("cost_stream") === "vo" ? "vo" : "main"

    if (!file)       return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    if (!projectKey) return NextResponse.json({ error: "project_key required" }, { status: 400 })

    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!["xlsx", "xls", "csv"].includes(ext ?? ""))
      return NextResponse.json({ error: "Only .xlsx, .xls, or .csv files are accepted" }, { status: 400 })

    const buffer   = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
    const sheet    = workbook.Sheets[workbook.SheetNames[0]]
    const rows     = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })

    if (rows.length === 0)
      return NextResponse.json({ error: "File is empty or has no data rows" }, { status: 400 })

    // Build a header → internal-field map from the first row's keys
    const headerMap: Record<string, string> = {}
    for (const key of Object.keys(rows[0])) {
      const mapped = COLUMN_MAP[normalizeHeader(key)]
      if (mapped) headerMap[key] = mapped
    }
    const get = (row: Record<string, unknown>, field: string): unknown => {
      const originalKey = Object.keys(headerMap).find(k => headerMap[k] === field)
      return originalKey ? row[originalKey] : ""
    }

    const errors:   string[] = []
    const toUpsert: Record<string, unknown>[] = []

    rows.forEach((row, i) => {
      const rowNum = i + 2 // header is row 1
      const noPo        = String(get(row, "no_po") || "").trim()
      const description = String(get(row, "description") || "").trim()
      const supplier    = String(get(row, "supplier") || "").trim()

      const hargaSat   = toAmount(get(row, "harga_sat"))
      const totalHarga = toAmount(get(row, "total_harga"))
      const unitPrice  = toAmount(get(row, "unit_price"))
      const totalPrice = toAmount(get(row, "total_price"))
      const totalSat   = toAmount(get(row, "total_sat"))
      const total      = toAmount(get(row, "total"))
      const hargaSatPphRaw = get(row, "harga_sat_pph")
      const totalPphRaw    = get(row, "total_pph")

      const isMaterial = hargaSat > 0 || totalHarga > 0
      const isJasa     = unitPrice > 0 || totalPrice > 0

      if (!noPo || !description) {
        errors.push(`Baris ${rowNum}: No.PO dan Description wajib diisi — dilewati`)
        return
      }
      if (isMaterial && isJasa) {
        errors.push(`Baris ${rowNum} (${noPo}): kolom Material & Jasa Instalasi terisi bersamaan — dilewati`)
        return
      }
      if (!isMaterial && !isJasa) {
        errors.push(`Baris ${rowNum} (${noPo}): Harga Sat/Total Harga atau Unit Price/Total Price wajib diisi — dilewati`)
        return
      }

      const amount = total || totalHarga || totalPrice
      if (amount <= 0) {
        errors.push(`Baris ${rowNum} (${noPo}): total biaya harus lebih dari 0 — dilewati`)
        return
      }

      toUpsert.push({
        project_key:      projectKey,
        category:         isMaterial ? "material" : "jasa_instalasi",
        description,
        amount,
        cost_date:        normalizeDate(get(row, "tanggal")),
        input_by:         "excel_import",
        cost_stream:      costStream,
        no_po:            noPo,
        supplier:         supplier || null,
        qty:              toQty(get(row, "qty")),
        harga_satuan:     totalSat || hargaSat || unitPrice || null,
        // Reference-only PPh 2% figures — never fed into amount, so Budget Matrix /
        // Sisa Budget / Net Profit calculations (which read `amount`) are unaffected.
        harga_satuan_pph: hargaSatPphRaw !== "" ? toAmount(hargaSatPphRaw) : null,
        total_pph:        totalPphRaw    !== "" ? toAmount(totalPphRaw)    : null,
      })
    })

    if (toUpsert.length === 0)
      return NextResponse.json({ error: "Tidak ada baris valid untuk disinkronkan", errors }, { status: 400 })

    // Upsert on (project_key, no_po, description): re-uploading the same file or a
    // price revision for the same PO+description overwrites the existing row instead
    // of inserting a duplicate (anti-double-input).
    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/project_costs?on_conflict=project_key,no_po,description`,
      {
        method: "POST",
        headers: { ...getHeaders(), Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(toUpsert),
      }
    )
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json() as Record<string, unknown>[]

    const materialRows = data.filter(r => r.category === "material")
    const jasaRows      = data.filter(r => r.category === "jasa_instalasi")

    return NextResponse.json({
      data,
      errors,
      summary: {
        material:       { count: materialRows.length, total: materialRows.reduce((s, r) => s + Number(r.amount), 0) },
        jasa_instalasi: { count: jasaRows.length,      total: jasaRows.reduce((s, r) => s + Number(r.amount), 0) },
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
