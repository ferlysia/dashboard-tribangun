import rawInvoices from "@/data/invoices-all.normalized.json"
import { getDedupedInvoices } from "@/lib/invoices"
import { supabaseConfig } from "@/lib/supabase/config"
import type { InvoiceRecord } from "@/types/invoice"

const baselineInvoices = getDedupedInvoices(rawInvoices as InvoiceRecord[])
const baselineMap = new Map(
  baselineInvoices.map((invoice) => [`${invoice.workbook_year}||${invoice.sheet_name}||${invoice.invoice_no}`, invoice])
)

function getBaselineKey(record: Partial<InvoiceRecord>) {
  return `${record.workbook_year}||${record.sheet_name}||${record.invoice_no}`
}

function getServerHeaders() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

const unsupportedInvoiceColumns = new Set<string>()

function extractMissingColumnName(rawError: string) {
  const match = rawError.match(/Could not find the '([^']+)' column/i)
  return match?.[1] ?? null
}

function omitUnsupportedInvoiceColumns(payload: Record<string, unknown>) {
  const next = { ...payload }
  for (const column of unsupportedInvoiceColumns) {
    delete next[column]
  }
  return next
}

async function writeInvoiceRecord(
  url: string,
  method: "POST" | "PATCH",
  payload: Record<string, unknown>,
  prefer: string
) {
  const nextPayload = omitUnsupportedInvoiceColumns(payload)

  while (true) {
    const response = await fetch(url, {
      method,
      headers: {
        ...getServerHeaders(),
        Prefer: prefer,
      },
      body: JSON.stringify(nextPayload),
    })

    if (response.ok) {
      return response.json()
    }

    const rawError = await response.text()
    const missingColumn = extractMissingColumnName(rawError)

    if (missingColumn && missingColumn in nextPayload) {
      unsupportedInvoiceColumns.add(missingColumn)
      delete nextPayload[missingColumn]
      continue
    }

    throw new Error(rawError)
  }
}

async function logActivity(input: {
  actorEmail?: string
  action: string
  entityType: string
  entityId: string
  summary: string
  payload?: Record<string, unknown>
}) {
  const response = await fetch(`${supabaseConfig.url}/rest/v1/activity_logs`, {
    method: "POST",
    headers: {
      ...getServerHeaders(),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      actor_email: input.actorEmail || "unknown@local",
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      summary: input.summary,
      payload: input.payload || {},
    }),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }
}

export async function upsertUserProfile(input: {
  email: string
  fullName: string
  role?: string
}) {
  const response = await fetch(`${supabaseConfig.url}/rest/v1/app_user_profiles?on_conflict=email`, {
    method: "POST",
    headers: {
      ...getServerHeaders(),
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      email: input.email,
      full_name: input.fullName,
      role: input.role || "editor",
      is_active: true,
    }),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const rows = await response.json()
  return rows[0]
}

const PROJECT_TYPES = ["Maintenance", "Material/PAC", "Project/Instalasi", "Jasa", "Lainnya"] as const

function extractSiteName(customer: string, explicit?: string): string {
  if (explicit !== undefined && explicit.trim() !== "") return explicit.trim()
  const match = customer.match(/\(([^)]+)\)/)
  return match ? match[1].trim() : ""
}

export function normalizeInvoiceRecord(record: Partial<InvoiceRecord>) {
  const date = record.date || ""
  const parsedYear = record.year ?? (date ? Number(date.slice(0, 4)) : new Date().getFullYear())
  const parsedMonth = record.month ?? (date ? Number(date.slice(5, 7)) : 0)
  const paymentDate = record.payment_date || ""
  const paymentValue = Number(record.payment_value || 0)
  const total = Number(record.total || 0)
  const customer = String(record.customer || "").trim()
  const top = Number(record.terms_of_payment)

  return {
    no: record.no ?? null,
    invoice_no: String(record.invoice_no || "").trim(),
    project_type: PROJECT_TYPES.includes((record.project_type || "") as (typeof PROJECT_TYPES)[number]) ? record.project_type : "",
    customer,
    site_name: extractSiteName(customer, record.site_name),
    description: String(record.description || "").trim(),
    date: date || null,
    year: parsedYear,
    month: parsedMonth,
    po_number: String(record.po_number || "").trim(),
    po_date: record.po_date || null,
    po_value: Number(record.po_value || 0),
    sheet_name: String(record.sheet_name || "LIVE_ENTRY"),
    workbook_year: record.workbook_year ?? parsedYear,
    source_file: String(record.source_file || "LIVE_WEB_ENTRY"),
    tax_type: record.tax_type === "NON_PPN" ? "NON_PPN" : "PPN",
    dpp: Number(record.dpp || 0),
    ppn: Number(record.ppn || 0),
    total,
    invoice_sent_date: String(record.invoice_sent_date || ""),
    terms_of_payment: [15, 30, 45, 60, 90, 120].includes(top) ? top : null,
    payment_date: paymentDate,
    payment_value: paymentValue,
    selisih: Number(record.selisih || 0),
    keterangan: String(record.keterangan || "").trim(),
    status: record.status === "PAID" || paymentDate || paymentValue >= total ? "PAID" : "UNPAID",
    is_placeholder: Boolean(record.is_placeholder),
  }
}

