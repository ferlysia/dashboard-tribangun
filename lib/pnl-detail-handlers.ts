import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

// Shared CRUD handlers for the "category + tanggal + deskripsi + jumlah"
// detail tables (pnl_proyek_details, pnl_kantor_details) — they're identical
// in shape and only differ by table name and which categories are valid.

function headers() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export function makeDetailListHandlers(table: string, validCategories: Set<string>) {
  async function GET(request: Request) {
    try {
      const { searchParams } = new URL(request.url)
      const pnlId = searchParams.get("pnl_id")
      if (!pnlId) return NextResponse.json({ error: "pnl_id is required" }, { status: 400 })

      const res = await fetch(
        `${supabaseConfig.url}/rest/v1/${table}?pnl_id=eq.${pnlId}&select=*&order=created_at.asc`,
        { headers: headers() }
      )
      if (!res.ok) throw new Error(await res.text())
      return NextResponse.json({ data: await res.json() })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load data" }, { status: 500 })
    }
  }

  async function POST(request: Request) {
    try {
      const body = await request.json()
      const pnlId = body.pnl_id
      if (!pnlId) return NextResponse.json({ error: "pnl_id is required" }, { status: 400 })
      if (!validCategories.has(body.category)) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 })
      }

      const payload = {
        pnl_id: pnlId,
        category: body.category,
        tanggal: body.tanggal || null,
        deskripsi: String(body.deskripsi || ""),
        jumlah: Number(body.jumlah || 0),
      }

      const res = await fetch(`${supabaseConfig.url}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...headers(), Prefer: "return=representation" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      const rows = await res.json()
      return NextResponse.json({ data: rows[0] })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to add row" }, { status: 500 })
    }
  }

  return { GET, POST }
}

export function makeDetailItemHandlers(table: string, validCategories: Set<string>) {
  async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params
      const body = await request.json()

      const payload: Record<string, unknown> = {}
      if (body.deskripsi !== undefined) payload.deskripsi = String(body.deskripsi)
      if (body.jumlah !== undefined) payload.jumlah = Number(body.jumlah)
      if (body.tanggal !== undefined) payload.tanggal = body.tanggal || null
      if (body.category !== undefined) {
        if (!validCategories.has(body.category)) return NextResponse.json({ error: "Invalid category" }, { status: 400 })
        payload.category = body.category
      }
      if (Object.keys(payload).length === 0) return NextResponse.json({ ok: true })

      const res = await fetch(`${supabaseConfig.url}/rest/v1/${table}?id=eq.${id}`, {
        method: "PATCH",
        headers: { ...headers(), Prefer: "return=representation" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      const rows = await res.json()
      return NextResponse.json({ data: rows[0] ?? null })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update row" }, { status: 500 })
    }
  }

  async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params
      const res = await fetch(`${supabaseConfig.url}/rest/v1/${table}?id=eq.${id}`, {
        method: "DELETE",
        headers: { ...headers(), Prefer: "return=minimal" },
      })
      if (!res.ok) throw new Error(await res.text())
      return NextResponse.json({ success: true })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete row" }, { status: 500 })
    }
  }

  return { PATCH, DELETE }
}
