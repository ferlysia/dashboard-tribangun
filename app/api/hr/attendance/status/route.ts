import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { jakartaDayRangeUTC } from "@/app/hr-dashboard/attendance/_lib/week"

const VALID_STATUSES = ["masuk", "alpha", "sakit", "izin", "cuti"] as const

function headers() {
  return {
    apikey:         supabaseConfig.serviceRoleKey,
    Authorization:  `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

// Reads employees.time_off for one employee and, if it's configured
// (not null — null means "never set", distinct from a real zero balance),
// adjusts it by `delta` and returns the new value. A no-op (delta === 0)
// still reads and returns the current value so the caller always knows
// what balance to show, without a wasted write.
async function adjustLeaveBalance(employeeId: string, delta: number): Promise<{ timeOff: number | null; skipped: boolean }> {
  const currentRes = await fetch(
    `${supabaseConfig.url}/rest/v1/employees?employee_id=eq.${employeeId}&select=time_off`,
    { headers: headers(), cache: "no-store" }
  )
  if (!currentRes.ok) throw new Error(await currentRes.text())
  const [current] = await currentRes.json() as { time_off: number | null }[]

  if (delta === 0 || current?.time_off == null) {
    return { timeOff: current?.time_off ?? null, skipped: true }
  }

  const next = current.time_off + delta
  const updateRes = await fetch(`${supabaseConfig.url}/rest/v1/employees?employee_id=eq.${employeeId}`, {
    method:  "PATCH",
    headers: { ...headers(), Prefer: "return=representation" },
    body:    JSON.stringify({ time_off: next }),
  })
  if (!updateRes.ok) throw new Error(await updateRes.text())
  const [updated] = await updateRes.json() as { time_off: number }[]
  return { timeOff: updated.time_off, skipped: false }
}

// HR's 1-door action: set an employee's status for a given day (Masuk,
// Alpha, Sakit, Izin, Cuti) with an optional remark. Updates the existing
// attendance_logs row if one already exists for that employee+day (a real
// clock-in, or a prior manual entry) — leaving its recorded_at, selfie,
// and GPS untouched — or inserts a fresh manual-entry row (no selfie/GPS)
// if the employee never clocked in.
//
// Real leave accounting: moving a day's status TO "cuti" deducts 1 from
// employees.time_off; moving it AWAY from "cuti" restores 1. A resave of
// the same status is a no-op (old === new cancels out). Deliberately not
// blocked at zero/negative balance — HR keeps final authority (e.g.
// approving emergency unpaid leave) — but the resulting balance is
// returned so the client can warn instead of silently going negative.
//
// updated_by/updated_at capture who made this specific edit, forwarded by
// middleware.ts as x-user-email for every authenticated request — distinct
// from recorded_at, which stays the original clock-in/creation instant.
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null) as
    | { employeeId?: string; date?: string; status?: string; remarks?: string | null }
    | null

  const employeeId = body?.employeeId?.trim()
  const date = body?.date
  const status = body?.status
  const remarks = body?.remarks?.trim() || null

  if (!employeeId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "employeeId dan date (YYYY-MM-DD) wajib diisi" }, { status: 400 })
  }
  if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 })
  }

  const updatedBy = request.headers.get("x-user-email") || null
  const updatedAt = new Date().toISOString()

  const { gte, lt } = jakartaDayRangeUTC(date)

  const existingParams = new URLSearchParams({ employee_id: `eq.${employeeId}`, select: "id,status", limit: "1" })
  existingParams.append("recorded_at", `gte.${gte}`)
  existingParams.append("recorded_at", `lt.${lt}`)

  const existingRes = await fetch(`${supabaseConfig.url}/rest/v1/attendance_logs?${existingParams}`, {
    headers: headers(),
    cache:   "no-store",
  })
  if (!existingRes.ok) {
    return NextResponse.json({ error: "Gagal memeriksa data kehadiran" }, { status: 500 })
  }
  const existing = await existingRes.json() as { id: string; status: string }[]
  const oldStatus = existing[0]?.status ?? null
  const leaveDelta = (oldStatus === "cuti" ? 1 : 0) - (status === "cuti" ? 1 : 0)

  let data: unknown

  if (existing.length > 0) {
    const updateRes = await fetch(`${supabaseConfig.url}/rest/v1/attendance_logs?id=eq.${existing[0].id}`, {
      method:  "PATCH",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify({ status, remarks, updated_by: updatedBy, updated_at: updatedAt }),
    })
    if (!updateRes.ok) {
      return NextResponse.json({ error: "Gagal memperbarui status" }, { status: 500 })
    }
    ;[data] = await updateRes.json()
  } else {
    // No row yet for this employee+day — manual HR entry, anchored to
    // noon Jakarta time on the target date so the generated
    // attendance_date column lands on the intended day regardless of
    // when HR clicks Save.
    const insertRes = await fetch(`${supabaseConfig.url}/rest/v1/attendance_logs`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify({
        employee_id: employeeId,
        site_name:   "Entri Manual HR",
        status,
        remarks,
        recorded_at: `${date}T12:00:00+07:00`,
        updated_by:  updatedBy,
        updated_at:  updatedAt,
      }),
    })
    if (!insertRes.ok) {
      const errText = await insertRes.text()
      if (errText.includes("23505") || errText.includes("attendance_logs_employee_date_unique")) {
        return NextResponse.json({ error: "Data kehadiran untuk karyawan ini sudah ada" }, { status: 409 })
      }
      return NextResponse.json({ error: "Gagal menyimpan status" }, { status: 500 })
    }
    ;[data] = await insertRes.json()
  }

  let timeOff: number | null = null
  let leaveBalanceSkipped = false
  try {
    const result = await adjustLeaveBalance(employeeId, leaveDelta)
    timeOff = result.timeOff
    leaveBalanceSkipped = result.skipped && leaveDelta !== 0 // only worth flagging if a real change was expected
  } catch {
    // Status write already succeeded — don't fail the whole request over
    // the balance adjustment; the client still sees a stale-but-safe
    // number and can retry via another status edit if needed.
  }

  return NextResponse.json({ data, timeOff, leaveBalanceSkipped })
}
