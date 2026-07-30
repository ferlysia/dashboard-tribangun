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

    // Fetched unconditionally (not just when `status` is patched) — the
    // reschedule-history diff needs the current scheduled_date regardless
    // of what else is being changed, and the actual_unit_count auto-fill
    // needs the current unit_count/site default to compute the target.
    const currentRes = await fetch(
      `${supabaseConfig.url}/rest/v1/pm_schedules?id=eq.${id}&select=status,scheduled_date,unit_count,reschedule_history,sites(unit_count)`,
      { headers: headers() }
    )
    if (!currentRes.ok) throw new Error(await currentRes.text())
    const [current] = await currentRes.json()
    if (!current) return NextResponse.json({ error: "Schedule not found" }, { status: 404 })

    if (body.status !== undefined) {
      if (!LEGAL_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      if (!isLegalStatusChange(current.status, body.status)) {
        return NextResponse.json(
          { error: `Tidak dapat mengubah status dari ${current.status} ke ${body.status}` },
          { status: 400 }
        )
      }
      patch.status = body.status
      patch.completed_at = body.status === "COMPLETED" ? new Date().toISOString() : null

      // Auto-fill actual completed units to the target when a visit is
      // freshly marked Done — unless the caller explicitly supplied its own
      // actual_unit_count in this same request (handled below), in which
      // case that value wins instead.
      if (body.status === "COMPLETED" && body.actual_unit_count === undefined) {
        const target = body.unit_count ?? current.unit_count ?? current.sites?.unit_count ?? 0
        patch.actual_unit_count = target
      }
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
    if (body.actual_unit_count !== undefined) {
      if (body.actual_unit_count !== null) {
        const n = Number(body.actual_unit_count)
        if (!Number.isInteger(n) || n < 0) {
          return NextResponse.json({ error: "actual_unit_count harus bilangan bulat >= 0" }, { status: 400 })
        }
        patch.actual_unit_count = n
      } else {
        patch.actual_unit_count = null
      }
    }
    if (body.notes !== undefined) patch.notes = String(body.notes ?? "").trim() || null
    if (body.scheduled_date !== undefined) {
      patch.scheduled_date = body.scheduled_date

      // Two distinct kinds of date move, per real dispatch workflow:
      //  - Internal re-routing (the default): ~1 week out, the Lead Tech
      //    re-clusters/re-routes sites by distance/efficiency. This just
      //    moves scheduled_date — no audit trail, no status change — since
      //    it's routine ops, not something the client asked for.
      //  - Formal reschedule (body.formal_reschedule === true, set only by
      //    the drawer's "Reschedule via Customer" action): the client asked
      //    to move the visit, so it's logged to reschedule_history AND the
      //    status is forced to RESCHEDULED, producing the visible
      //    "Original: Jan 1 -> Rescheduled: Mar 7" audit trail.
      if (body.formal_reschedule === true && body.scheduled_date !== current.scheduled_date) {
        if (!isLegalStatusChange(current.status, "RESCHEDULED")) {
          return NextResponse.json(
            { error: `Tidak dapat me-reschedule dari status ${current.status}` },
            { status: 400 }
          )
        }
        const history = Array.isArray(current.reschedule_history) ? current.reschedule_history : []
        patch.reschedule_history = [
          ...history,
          { from: current.scheduled_date, to: body.scheduled_date, at: new Date().toISOString() },
        ]
        patch.status = "RESCHEDULED"
        patch.completed_at = null
      }
    }
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
