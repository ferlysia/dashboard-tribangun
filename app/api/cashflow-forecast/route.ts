import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function getHeaders() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

type InvoiceRow = {
  total: number
  payment_value: number
  invoice_sent_date: string
  terms_of_payment: number | null
  status: string
  customer: string
  invoice_no: string
  site_name: string
}

export async function GET() {
  try {
    const base = supabaseConfig.url

    // Fetch all unpaid invoices
    const invUrl = `${base}/rest/v1/invoices?status=eq.UNPAID&select=total,payment_value,invoice_sent_date,terms_of_payment,status,customer,invoice_no,site_name`
    const invRes = await fetch(invUrl, { headers: getHeaders() })
    if (!invRes.ok) throw new Error(await invRes.text())
    const invoices: InvoiceRow[] = await invRes.json()

    // Fetch count of unacknowledged escalations across all projects
    const escUrl = `${base}/rest/v1/project_escalations?acknowledged_at=is.null&select=id,project_key,escalation_type,triggered_at,notes`
    const escRes = await fetch(escUrl, { headers: getHeaders() })
    const escalations = escRes.ok ? await escRes.json() : []

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const buckets = { overdue: 0, d30: 0, d60: 0, d90: 0, beyond: 0 }
    const overdueList: { invoice_no: string; customer: string; site_name: string; amount: number; overdueDays: number }[] = []

    for (const inv of invoices) {
      const outstanding = Math.max(0, Number(inv.total) - Number(inv.payment_value ?? 0))
      if (outstanding <= 0) continue

      // Compute due date from sent_date + TOP days
      const sentDate = inv.invoice_sent_date ? new Date(inv.invoice_sent_date) : null
      const top      = Number(inv.terms_of_payment ?? 30)
      const dueDate  = sentDate ? new Date(sentDate.getTime() + top * 86_400_000) : null

      if (!dueDate) {
        buckets.beyond += outstanding
        continue
      }

      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / 86_400_000)

      if (diffDays < 0) {
        buckets.overdue += outstanding
        overdueList.push({
          invoice_no:  inv.invoice_no,
          customer:    inv.customer,
          site_name:   inv.site_name,
          amount:      outstanding,
          overdueDays: Math.abs(diffDays),
        })
      } else if (diffDays <= 30)  buckets.d30    += outstanding
      else if  (diffDays <= 60)  buckets.d60    += outstanding
      else if  (diffDays <= 90)  buckets.d90    += outstanding
      else                       buckets.beyond  += outstanding
    }

    // Total outstanding
    const totalOutstanding = Object.values(buckets).reduce((s, v) => s + v, 0)

    return NextResponse.json({
      buckets,
      totalOutstanding,
      overdueList: overdueList.sort((a, b) => b.overdueDays - a.overdueDays).slice(0, 10),
      openEscalations: escalations,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
