import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function getHeaders() {
  return {
    apikey: supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = `${supabaseConfig.url}/rest/v1/project_costs?id=eq.${id}`
    const res = await fetch(url, {
      method: "DELETE",
      headers: { ...getHeaders(), Prefer: "return=minimal" },
    })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
