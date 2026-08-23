import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"
import { addDays, getJakartaToday, jakartaDayRangeUTC, toDateKey } from "@/app/clock-in/_lib/date"

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
  }
}

const DEFAULT_DAYS = 14
const MAX_DAYS = 60

// Self-serve attendance history for a field tech's own device. Public
// like the rest of /api/attendance (see middleware.ts's allowlist) — this
// module has no login, so "prove who you are" already happens on the
// write path (selfie + GPS + Turnstile), same trust boundary a shared
// kiosk device would have. Scoped strictly to whatever employee_id the
// client asks for, and only exposes non-sensitive fields — never the
// selfie storage path or GPS coordinates, which stay HR-only
// (app/api/hr/attendance/table).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get("employee_id")?.trim()
  if (!employeeId) {
    return NextResponse.json({ error: "employee_id wajib diisi" }, { status: 400 })
  }
  const days = Math.min(Math.max(Number(searchParams.get("days")) || DEFAULT_DAYS, 1), MAX_DAYS)

  const today = getJakartaToday()
  const { gte } = jakartaDayRangeUTC(toDateKey(addDays(today, -(days - 1))))
  const { lt } = jakartaDayRangeUTC(toDateKey(today))

  const params = new URLSearchParams({
    employee_id: `eq.${employeeId}`,
    select:      "attendance_date,status,recorded_at,site_name",
    order:       "attendance_date.desc",
    limit:       String(days),
  })
  params.append("recorded_at", `gte.${gte}`)
  params.append("recorded_at", `lt.${lt}`)

  const res = await fetch(`${supabaseConfig.url}/rest/v1/attendance_logs?${params}`, {
    headers: headers(),
    cache:   "no-store",
  })
  if (!res.ok) {
    return NextResponse.json({ error: "Gagal memuat riwayat kehadiran" }, { status: 500 })
  }
  const rows = await res.json() as {
    attendance_date: string
    status:          string
    recorded_at:     string
    site_name:       string | null
  }[]

  return NextResponse.json({
    data: rows.map(r => ({
      date:       r.attendance_date,
      status:     r.status,
      recordedAt: r.recorded_at,
      siteName:   r.site_name,
    })),
  })
}
