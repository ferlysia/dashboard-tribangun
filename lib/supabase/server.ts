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

export function normalizeInvoiceRecord(record: Partial<InvoiceRecord>) {
  const date = record.date || ""
  const parsedYear = record.year ?? (date ? Number(date.slice(0, 4)) : new Date().getFullYear())
  const parsedMonth = record.month ?? (date ? Number(date.slice(5, 7)) : 0)
  const paymentDate = record.payment_date || ""
  const paymentValue = Number(record.payment_value || 0)
  const total = Number(record.total || 0)

  return {
    no: record.no ?? null,
    invoice_no: String(record.invoice_no || "").trim(),
    customer: String(record.customer || "").trim(),
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
  const response = await fetch(`${supabaseConfig.url}/rest/v1/invoices`, {
    method: "POST",
    headers: {
      ...getServerHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const rows = await response.json()
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
  const response = await fetch(`${supabaseConfig.url}/rest/v1/invoices?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      ...getServerHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const rows = await response.json()
  await logActivity({
    actorEmail,
    action: "UPDATE",
    entityType: "invoice",
    entityId: id,
    summary: `Update invoice ${rows[0].invoice_no}`,
    payload: { before: existing, after: rows[0] },
  })
  return rows[0]
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
