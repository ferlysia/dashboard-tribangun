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
    const includeInactive = searchParams.get("include_inactive") === "true"

    const filters = ["select=*", "order=name.asc"]
    if (!includeInactive) filters.push("is_active=eq.true")

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/tool_inspection_projects?${filters.join("&")}`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load tool inspection projects" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = String(body.name ?? "").trim()
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }
    const location = body.location ? String(body.location).trim() || null : null

    const res = await fetch(`${supabaseConfig.url}/rest/v1/tool_inspection_projects`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify({ name, location }),
    })
    if (!res.ok) throw new Error(await res.text())
    const [data] = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create tool inspection project" },
      { status: 500 }
    )
  }
}
