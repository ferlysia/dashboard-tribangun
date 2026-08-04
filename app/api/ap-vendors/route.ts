import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function GET() {
  try {
    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/ap_vendors?select=*&order=name.asc`,
      { headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load vendors" },
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

    const res = await fetch(`${supabaseConfig.url}/rest/v1/ap_vendors`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(await res.text())
    const [data] = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create vendor" },
      { status: 500 }
    )
  }
}
