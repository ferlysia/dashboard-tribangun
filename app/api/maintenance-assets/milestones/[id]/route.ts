import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

function headers() {
  return {
    apikey:          supabaseConfig.serviceRoleKey,
    Authorization:  `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, uploaded_by } = body as { status: string; uploaded_by?: string }

    if (!["DONE", "PENDING", "OVERDUE"].includes(status)) {
      return NextResponse.json({ error: "status must be DONE, PENDING, or OVERDUE" }, { status: 400 })
    }

    const today = new Date().toISOString().split("T")[0]
    const patch: Record<string, unknown> =
      status === "DONE"
        ? { status, execution_date: today, uploaded_by: uploaded_by ?? null }
        : { status, execution_date: null, pm_report_uploaded_at: null }

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/contract_milestones?id=eq.${id}`,
      { method: "PATCH", headers: { ...headers(), Prefer: "return=representation" }, body: JSON.stringify(patch) }
    )

    if (!res.ok) throw new Error(await res.text())

    const rows = await res.json()
    return NextResponse.json({ milestone: rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update milestone" },
      { status: 500 }
    )
  }
}
