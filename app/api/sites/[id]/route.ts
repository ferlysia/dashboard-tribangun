import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

// Backs inline editing from Sites Overview — unit_count is the master total
// and is explicitly "editable anytime" (e.g. Sales upsells more units at a
// site), unlike pm_schedules.unit_count which is a per-visit override.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const patch: Record<string, unknown> = {}
    if (body.unit_count !== undefined) {
      const n = Number(body.unit_count)
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json({ error: "unit_count harus bilangan bulat >= 0" }, { status: 400 })
      }
      patch.unit_count = n
    }
    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim()
      if (!name) return NextResponse.json({ error: "name tidak boleh kosong" }, { status: 400 })
      patch.name = name
    }
    if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active)

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/sites?id=eq.${id}`,
      { method: "PATCH", headers: { ...headers(), Prefer: "return=representation" }, body: JSON.stringify(patch) }
    )
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    if (rows.length === 0) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json({ data: rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update site" },
      { status: 500 }
    )
  }
}
