import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

const PATCHABLE_FIELDS = [
  "condition", "action_required", "due_date",
  "qty_used", "qty_remaining", "remarks",
] as const

// The debounced autosave target for a single row edit — kept intentionally
// narrow (item-level fields only) so a burst of row edits never touches the
// inspection header or other rows.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    const body = await request.json() as Record<string, unknown>

    const patch: Record<string, unknown> = {}
    for (const field of PATCHABLE_FIELDS) {
      if (field in body) patch[field] = body[field]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 })
    }

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/tool_inspection_items?id=eq.${itemId}&inspection_id=eq.${id}`,
      {
        method:  "PATCH",
        headers: { ...headers(), Prefer: "return=representation" },
        body:    JSON.stringify(patch),
      }
    )
    if (!res.ok) throw new Error(await res.text())
    const [data] = await res.json()
    if (!data) {
      return NextResponse.json({ error: "Tool inspection item not found" }, { status: 404 })
    }
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update tool inspection item" },
      { status: 500 }
    )
  }
}
