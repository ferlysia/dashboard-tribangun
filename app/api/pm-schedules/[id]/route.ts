import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { isLegalStatusChange } from "@/lib/pm-schedule/status-rules"
import type { PmScheduleStatus } from "@/types/pm-schedule"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

const LEGAL_STATUSES: PmScheduleStatus[] = ["PLANNED", "ANNOUNCED", "IN_PROGRESS", "COMPLETED", "RESCHEDULED"]

// Single mutation endpoint for the whole dashboard — the grid's inline
// status cell, the board's drag-drop handler, and the drawer's edit form
// all PATCH through here, so status changes behave identically everywhere.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const patch: Record<string, unknown> = {}

    if (body.status !== undefined) {
      if (!LEGAL_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      const currentRes = await fetch(
        `${supabaseConfig.url}/rest/v1/pm_schedules?id=eq.${id}&select=status`,
        { headers: headers() }
      )
      if (!currentRes.ok) throw new Error(await currentRes.text())
      const [current] = await currentRes.json()
      if (!current) return NextResponse.json({ error: "Schedule not found" }, { status: 404 })

      if (!isLegalStatusChange(current.status, body.status)) {
        return NextResponse.json(
          { error: `Tidak dapat mengubah status dari ${current.status} ke ${body.status}` },
          { status: 400 }
        )
      }
      patch.status = body.status
      patch.completed_at = body.status === "COMPLETED" ? new Date().toISOString() : null
    }

    if (body.assignees !== undefined) {
      if (!Array.isArray(body.assignees) || !body.assignees.every((a: unknown) => typeof a === "string")) {
        return NextResponse.json({ error: "assignees must be an array of strings" }, { status: 400 })
      }
      patch.assignees = body.assignees
    }
    if (body.unit_count !== undefined) {
      if (body.unit_count !== null) {
        const n = Number(body.unit_count)
        if (!Number.isInteger(n) || n < 0) {
          return NextResponse.json({ error: "unit_count harus bilangan bulat >= 0" }, { status: 400 })
        }
        patch.unit_count = n
      } else {
        patch.unit_count = null
      }
    }
    if (body.notes !== undefined) patch.notes = String(body.notes ?? "").trim() || null
    if (body.scheduled_date !== undefined) patch.scheduled_date = body.scheduled_date
    if (body.report_submitted !== undefined) patch.report_submitted = Boolean(body.report_submitted)

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/pm_schedules?id=eq.${id}&select=*,sites(*)`,
      { method: "PATCH", headers: { ...headers(), Prefer: "return=representation" }, body: JSON.stringify(patch) }
    )
    if (!res.ok) throw new Error(await res.text())
    const rows = await res.json()
    if (rows.length === 0) return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
    return NextResponse.json({ data: rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update PM schedule" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const res = await fetch(
      `${supabaseConfig.url}/rest/v1/pm_schedules?id=eq.${id}`,
      { method: "DELETE", headers: headers() }
    )
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ data: { id } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete PM schedule" },
      { status: 500 }
    )
  }
}
