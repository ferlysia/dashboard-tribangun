import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { supabaseConfig } from "@/lib/supabase/config"

// Maps every plausible Excel header variant → our DB column name
const COLUMN_MAP: Record<string, string> = {
  ne_id:                "ne_id",
  neid:                 "ne_id",
  "ne id":              "ne_id",
  serial_number:        "serial_number",
  serialnumber:         "serial_number",
  "serial number":      "serial_number",
  sn:                   "serial_number",
  maintenance_date:     "maintenance_date",
  maintenancedate:      "maintenance_date",
  "maintenance date":   "maintenance_date",
  date:                 "maintenance_date",
  room:                 "room",
  ruang:                "room",
  site_name:            "site_name",
  sitename:             "site_name",
  "site name":          "site_name",
  site:                 "site_name",
  lokasi:               "site_name",
  floor:                "floor",
  lantai:               "floor",
  type_pac:             "type_pac",
  typepac:              "type_pac",
  "type pac":           "type_pac",
  type:                 "type_pac",
  jenis:                "type_pac",
  operational_status:   "operational_status",
  operationalstatus:    "operational_status",
  "operational status": "operational_status",
  status:               "operational_status",
}

const REQUIRED = ["ne_id", "serial_number", "maintenance_date", "room", "site_name", "floor", "type_pac", "operational_status"]

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, " ").trim()
}

function normalizeDate(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split("T")[0]
  if (typeof val === "number") {
    // Excel serial date fallback
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.toISOString().split("T")[0]
  }
  const s = String(val).trim()
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]
  return s
}

function normalizeStatus(val: unknown): "RUNNING" | "STANDBY" | "OFF" {
  const s = String(val ?? "").toUpperCase().trim()
  if (s === "STANDBY" || s === "STBY" || s === "SBY") return "STANDBY"
  if (s === "OFF"     || s === "MATI")                 return "OFF"
  return "RUNNING"
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      return NextResponse.json({ error: "Only .xlsx, .xls, or .csv files are accepted" }, { status: 400 })
    }

    const buffer   = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
    const sheet    = workbook.Sheets[workbook.SheetNames[0]]
    const rows     = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })

    if (rows.length === 0) {
      return NextResponse.json({ error: "File is empty or has no data rows" }, { status: 400 })
    }

    // Build a header → DB-column map from the first row's keys
    const headerMap: Record<string, string> = {}
    for (const key of Object.keys(rows[0])) {
      const mapped = COLUMN_MAP[normalizeHeader(key)]
      if (mapped) headerMap[key] = mapped
    }

    const presentCols = new Set(Object.values(headerMap))
    const missing = REQUIRED.filter(c => !presentCols.has(c))
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required columns: ${missing.join(", ")}. Expected headers: NE_ID, Serial_Number, Maintenance_Date, Room, Site_Name, Floor, Type_PAC, Operational_Status` },
        { status: 400 }
      )
    }

    const toInsert: Record<string, unknown>[] = []
    const errors:   string[] = []

    rows.forEach((row, i) => {
      const asset: Record<string, unknown> = {}

      for (const [originalKey, dbCol] of Object.entries(headerMap)) {
        const val = row[originalKey]
        if (dbCol === "maintenance_date") {
          asset[dbCol] = normalizeDate(val)
        } else if (dbCol === "operational_status") {
          asset[dbCol] = normalizeStatus(val)
        } else {
          asset[dbCol] = String(val ?? "").trim()
        }
      }

      if (!asset.ne_id || !asset.serial_number) {
        errors.push(`Row ${i + 2}: NE_ID and Serial_Number cannot be empty — skipped`)
        return
      }
      if (!asset.maintenance_date) {
        errors.push(`Row ${i + 2} (${asset.ne_id}): invalid Maintenance_Date — skipped`)
        return
      }

      toInsert.push(asset)
    })

    if (toInsert.length === 0) {
      return NextResponse.json({ error: "No valid rows to import", errors }, { status: 400 })
    }

    // Upsert: merge on ne_id (unique). Existing rows with same ne_id are updated.
    const res = await fetch(`${supabaseConfig.url}/rest/v1/assets?on_conflict=ne_id`, {
      method: "POST",
      headers: {
        apikey:         supabaseConfig.serviceRoleKey,
        Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer:        "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(toInsert),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: errText }, { status: 500 })
    }

    return NextResponse.json({
      imported: toInsert.length,
      skipped:  rows.length - toInsert.length,
      errors,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    )
  }
}
