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

const REQUIRED_CORE_FIELDS = ["no_po", "description"]
const PRICE_FIELDS         = ["harga_sat", "total_harga", "unit_price", "total_price", "total_sat", "total"]
const MAX_HEADER_SCAN_ROWS = 60 // generous cap on how deep to look for the real table — covers any realistic metadata block

function normalizeHeader(h: unknown): string {
  return String(h ?? "").toLowerCase().replace(/\(.*?\)/g, "").replace(/\./g, "").replace(/\s+/g, " ").trim()
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

// ─── Adaptive header discovery ────────────────────────────────────────────────
// Real trackers often have project metadata (name, contract period, etc.) and/or a
// merged group-label row ("MATERIAL" / "JASA INSTALASI" spanning several columns)
// sitting above the actual column headers — and deleting those rows in Excel breaks
// #REF! formulas linked from other sheets, so users upload the workbook unmodified.
// Instead of assuming row 1 is the header, we scan the top of the sheet and pick
// whichever row resolves the most distinct known field names. That row is the real
// header almost every time, regardless of how many decorative rows sit above it.

function scoreHeaderRow(cells: unknown[]): Set<string> {
  const fields = new Set<string>()
  for (const cell of cells) {
    const mapped = COLUMN_MAP[normalizeHeader(cell)]
    if (mapped) fields.add(mapped)
  }
  return fields
}

// Fallback for a genuinely two-row-split header (a wrapped label sitting directly
// above its sub-header in the *same* column, rather than as a wide merge whose
// value only occupies the anchor cell and leaves the rest of the row blank).
function combineRows(top: unknown[], bottom: unknown[]): string[] {
  const len = Math.max(top.length, bottom.length)
  const out: string[] = []
  for (let j = 0; j < len; j++) {
    const a = String(top[j] ?? "").trim()
    const b = String(bottom[j] ?? "").trim()
    out.push([a, b].filter(Boolean).join(" "))
  }
  return out
}

function detectHeader(rawRows: unknown[][]): { fieldIndex: Record<string, number>; dataStartRow: number } | null {
  const scanLimit = Math.min(rawRows.length, MAX_HEADER_SCAN_ROWS)
  let best: { cells: unknown[]; fields: Set<string>; dataStartRow: number } | null = null

  for (let i = 0; i < scanLimit; i++) {
    const row = rawRows[i] ?? []
    const candidates: unknown[][] = [row]
    if (i > 0) candidates.push(combineRows(rawRows[i - 1] ?? [], row))

    for (const cells of candidates) {
      const fields = scoreHeaderRow(cells)
      if (!best || fields.size > best.fields.size) best = { cells, fields, dataStartRow: i + 1 }
    }
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
    const file       = formData.get("file") as File | null
    const projectKey = String(formData.get("project_key") || "")
    const costStream = formData.get("cost_stream") === "vo" ? "vo" : "main"

    if (!file)       return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    if (!projectKey) return NextResponse.json({ error: "project_key required" }, { status: 400 })

    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!["xlsx", "xls", "csv"].includes(ext ?? ""))
      return NextResponse.json({ error: "Only .xlsx, .xls, or .csv files are accepted" }, { status: 400 })

    const buffer   = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
    const sheet    = workbook.Sheets[workbook.SheetNames[0]]

    // Raw 2D array, no assumed header row — lets us scan for where the real table
    // actually starts instead of blindly trusting row 1.
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" })

    if (rawRows.length === 0)
      return NextResponse.json({ error: "File is empty or has no data rows" }, { status: 400 })

    const header = detectHeader(rawRows)
    if (!header)
      return NextResponse.json({
        error: "Tidak dapat menemukan baris header tabel (kolom No.PO / Description / Harga Sat dst tidak ditemukan). Pastikan file masih memuat tabel realisasi yang valid — baris metadata proyek di atasnya akan dilewati otomatis.",
      }, { status: 400 })

    const { fieldIndex, dataStartRow } = header
    const dataRows = rawRows.slice(dataStartRow)

    if (dataRows.length === 0)
      return NextResponse.json({ error: "Header ditemukan tapi tidak ada baris data di bawahnya" }, { status: 400 })

    const get = (row: unknown[], field: string): unknown =>
      fieldIndex[field] !== undefined ? row[fieldIndex[field]] : ""

    const errors:   string[] = []
    const toUpsert: Record<string, unknown>[] = []

    dataRows.forEach((row, i) => {
      const rowNum = dataStartRow + i + 1 // 1-indexed spreadsheet row, for user-facing messages
      const noPo        = String(get(row, "no_po") || "").trim()
      const description = String(get(row, "description") || "").trim()
      const supplier    = String(get(row, "supplier") || "").trim()

      // Fully blank row (spacer before a footer/summary, trailing rows, etc.) — skip silently.
      if (row.every(c => String(c ?? "").trim() === "")) return

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
