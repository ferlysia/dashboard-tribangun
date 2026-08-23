import { NextResponse } from "next/server"
import { supabaseConfig } from "@/lib/supabase/config"

const BUCKET = "attendance-selfies"
const DEDUPE_WINDOW_MINUTES = 5

function headers() {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": "application/json",
  }
}

function storageHeaders(contentType: string) {
  return {
    apikey:        supabaseConfig.serviceRoleKey,
    Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    "Content-Type": contentType,
    "x-upsert":    "true",
  }
}

async function deleteStorageObject(path: string) {
  await fetch(`${supabaseConfig.url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "DELETE",
    headers: {
      apikey:        supabaseConfig.serviceRoleKey,
      Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
    },
  }).catch(() => { /* best-effort cleanup */ })
}

// Storage path fragment only — employee_id itself is stored verbatim as
// the FK value; this just keeps the bucket path filesystem-safe.
function sanitizePathSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "-")
}

// Fails closed in production if Turnstile isn't configured (that's the
// entire point of this gate), but fails open in development so the flow is
// testable locally before real Cloudflare keys are provisioned.
async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    if (process.env.NODE_ENV === "production") return false
    console.warn("TURNSTILE_SECRET_KEY not set — skipping Turnstile verification (dev only).")
    return true
  }
  if (!token) return false

  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set("remoteip", ip)

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) return false
  const result = await res.json() as { success: boolean }
  return result.success
}

// Turnstile (proof-of-browser) and a duplicate-submission window check
// (mirrors the surat-jalan fix's friendly-409 pattern, see 92dce90) both
// gate the DB insert, run concurrently with the Storage upload below.
// recorded_at is intentionally never read from the request body — it is
// DEFAULT NOW() at the database level, so it stays server-authoritative
// regardless of what a spoofed client sends.
export async function POST(request: Request) {
  let storagePath: string | null = null
  try {
    const formData = await request.formData()
    const employeeId = (formData.get("employee_id") as string | null)?.trim()
    const site = (formData.get("site") as string | null)?.trim()
    const file = formData.get("file") as File | null
    const latitude = Number(formData.get("latitude"))
    const longitude = Number(formData.get("longitude"))
    const rawAccuracy = formData.get("accuracy") as string | null
    const accuracy = rawAccuracy ? Number(rawAccuracy) : null
    const deviceReportedAt = formData.get("device_reported_at") as string | null
    const turnstileToken = (formData.get("turnstile_token") as string | null) ?? ""

    if (!employeeId || !site || !file) {
      return NextResponse.json({ error: "Karyawan, site, dan foto wajib diisi" }, { status: 400 })
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Lokasi tidak valid — coba lagi" }, { status: 400 })
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null

    const ext = (file.type.split("/")[1] || "jpeg").split("+")[0]
    storagePath = `${sanitizePathSegment(employeeId)}/${Date.now()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    // Guards against a known WebKit bug (iOS Safari) where a File object
    // can serialize as an empty body over fetch's multipart FormData
    // encoding — the browser never errors, so without this the upload
    // would silently store/insert a 0-byte "photo". Surfacing it here
    // turns a silent failure into a specific, actionable client error.
    if (arrayBuffer.byteLength < 1024) {
      return NextResponse.json({ error: "File foto kosong atau rusak — coba lagi" }, { status: 400 })
    }

    const since = new Date(Date.now() - DEDUPE_WINDOW_MINUTES * 60_000).toISOString()
    const dupeParams = new URLSearchParams({
      employee_id:  `eq.${employeeId}`,
      site_name:    `eq.${site}`,
      recorded_at:  `gte.${since}`,
      select:       "id",
      limit:        "1",
    })

    // Turnstile verification, the duplicate-window check, and the selfie
    // upload have no data dependency on one another, so they run
    // concurrently instead of as a serial waterfall — this is most of the
    // 5s -> 0-3s latency win, since each was previously a full network
    // round-trip blocking the next. The Storage object is rolled back
    // (best-effort delete) if either gate fails after the upload lands.
    const [turnstileOk, dupeRes, uploadRes] = await Promise.all([
      verifyTurnstile(turnstileToken, ip),
      fetch(`${supabaseConfig.url}/rest/v1/attendance_logs?${dupeParams}`, { headers: headers() }),
      fetch(
        `${supabaseConfig.url}/storage/v1/object/${BUCKET}/${storagePath}`,
        { method: "POST", headers: storageHeaders(file.type || "image/jpeg"), body: Buffer.from(arrayBuffer) }
      ),
    ])

    if (!turnstileOk) {
      if (uploadRes.ok) await deleteStorageObject(storagePath)
      return NextResponse.json({ error: "Verifikasi keamanan gagal, silakan coba lagi" }, { status: 400 })
    }
    if (!dupeRes.ok) {
      if (uploadRes.ok) await deleteStorageObject(storagePath)
      throw new Error(await dupeRes.text())
    }
    const dupes = await dupeRes.json() as { id: string }[]
    if (dupes.length > 0) {
      if (uploadRes.ok) await deleteStorageObject(storagePath)
      return NextResponse.json(
        { error: "Anda sudah melakukan clock-in di lokasi ini beberapa menit lalu" },
        { status: 409 }
      )
    }
    if (!uploadRes.ok) throw new Error(`Storage error: ${await uploadRes.text()}`)

    const dbRes = await fetch(`${supabaseConfig.url}/rest/v1/attendance_logs`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify({
        employee_id:         employeeId,
        site_name:           site,
        selfie_storage_path: storagePath,
        latitude,
        longitude,
        location_accuracy_m: accuracy,
        device_reported_at:  deviceReportedAt,
        user_agent:          request.headers.get("user-agent"),
      }),
    })
    if (!dbRes.ok) {
      await deleteStorageObject(storagePath)
      const dbErrText = await dbRes.text()
      // Postgres 23503 = foreign_key_violation — employee_id doesn't exist
      // in public.employees. Friendlier than a raw 500 (mirrors the
      // surat-jalan duplicate-constraint mapping, see 92dce90).
      if (dbErrText.includes("23503") || dbErrText.includes("attendance_logs_employee_id_fkey")) {
        return NextResponse.json({ error: "ID Karyawan tidak ditemukan" }, { status: 400 })
      }
      // 23505 = unique_violation on attendance_logs_employee_date_unique —
      // this employee already has a row (clock-in or an HR-set status) for
      // today. The authoritative 1x/day guard; the dupeParams check above
      // only catches same-site rapid double-taps within the short window.
      if (dbErrText.includes("23505") || dbErrText.includes("attendance_logs_employee_date_unique")) {
        return NextResponse.json({ error: "Anda sudah melakukan clock-in hari ini" }, { status: 409 })
      }
      throw new Error(dbErrText)
    }
    const [data] = await dbRes.json()

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal melakukan clock-in" },
      { status: 500 }
    )
  }
}
