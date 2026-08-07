import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { deriveOverallStatus } from "@/lib/purchase-request/status-rules"
import type { PRStatus } from "@/types/purchase-request"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

async function logActivity(input: {
  actorEmail?: string
  action:      string
  entityId:    string
  summary:     string
  payload?:    Record<string, unknown>
}) {
  await fetch(`${supabaseConfig.url}/rest/v1/activity_logs`, {
    method:  "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_email: input.actorEmail || "unknown@local",
      action:      input.action,
      entity_type: "purchase_request",
      entity_id:   input.entityId,
      summary:     input.summary,
      payload:     input.payload || {},
    }),
  }).catch(() => { /* activity log is best-effort */ })
}

// Same fire-and-forget rationale as [itemId]/route.ts's version: the
// response already carries the correctly re-derived status, so the client
// never waits on this write.
function persistDerivedStatusInBackground(
  id: string,
  pr: { pr_no: string; status: string },
  nextStatus: string,
  headerPatch: Record<string, unknown>
) {
  fetch(`${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${id}`, {
    method: "PATCH", headers: headers(), body: JSON.stringify(headerPatch),
  })
    .then(res => { if (!res.ok) return res.text().then(text => Promise.reject(new Error(text))) })
    .then(() => {
      logActivity({
        action:   "PR_STATUS_CHANGED",
        entityId: id,
        summary:  `PR ${pr.pr_no} status diubah dari ${pr.status} ke ${nextStatus}`,
        payload:  { from: pr.status, to: nextStatus },
      })
    })
    .catch(err => console.error(`Failed to persist derived status for PR ${id}:`, err))
}

// Backs Purchasing's bulk "Tandai N Dibeli" action — for urgent no-PO
// checkouts (e.g. e-commerce) where waiting to attach a PO number per item
// isn't practical. One PostgREST round trip via id=in.(...), scoped by an
// idempotent eligibility filter (fulfillment_source=BELI_BARU AND
// procurement_status=AWAITING_PAYMENT) so ids that are already purchased,
// still PENDING_STOCK_CHECK, or STOK_INTERNAL silently no-op instead of
// erroring the whole batch.
//
// A bulk selection can span multiple PRs, so — unlike the single-item
// route — this fetches every affected PR fresh afterward to re-derive each
// one's overall status from its complete item set (not just the items we
// just touched), then returns all of them so the client can apply each via
// the same applyUpdate() merge used everywhere else in this page.
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const itemIds = Array.isArray(body.item_ids)
      ? body.item_ids.filter((id: unknown) => typeof id === "string")
      : []
    if (itemIds.length === 0) {
      return NextResponse.json({ error: "item_ids must be a non-empty array" }, { status: 400 })
    }

    const idList = itemIds.map((id: string) => `"${id}"`).join(",")
    const patchRes = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_request_items` +
      `?id=in.(${idList})&fulfillment_source=eq.BELI_BARU&procurement_status=eq.AWAITING_PAYMENT` +
      `&select=purchase_request_id`,
      {
        method:  "PATCH",
        headers: { ...headers(), Prefer: "return=representation" },
        body:    JSON.stringify({ procurement_status: "PURCHASED" }),
      }
    )
    if (!patchRes.ok) throw new Error(await patchRes.text())
    const patchedItems = await patchRes.json() as { purchase_request_id: string }[]

    const prIds = Array.from(new Set(patchedItems.map(it => it.purchase_request_id)))
    if (prIds.length === 0) return NextResponse.json({ data: [] })

    const prIdList = prIds.map(id => `"${id}"`).join(",")
    const prRes = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_requests` +
      `?id=in.(${prIdList})&select=*,purchase_request_items(*),purchase_request_surat_jalan(*)`,
      { headers: headers() }
    )
    if (!prRes.ok) throw new Error(await prRes.text())
    const prRows = await prRes.json()

    const data = prRows.map((row: Record<string, unknown>) => {
      const { purchase_request_items, purchase_request_surat_jalan, ...prHeader } = row
      const items = (purchase_request_items ?? []) as { fulfillment_source: string; warehouse_status?: string; procurement_status?: string; item_type?: string }[]
      const nextStatus = deriveOverallStatus(items, prHeader.status as PRStatus)

      let responseHeader = prHeader
      if (nextStatus !== prHeader.status) {
        const headerPatch: Record<string, unknown> = { status: nextStatus }
        if (nextStatus === "COMPLETED") headerPatch.sj_status = "BILLING_READY"
        responseHeader = { ...prHeader, ...headerPatch }
        persistDerivedStatusInBackground(
          prHeader.id as string,
          prHeader as { pr_no: string; status: string },
          nextStatus,
          headerPatch
        )
      }

      return { ...responseHeader, items, surat_jalan_documents: purchase_request_surat_jalan ?? [] }
    })

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to mark items as purchased" },
      { status: 500 }
    )
  }
}
