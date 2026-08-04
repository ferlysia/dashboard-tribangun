import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { isValidUnitTypes } from "@/lib/pm-schedule/recurring"

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
    const region = searchParams.get("region")

    const filters = ["select=*", "order=name.asc"]
    if (region === "JABO" || region === "CIKARANG") filters.push(`region=eq.${region}`)

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/sites?${filters.join("&")}`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sites" },
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
    const region = body.region === "CIKARANG" ? "CIKARANG" : "JABO"

    let unit_types: unknown[] = []
    if (body.unit_types !== undefined) {
      if (!isValidUnitTypes(body.unit_types)) {
        return NextResponse.json({ error: "unit_types tidak valid" }, { status: 400 })
      }
      unit_types = body.unit_types
    }

    const res = await fetch(`${supabaseConfig.url}/rest/v1/sites`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify({ name, region, unit_types }),
    })
    if (!res.ok) throw new Error(await res.text())
    const [data] = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create site" },
      { status: 500 }
    )
  }
}