export async function getInvoiceById(id: string) {
  const response = await fetch(`${supabaseConfig.url}/rest/v1/invoices?id=eq.${id}&select=*`, {
    method: "GET",
    headers: getServerHeaders(),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const rows = await response.json()
  return rows[0] as InvoiceRecord | undefined
}

export async function createInvoice(record: Partial<InvoiceRecord>, actorEmail?: string) {
  const payload = normalizeInvoiceRecord(record)
  const rows = await writeInvoiceRecord(
    `${supabaseConfig.url}/rest/v1/invoices`,
    "POST",
    payload as Record<string, unknown>,
    "return=representation"
  )
  await logActivity({
    actorEmail,
    action: "CREATE",
    entityType: "invoice",
    entityId: rows[0].id,
    summary: `Membuat invoice ${rows[0].invoice_no}`,
    payload: { after: rows[0] },
  })
  return rows[0]
}

export async function updateInvoice(id: string, record: Partial<InvoiceRecord>, actorEmail?: string) {
  const existing = await getInvoiceById(id)
  if (!existing) {
    throw new Error("Invoice tidak ditemukan")
  }

  const payload = normalizeInvoiceRecord({ ...existing, ...record })
  const rows = await writeInvoiceRecord(
    `${supabaseConfig.url}/rest/v1/invoices?id=eq.${id}`,
    "PATCH",
    payload as Record<string, unknown>,
    "return=representation"
  )
  const updated = rows[0]
  const changedFields = ["status", "payment_date", "payment_value", "selisih", "total", "dpp", "ppn"].filter((field) => {
    const beforeValue = existing[field as keyof InvoiceRecord] ?? ""
    const afterValue = updated[field as keyof InvoiceRecord] ?? ""
    return String(beforeValue) !== String(afterValue)
  })

  const summary =
    existing.status !== updated.status
      ? `Mengubah status invoice ${updated.invoice_no} menjadi ${updated.status}`
      : changedFields.length > 0
        ? `Update invoice ${updated.invoice_no} (${changedFields.join(", ")})`
        : `Update invoice ${updated.invoice_no}`

  await logActivity({
    actorEmail,
    action: "UPDATE",
    entityType: "invoice",
    entityId: id,
    summary,
    payload: { before: existing, after: updated, changed_fields: changedFields },
  })
  return updated
}

export async function deleteInvoice(id: string, actorEmail?: string) {
  const existing = await getInvoiceById(id)
  const response = await fetch(`${supabaseConfig.url}/rest/v1/invoices?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      ...getServerHeaders(),
      Prefer: "return=minimal",
    },
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  if (existing) {
    await logActivity({
      actorEmail,
      action: "DELETE",
      entityType: "invoice",
      entityId: id,
      summary: `Menghapus invoice ${existing.invoice_no}`,
      payload: { before: existing },
    })
  }
}

export async function listActivityLogs(limit = 20) {
  const response = await fetch(`${supabaseConfig.url}/rest/v1/activity_logs?select=*&order=created_at.desc&limit=${limit}`, {
    method: "GET",
    headers: getServerHeaders(),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return response.json()
}

export async function listChangedInvoices() {
  const response = await fetch(`${supabaseConfig.url}/rest/v1/invoices?select=*`, {
    method: "GET",
    headers: getServerHeaders(),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const currentInvoices = (await response.json()) as InvoiceRecord[]
  return currentInvoices
    .map((invoice) => {
      const baseline = baselineMap.get(getBaselineKey(invoice))
      if (!baseline) {
        return {
          id: invoice.id,
          invoice_no: invoice.invoice_no,
          customer: invoice.customer,
          reason: "invoice baru di luar data original",
          current: invoice,
          baseline: null,
        }
      }

      const changedFields = ["status", "payment_date", "payment_value", "selisih", "total", "dpp", "ppn"].filter((field) => {
        const currentValue = invoice[field as keyof InvoiceRecord] ?? ""
        const baselineValue = baseline[field as keyof InvoiceRecord] ?? ""
        return String(currentValue) !== String(baselineValue)
      })

      if (changedFields.length === 0) return null

      return {
        id: invoice.id,
        invoice_no: invoice.invoice_no,
        customer: invoice.customer,
        reason: `berubah di ${changedFields.join(", ")}`,
        current: invoice,
        baseline,
      }
    })
    .filter(Boolean)
}

export async function restoreInvoiceToBaseline(id: string, actorEmail?: string) {
  const existing = await getInvoiceById(id)
  if (!existing) {
    throw new Error("Invoice tidak ditemukan")
  }

  const baseline = baselineMap.get(getBaselineKey(existing))
  if (!baseline) {
    throw new Error("Baseline original tidak ditemukan untuk invoice ini")
  }

  const restored = await updateInvoice(id, baseline, actorEmail)
  await logActivity({
    actorEmail,
    action: "RESTORE",
    entityType: "invoice",
    entityId: id,
    summary: `Restore invoice ${baseline.invoice_no} ke data original`,
    payload: { before: existing, after: restored, baseline },
  })
  return restored
}
