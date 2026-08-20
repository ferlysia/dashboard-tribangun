import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("site_id")
    if (!siteId) {
      return NextResponse.json({ error: "site_id is required" }, { status: 400 })
    }
    const includeInactive = searchParams.get("include_inactive") === "true"

    const filters = [
      "select=*",
      `site_id=eq.${siteId}`,
      "order=line_no.asc",
    ]
    if (!includeInactive) filters.push("is_active=eq.true")

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/tool_catalog_items?${filters.join("&")}`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load tool catalog" },
      { status: 500 }
    )
  }
}

interface CatalogItemInput {
  line_no?:     number
  name:         string
  category?:    string | null
  item_kind:    "ASSET" | "CONSUMABLE"
  unit:         string
  default_qty?: number
  asset_no?:    string | null
}

// Bulk create only — the physical form has 30-190 rows per site, so the
// catalog is almost always seeded in one paste/import, not row-by-row.
// Single-item add is just { items: [oneItem] }.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { site_id, items } = body as { site_id: string; items: CatalogItemInput[] }

    if (!site_id) {
      return NextResponse.json({ error: "site_id is required" }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 })
    }
    for (const it of items) {
      if (!it.name || !it.unit || (it.item_kind !== "ASSET" && it.item_kind !== "CONSUMABLE")) {
        return NextResponse.json(
          { error: "Every item requires name, unit, and item_kind of ASSET or CONSUMABLE" },
          { status: 400 }
        )
      }
    }

    // Auto-number line_no continuing after the highest existing active row,
    // for items that don't specify one explicitly.
    let nextLineNo = 1
    if (items.some(it => it.line_no === undefined)) {
      const maxRes = await fetch(
        `${supabaseConfig.url}/rest/v1/tool_catalog_items` +
        `?select=line_no&site_id=eq.${site_id}&is_active=eq.true&order=line_no.desc&limit=1`,
        { headers: headers() }
      )
      if (!maxRes.ok) throw new Error(await maxRes.text())
      const [top] = await maxRes.json() as { line_no: number }[]
      nextLineNo = (top?.line_no ?? 0) + 1
    }

    const rows = items.map(it => ({
      site_id,
      line_no:     it.line_no ?? nextLineNo++,
      name:        it.name,
      category:    it.category?.trim() || null,
      item_kind:   it.item_kind,
      unit:        it.unit,
      default_qty: it.default_qty ?? 0,
      asset_no:    it.asset_no?.trim() || null,
    }))

    const res = await fetch(`${supabaseConfig.url}/rest/v1/tool_catalog_items`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify(rows),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create tool catalog items" },
      { status: 500 }
    )
  }
}
