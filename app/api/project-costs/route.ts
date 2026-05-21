import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function getHeaders() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key")
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 })

    const url = `${supabaseConfig.url}/rest/v1/project_costs?project_key=eq.${encodeURIComponent(key)}&order=created_at.asc&select=*`
    const res = await fetch(url, { headers: getHeaders() })
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    return NextResponse.json({ data: rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.project_key || !body.description || body.amount === undefined) {
      return NextResponse.json({ error: "project_key, description, amount wajib diisi" }, { status: 400 })
    }

    const payload = {
      project_key: body.project_key,
      category: body.category || "lainnya",
      description: String(body.description),
      amount: Number(body.amount),
      cost_date: body.cost_date || null,
      input_by: String(body.input_by || ""),
      cost_stream: body.cost_stream === "vo" ? "vo" : "main",
    }

    const url = `${supabaseConfig.url}/rest/v1/project_costs`
    const res = await fetch(url, {
      method: "POST",
      headers: { ...getHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    return NextResponse.json({ data: rows[0] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
