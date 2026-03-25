/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs")
const path = require("path")
const XLSX = require("xlsx")

const SOURCE_FILES = [
  { year: 2025, file: "REKAP INVOICE 2025.xlsx" },
  { year: 2026, file: "REKAP INVOICE 2026.xlsx" },
]

function parseExcelDate(value) {
  if (value === "" || value == null || value === "-") return ""
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return ""
    const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
    return date.toISOString().slice(0, 10)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function toNumber(value) {
  if (value === "" || value == null || value === "-") return 0
  if (typeof value === "number") return value
  const normalized = String(value).replace(/[^\d.-]/g, "")
  if (!normalized) return 0
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function inferYear(invoiceNo, fallbackYear) {
  const match = String(invoiceNo || "").match(/\/(\d{4})$/)
  return match ? Number(match[1]) : fallbackYear
}

function inferMonth(dateString) {
  if (!dateString) return 0
  return Number(dateString.slice(5, 7))
}

function buildCommonFields(row, workbookYear, sheetName, sourceFile) {
  const invoiceNo = row["NO INVOICE"] || ""
  const invoiceDate = parseExcelDate(row["TGL INVOICE"])
  const invoiceYear = inferYear(invoiceNo, invoiceDate ? Number(invoiceDate.slice(0, 4)) : workbookYear)
  return {
    no: row["NO"] || null,
    invoice_no: invoiceNo,
    customer: row["CUSTOMER"] || row["NAMA CUSTOMER"] || "",
    description: row["DESKRIPSI"] || row["KETERANGAN"] || "",
    date: invoiceDate,
    year: invoiceYear,
    month: invoiceDate ? inferMonth(invoiceDate) : 0,
    po_number: row["NOMOR PO"] || row["PO No."] || "",
    po_date: parseExcelDate(row["TANGGAL PO"] || row["Tanggal PO"]),
    po_value: toNumber(row["PO (IDR)"]),
    sheet_name: sheetName,
    workbook_year: workbookYear,
    source_file: sourceFile,
  }
}

function normalizePpnRow(row, workbookYear, sheetName, sourceFile) {
  const paymentDate = row["TANGGAL PEMBAYARAN"]
  const paymentValue = toNumber(row["NILAI PEMBAYARAN"])
  return {
    ...buildCommonFields(row, workbookYear, sheetName, sourceFile),
    tax_type: "PPN",
    dpp: toNumber(row["DPP (IDR)"]),
    ppn: toNumber(row["PPN (IDR)"]),
    total: toNumber(row[" TOTAL (IDR) "] || row["TOTAL (IDR)"]),
    invoice_sent_date: parseExcelDate(row["TGL KIRIM INV"]),
    payment_date: paymentDate || "",
    payment_value: paymentValue,
    selisih: toNumber(row[" SELISIH "] || row["SELISIH"]),
    keterangan: row["KETERANGAN"] || "",
    status: paymentDate ? "PAID" : "UNPAID",
    is_placeholder: false,
  }
}

function normalizeNonPpnRow(row, workbookYear, sheetName, sourceFile) {
  const paymentDate = row[" TGL PEMBAYARAN "] || row["TGL PEMBAYARAN"] || ""
  const paymentValue = toNumber(row[" PENERIMAAN DI BANK "] || row["PENERIMAAN DI BANK"])
  const total = toNumber(row["PO (IDR)"])
  const isPlaceholder = !row["TGL INVOICE"] && !row["KETERANGAN"] && !row["PO (IDR)"]
  return {
    ...buildCommonFields(row, workbookYear, sheetName, sourceFile),
    tax_type: "NON_PPN",
    dpp: total,
    ppn: 0,
    total,
    invoice_sent_date: "",
    payment_date: paymentDate,
    payment_value: paymentValue,
    selisih: toNumber(row[" SELISIH "] || row["SELISIH"]),
    keterangan: row["KETERANGAN_1"] || row["KETERANGAN"] || "",
    status: paymentDate || paymentValue > 0 ? "PAID" : "UNPAID",
    is_placeholder: isPlaceholder,
  }
}

function rebuildFromWorkbook() {
  const records = []
  for (const source of SOURCE_FILES) {
    const workbook = XLSX.readFile(path.resolve(source.file))
    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { range: 5, defval: "" })
      const validRows = rows.filter((row) => row["NO INVOICE"])
      const isNonPpn = /non ppn/i.test(sheetName)
      for (const row of validRows) {
        records.push(
          isNonPpn
            ? normalizeNonPpnRow(row, source.year, sheetName, source.file)
            : normalizePpnRow(row, source.year, sheetName, source.file)
        )
      }
    }
  }
  return records
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0)
}

function main() {
  const normalized = JSON.parse(fs.readFileSync(path.resolve("data/invoices-all.normalized.json"), "utf8"))
  const rebuilt = rebuildFromWorkbook()

  const numericFields = ["po_value", "dpp", "ppn", "total", "payment_value", "selisih"]
  const summary = {
    rebuiltCount: rebuilt.length,
    normalizedCount: normalized.length,
    countsEqual: rebuilt.length === normalized.length,
    sumChecks: Object.fromEntries(
      numericFields.map((field) => [
        field,
        {
          rebuilt: sum(rebuilt, field),
          normalized: sum(normalized, field),
          equal: Math.abs(sum(rebuilt, field) - sum(normalized, field)) < 1e-6,
        },
      ])
    ),
  }

  const normalizedMap = new Map(
    normalized.map((row) => [`${row.workbook_year}||${row.sheet_name}||${row.invoice_no}`, row])
  )

  const mismatches = []
  for (const row of rebuilt) {
    const key = `${row.workbook_year}||${row.sheet_name}||${row.invoice_no}`
    const match = normalizedMap.get(key)
    if (!match) {
      mismatches.push({ key, type: "missing_in_normalized" })
      continue
    }

    for (const field of [
      "date",
      "customer",
      "description",
      "po_number",
      "po_date",
      "po_value",
      "dpp",
      "ppn",
      "total",
      "payment_date",
      "payment_value",
      "selisih",
      "status",
      "keterangan",
    ]) {
      const sourceValue = row[field] ?? ""
      const normalizedValue = match[field] ?? ""
      const equal =
        typeof sourceValue === "number" || typeof normalizedValue === "number"
          ? Math.abs(Number(sourceValue) - Number(normalizedValue)) < 1e-6
          : String(sourceValue) === String(normalizedValue)

      if (!equal) {
        mismatches.push({
          key,
          field,
          sourceValue,
          normalizedValue,
        })
        break
      }
    }
  }

  const result = {
    summary,
    mismatchCount: mismatches.length,
    mismatchSample: mismatches.slice(0, 20),
  }

  console.log(JSON.stringify(result, null, 2))
}

main()
