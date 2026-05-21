import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function getHeaders() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const projectKey = decodeURIComponent(key)
    const url = `${supabaseConfig.url}/rest/v1/project_weekly_logs?project_key=eq.${encodeURIComponent(projectKey)}&order=week_number.asc,created_at.asc&select=*`
    const res = await fetch(url, { headers: getHeaders() })
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    return NextResponse.json({ data: rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const projectKey = decodeURIComponent(key)
    const body = await request.json()
    const payload = {
      project_key: projectKey,
      week_number: Number(body.week_number ?? 1),
      description: String(body.description ?? ""),
      photo_url: String(body.photo_url ?? ""),
      created_by: String(body.created_by ?? ""),
    }
    const url = `${supabaseConfig.url}/rest/v1/project_weekly_logs`
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
