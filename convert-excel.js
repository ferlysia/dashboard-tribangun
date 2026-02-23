const XLSX = require("xlsx")
const fs = require("fs")

const FILE_NAME = "REKAP INVOICE 2025.xlsx"

const workbook = XLSX.readFile(FILE_NAME)
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]

// ✅ HEADER ADA DI BARIS KE-6 → index 5
const rawData = XLSX.utils.sheet_to_json(sheet, {
  range: 5,
  defval: ""
})

console.log("TOTAL ROW TERBACA:", rawData.length)
console.log("CONTOH ROW PERTAMA:", rawData[0])

const invoices = rawData
  .filter(row => row["NO INVOICE"]) // filter yang benar
    .map(row => {

    const dateValue = row["TGL INVOICE"]

    let dateObj

    if (typeof dateValue === "number") {
        const parsed = XLSX.SSF.parse_date_code(dateValue)
        dateObj = new Date(parsed.y, parsed.m - 1, parsed.d)
    } else {
        dateObj = new Date(dateValue)
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
        dateObj = new Date(2025, 0, 1)
    }

    return {
        no: row["NO"],
        invoice_no: row["NO INVOICE"],
        customer: row["CUSTOMER"],
        description: row["DESKRIPSI"],

        date: dateObj.toISOString().split("T")[0],
        year: dateObj.getFullYear(),
        month: dateObj.getMonth() + 1,

        dpp: Number(row["DPP (IDR)"]) || 0,
        ppn: Number(row["PPN (IDR)"]) || 0,
        total: Number(row[" TOTAL (IDR) "] || row["TOTAL (IDR)"]) || 0,

        payment_date: row["TANGGAL PEMBAYARAN"],
        payment_value: Number(row["NILAI PEMBAYARAN"]) || 0,
        selisih: Number(row[" SELISIH "] || row["SELISIH"]) || 0,
        keterangan: row["KETERANGAN"],

        status: row["TANGGAL PEMBAYARAN"]
        ? "PAID"
        : "UNPAID"
    }
    })


if (!fs.existsSync("./data")) {
  fs.mkdirSync("./data")
}

fs.writeFileSync(
  "./data/invoices-2025.json",
  JSON.stringify(invoices, null, 2)
)

console.log("✅ invoices-2025.json berhasil dibuat!")
console.log("TOTAL INVOICE VALID:", invoices.length)
