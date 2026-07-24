import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    const body = await request.json()
    const { received } = body as { received: boolean }

    if (typeof received !== "boolean") {
      return NextResponse.json({ error: "received must be a boolean" }, { status: 400 })
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
        { error: "Items can only be checked off while the PR is Sampai di Gudang" },
        { status: 400 }
      )
    }

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/purchase_request_items?id=eq.${itemId}&purchase_request_id=eq.${id}`,
      {
        method:  "PATCH",
        headers: { ...headers(), Prefer: "return=representation" },
        body: JSON.stringify({
          received,
          received_at: received ? new Date().toISOString() : null,
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
