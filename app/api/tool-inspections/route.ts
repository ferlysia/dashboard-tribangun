import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import type { ToolCatalogItem } from "@/lib/tool-inspection/types"

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
    const cursor = searchParams.get("cursor")
    const limit  = Math.min(Number(searchParams.get("limit")) || 20, 100)

    // Same opaque "<created_at>_<id>" cursor convention as
    // app/api/purchase-requests/route.ts — created_at is echoed back
    // unparsed to preserve Postgres microsecond precision.
    let cursorFilter = ""
    if (cursor) {
      const sep = cursor.lastIndexOf("_")
      const cursorCreatedAt = decodeURIComponent(cursor.slice(0, sep))
      const cursorId        = cursor.slice(sep + 1)
      cursorFilter =
        `&or=(created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId}))`
    }

    // List view only needs the header + item count, not the full item array.
    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/tool_inspections` +
      `?select=*,tool_inspection_items(count)` +
      `&site_id=eq.${siteId}` +
      cursorFilter +
      `&order=created_at.desc,id.desc&limit=${limit}`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json() as Record<string, unknown>[]

    const data = rows.map(r => {
      const { tool_inspection_items, ...rest } = r
      const count = Array.isArray(tool_inspection_items)
        ? (tool_inspection_items[0] as { count?: number } | undefined)?.count ?? 0
        : 0
      return { ...rest, item_count: count }
    })

    const last = rows[rows.length - 1] as { created_at: string; id: string } | undefined
    const nextCursor = rows.length === limit && last
      ? `${encodeURIComponent(last.created_at)}_${last.id}`
      : null

    return NextResponse.json({ data, nextCursor })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load tool inspections" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      site_id, project_name, project_location, inspection_date,
      week_label, responsible_person, inspector,
    } = body as {
      site_id:             string
      project_name:        string
      project_location?:   string
      inspection_date:     string
      week_label:          string
      responsible_person:  string
      inspector:           string
    }

    if (!site_id || !project_name || !inspection_date || !week_label || !responsible_person || !inspector) {
      return NextResponse.json(
        { error: "site_id, project_name, inspection_date, week_label, responsible_person, and inspector are required" },
        { status: 400 }
      )
    }

    // 1. Snapshot the site's active catalog — this is what makes weekly
    // entry fast: the inspector only touches exceptions from here on.
    const catalogRes = await fetch(
      `${supabaseConfig.url}/rest/v1/tool_catalog_items` +
      `?select=*&site_id=eq.${site_id}&is_active=eq.true&order=line_no.asc`,
      { headers: headers() }
    )
    if (!catalogRes.ok) throw new Error(await catalogRes.text())
    const catalog = await catalogRes.json() as ToolCatalogItem[]
    if (catalog.length === 0) {
      return NextResponse.json(
        { error: "This site has no active tools in its catalog yet. Set up the tool catalog before creating an inspection." },
        { status: 400 }
      )
    }

    // 2. Create the header.
    const headerRes = await fetch(`${supabaseConfig.url}/rest/v1/tool_inspections`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify({
        site_id, project_name,
        project_location: project_location?.trim() || null,
        inspection_date, week_label, responsible_person, inspector,
      }),
    })
    if (!headerRes.ok) throw new Error(await headerRes.text())
    const [created] = await headerRes.json()

    // 3. Bulk-snapshot items. ASSET rows default to GOOD condition;
    // CONSUMABLE rows start fully unused (qty_remaining = default_qty).
    const itemRows = catalog.map(c => ({
      inspection_id:   created.id,
      catalog_item_id: c.id,
      line_no:         c.line_no,
      name:            c.name,
      item_kind:       c.item_kind,
      unit:            c.unit,
      qty:             c.default_qty,
      asset_no:        c.asset_no,
      condition:       c.item_kind === "ASSET" ? "GOOD" : null,
      qty_used:        c.item_kind === "CONSUMABLE" ? 0 : null,
      qty_remaining:   c.item_kind === "CONSUMABLE" ? c.default_qty : null,
    }))

    const itemsRes = await fetch(`${supabaseConfig.url}/rest/v1/tool_inspection_items`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify(itemRows),
    })
    if (!itemsRes.ok) throw new Error(await itemsRes.text())
    const items = await itemsRes.json()

    return NextResponse.json({ data: { ...created, tool_inspection_items: items } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create tool inspection" },
      { status: 500 }
    )
  }
}
