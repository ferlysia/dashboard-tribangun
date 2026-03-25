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

function normalizeWorkbook({ year, file }) {
  const workbookPath = path.resolve(file)
  const workbook = XLSX.readFile(workbookPath)
  const records = []
  const warnings = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { range: 5, defval: "" })
    const validRows = rows.filter((row) => row["NO INVOICE"])
    const isNonPpn = /non ppn/i.test(sheetName)

    for (const row of validRows) {
      const record = isNonPpn
        ? normalizeNonPpnRow(row, year, sheetName, file)
        : normalizePpnRow(row, year, sheetName, file)

      records.push(record)

      if (record.year !== year) {
        warnings.push({
          type: "year_mismatch",
          invoice_no: record.invoice_no,
          workbook_year: year,
          record_year: record.year,
          sheet_name: sheetName,
        })
      }

      if (record.is_placeholder) {
        warnings.push({
          type: "placeholder_row",
          invoice_no: record.invoice_no,
          workbook_year: year,
          sheet_name: sheetName,
        })
      }
    }
  }

  return { records, warnings }
}

function main() {
  const allRecords = []
  const allWarnings = []
  const duplicateMap = new Map()

  for (const source of SOURCE_FILES) {
    if (!fs.existsSync(source.file)) {
      throw new Error(`File tidak ditemukan: ${source.file}`)
    }

    const { records, warnings } = normalizeWorkbook(source)
    allRecords.push(...records)
    allWarnings.push(...warnings)

    const targetPath = path.resolve("data", `invoices-${source.year}.normalized.json`)
    fs.writeFileSync(targetPath, JSON.stringify(records, null, 2))
  }

  for (const record of allRecords) {
    const key = record.invoice_no
    if (!duplicateMap.has(key)) duplicateMap.set(key, [])
    duplicateMap.get(key).push({
      workbook_year: record.workbook_year,
      sheet_name: record.sheet_name,
      source_file: record.source_file,
    })
  }

  const duplicates = [...duplicateMap.entries()]
    .filter(([, hits]) => hits.length > 1)
    .map(([invoice_no, hits]) => ({ invoice_no, hits }))

  const report = {
    generated_at: new Date().toISOString(),
    total_records: allRecords.length,
    records_by_year: SOURCE_FILES.map(({ year }) => ({
      year,
      count: allRecords.filter((record) => record.workbook_year === year).length,
      paid: allRecords.filter((record) => record.workbook_year === year && record.status === "PAID").length,
      unpaid: allRecords.filter((record) => record.workbook_year === year && record.status === "UNPAID").length,
    })),
    duplicates,
    warnings: allWarnings,
  }

  fs.writeFileSync(path.resolve("data", "invoices-all.normalized.json"), JSON.stringify(allRecords, null, 2))
  fs.writeFileSync(path.resolve("data", "invoice-import-report.json"), JSON.stringify(report, null, 2))

  console.log(`Generated ${allRecords.length} normalized invoice records.`)
  console.log(`Found ${duplicates.length} duplicate invoice number(s).`)
  console.log(`Captured ${allWarnings.length} warning(s).`)
}

main()
