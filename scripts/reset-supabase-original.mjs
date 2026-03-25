import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")

function loadEnvFile() {
  const envPath = path.join(rootDir, ".env.local")
  if (!fs.existsSync(envPath)) return

  const content = fs.readFileSync(envPath, "utf8")
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue
    const eqIndex = line.indexOf("=")
    if (eqIndex === -1) continue
    const key = line.slice(0, eqIndex).trim()
    const value = line.slice(eqIndex + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
}

const sourcePath = path.join(rootDir, "data", "invoices-all.normalized.json")
const invoices = JSON.parse(fs.readFileSync(sourcePath, "utf8")).map((invoice) => ({
  ...invoice,
  date: invoice.date || null,
  po_date: invoice.po_date || null,
}))

function chunk(array, size) {
  const items = []
  for (let index = 0; index < array.length; index += size) {
    items.push(array.slice(index, index + size))
  }
  return items
}

async function deleteAllInvoices() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=not.is.null`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Delete invoices failed: ${response.status} ${errorText}`)
  }
}

async function insertBatch(rows, batchNumber, totalBatches) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/invoices`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Insert batch ${batchNumber}/${totalBatches} failed: ${response.status} ${errorText}`)
  }
}

async function createResetLog() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/activity_logs`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      actor_email: "system@local",
      action: "RESTORE_ALL",
      entity_type: "invoice",
      entity_id: "all",
      summary: "Restore seluruh invoice ke baseline original Excel",
      payload: {
        source: "data/invoices-all.normalized.json",
        restored_count: invoices.length,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Create reset log failed: ${response.status} ${errorText}`)
  }
}

async function verifyCount() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/invoices?select=count`, {
    method: "GET",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Verify failed: ${response.status} ${errorText}`)
  }

  const contentRange = response.headers.get("content-range") || ""
  const count = contentRange.includes("/") ? Number(contentRange.split("/").at(-1)) : null
  return count
}

async function main() {
  console.log("Deleting all invoices from Supabase...")
  await deleteAllInvoices()

  const batches = chunk(invoices, 100)
  for (let index = 0; index < batches.length; index += 1) {
    await insertBatch(batches[index], index + 1, batches.length)
    console.log(`Restored batch ${index + 1}/${batches.length}`)
  }

  await createResetLog()
  const count = await verifyCount()
  console.log(`Supabase invoices count after restore: ${count}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
