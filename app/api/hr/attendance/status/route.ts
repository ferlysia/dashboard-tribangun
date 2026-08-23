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

// HR's 1-door action: set an employee's status for a given day (Masuk,
// Alpha, Sakit, Izin, Cuti) with an optional remark. Updates the existing
// attendance_logs row if one already exists for that employee+day (a real
// clock-in, or a prior manual entry) — leaving its recorded_at, selfie,
// and GPS untouched — or inserts a fresh manual-entry row (no selfie/GPS)
// if the employee never clocked in.
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

  const { gte, lt } = jakartaDayRangeUTC(date)

  const existingParams = new URLSearchParams({ employee_id: `eq.${employeeId}`, select: "id", limit: "1" })
  existingParams.append("recorded_at", `gte.${gte}`)
  existingParams.append("recorded_at", `lt.${lt}`)

  const existingRes = await fetch(`${supabaseConfig.url}/rest/v1/attendance_logs?${existingParams}`, {
    headers: headers(),
    cache: "no-store",
  })
  if (!existingRes.ok) {
    return NextResponse.json({ error: "Gagal memeriksa data kehadiran" }, { status: 500 })
  }
  const existing = await existingRes.json() as { id: string }[]

  if (existing.length > 0) {
    const updateRes = await fetch(`${supabaseConfig.url}/rest/v1/attendance_logs?id=eq.${existing[0].id}`, {
      method:  "PATCH",
      headers: { ...headers(), Prefer: "return=representation" },
      body:    JSON.stringify({ status, remarks }),
    })
    if (!updateRes.ok) {
      return NextResponse.json({ error: "Gagal memperbarui status" }, { status: 500 })
    }
    const [data] = await updateRes.json()
    return NextResponse.json({ data })
  }

  // No row yet for this employee+day — manual HR entry, anchored to noon
  // Jakarta time on the target date so the generated attendance_date
  // column lands on the intended day regardless of when HR clicks Save.
  const insertRes = await fetch(`${supabaseConfig.url}/rest/v1/attendance_logs`, {
    method:  "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify({
      employee_id: employeeId,
      site_name:   "Entri Manual HR",
      status,
      remarks,
      recorded_at: `${date}T12:00:00+07:00`,
    }),
  })
  if (!insertRes.ok) {
    const errText = await insertRes.text()
    if (errText.includes("23505") || errText.includes("attendance_logs_employee_date_unique")) {
      return NextResponse.json({ error: "Data kehadiran untuk karyawan ini sudah ada" }, { status: 409 })
    }
    return NextResponse.json({ error: "Gagal menyimpan status" }, { status: 500 })
  }
  const [data] = await insertRes.json()
  return NextResponse.json({ data })
}
