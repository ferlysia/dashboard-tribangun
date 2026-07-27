import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

// Marking an item received now only happens via the Surat Jalan upload
// checklist (see .../surat-jalan/route.ts), which links it to the document
// that delivered it. This endpoint is the safety net for undoing a mistaken
// receipt (wrong item checked, damaged goods found later) — it only accepts
// `received: false`, clearing the item back to pending and detaching it from
// whichever Surat Jalan it was linked to.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    const body = await request.json()
    const { received } = body as { received: boolean }

    if (received !== false) {
      return NextResponse.json(
        { error: "Item hanya dapat dibatalkan penerimaannya di sini — tandai diterima lewat upload Surat Jalan" },
        { status: 400 }
      )
    }

    const prRes = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_requests?id=eq.${id}&select=id,status`,
      { headers: headers() }
    )
    if (!prRes.ok) throw new Error(await prRes.text())
    const [pr] = await prRes.json()
    if (!pr) return NextResponse.json({ error: "Purchase request not found" }, { status: 404 })
    if (pr.status !== "ARRIVED_AT_WAREHOUSE") {
      return NextResponse.json(
        { error: "Item hanya dapat diubah selagi PR berstatus Sampai di Gudang" },
        { status: 400 }
      )
    }

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_request_items?id=eq.${itemId}&purchase_request_id=eq.${id}`,
      {
        method:  "PATCH",
        headers: { ...headers(), Prefer: "return=representation" },
        body: JSON.stringify({
          received:       false,
          received_at:    null,
          surat_jalan_id: null,
        }),
      }
    )
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    if (rows.length === 0) return NextResponse.json({ error: "Item not found on this PR" }, { status: 404 })

    return NextResponse.json({ data: rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update item" },
      { status: 500 }
    )
  }
}
