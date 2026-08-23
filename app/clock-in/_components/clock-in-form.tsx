"use client"

import * as React from "react"
import Script from "next/script"
import { Camera, CheckCircle2, Clock, Loader2, MapPin, ShieldAlert, X } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useClockIn } from "../_hooks/use-clock-in"
import { AttendanceHistory } from "./attendance-history"
import { EmployeeCombobox, type Employee } from "./employee-combobox"
import { LiveCameraCapture } from "./live-camera-capture"

// How long a cached geolocation fix is trusted before submit re-acquires
// one. Kept short — this is an anti-fraud lock, not a convenience cache.
const POSITION_MAX_AGE_MS = 20_000

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; size: "invisible"; callback: (token: string) => void }
      ) => string
      reset: (widgetId: string) => void
    }
  }
}

// iOS Safari has a WebKit bug where a `File` object (including the one
// browser-image-compression constructs internally — its return type is
// Promise<File>) can serialize as an empty 0-byte body when sent through
// fetch's multipart FormData encoding: .size still reports correctly and
// nothing throws client-side, but the real bytes never reach the request
// (see https://github.com/jaydenseric/apollo-upload-client/issues/54).
// Reading the bytes back out via .arrayBuffer() happens in-memory, before
// that serialization step, so rebuilding a plain Blob (never a File) from
// them sidesteps the bug entirely. FormData.append's 3rd-arg filename
// covers naming — a Blob doesn't need to be a File for that.
async function compressSelfie(file: File): Promise<Blob> {
  const imageCompression = (await import("browser-image-compression")).default
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.1,
    maxWidthOrHeight: 720,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.8,
  })
  const bytes = await compressed.arrayBuffer()
  return new Blob([bytes], { type: "image/jpeg" })
}

function getPositionOnce(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

// Two-stage acquisition: a fast network-based fix covers the common
// outdoor case in ~5s; concrete basements/rural sites often can't get a
// GPS lock at all, so falling back to a longer high-accuracy attempt is
// what actually resolves indoors (via WiFi/cell triangulation) rather than
// just failing outright at 8s like a single-attempt call would.
async function getPosition(onSearching?: (stage: "fast" | "precise") => void): Promise<GeolocationPosition> {
  if (!("geolocation" in navigator)) {
    throw new Error("Geolocation tidak didukung perangkat ini.")
  }
  try {
    onSearching?.("fast")
    return await getPositionOnce({ enableHighAccuracy: false, timeout: 5000, maximumAge: 0 })
  } catch {
    onSearching?.("precise")
    return await getPositionOnce({ enableHighAccuracy: true, timeout: 18000, maximumAge: 0 })
  }
}

type GeoStatus = "checking" | "granted" | "prompt" | "denied" | "unsupported"

// Isolated into its own component so the once-a-second re-render this
// causes never touches the parent form's tree (geolocation banner,
// employee/site state, submit pipeline) — ticking a clock must not cost
// anything against the zero-lag capture path.
function LiveClock() {
  const [now, setNow] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const dateLabel = now?.toLocaleDateString("id-ID", {
    weekday:  "long",
    day:      "numeric",
    month:    "long",
    year:     "numeric",
    timeZone: "Asia/Jakarta",
  })
  const timeLabel = now?.toLocaleTimeString("id-ID", {
    hour:     "2-digit",
    minute:   "2-digit",
    second:   "2-digit",
    timeZone: "Asia/Jakarta",
  })

  return (
    <div className="mx-5 mt-3 flex shrink-0 items-center justify-between gap-3 rounded-hr-2xl border border-hr-hairline bg-white px-4 py-3 shadow-hr-card">
      <div className="min-w-0">
        <p className="truncate font-hr-sans text-[11px] font-semibold capitalize text-hr-text-2">{dateLabel ?? "—"}</p>
        <p className="font-hr-display text-2xl font-black tabular-nums text-hr-ink">{timeLabel ?? "--:--:--"}</p>
      </div>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-hr-blush-100 text-hr-rose-deep">
        <Clock className="h-5 w-5" />
      </span>
    </div>
  )
}

export function ClockInForm({ employees }: { employees: Employee[] }) {
  const clockIn = useClockIn()
  const [isPending, startTransition] = React.useTransition()
  const [employee, setEmployee] = React.useState<Employee | null>(null)
  const [site, setSite] = React.useState("")
  const [statusText, setStatusText] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [turnstileReady, setTurnstileReady] = React.useState(false)
  const turnstileTokenRef = React.useRef<string>("")
  const turnstileContainerRef = React.useRef<HTMLDivElement>(null)
  const turnstileWidgetIdRef = React.useRef<string | null>(null)

  // Camera is now a live in-page viewfinder (see LiveCameraCapture), not
  // an OS file picker — "camera" phase takes over the screen; the normal
  // form (and the preview/processing overlay below) render otherwise.
  const [phase, setPhase] = React.useState<"idle" | "camera">("idle")

  // Presentational only — shows the captured selfie while it uploads, so
  // the flow feels like a native camera app instead of a silent black
  // box. Never touches the compression/upload pipeline below.
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const previewUrlRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  // Big, unmissable, screenshot-friendly success state — the small toast
  // this replaces was easy to miss at the bottom of the screen, and field
  // techs want proof they can screenshot. Deliberately persistent: it
  // stays up (and the form stays untouched underneath) until the tech
  // explicitly closes it, rather than auto-dismissing out from under them
  // mid-screenshot.
  const [successInfo, setSuccessInfo] = React.useState<{ name: string; time: string; dateLabel: string } | null>(null)

  const dismissSuccess = React.useCallback(() => {
    setSuccessInfo(null)
    setEmployee(null)
    setSite("")
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreviewUrl(null)
  }, [])

  // Background geo-lock acquisition: fired on mount instead of on button
  // press, so the (often multi-second) fix is already sitting in
  // positionRef by the time the worker has picked their name, entered the
  // site, and tapped capture — the single biggest latency win available,
  // since it moves acquisition off the submit critical path entirely in
  // the common case. Submit re-acquires only if this fix has gone stale.
  const positionRef = React.useRef<GeolocationPosition | null>(null)
  const positionFetchedAtRef = React.useRef(0)

  const acquirePosition = React.useCallback(async (onSearching?: (stage: "fast" | "precise") => void) => {
    const position = await getPosition(onSearching)
    positionRef.current = position
    positionFetchedAtRef.current = Date.now()
    return position
  }, [])

  const getFreshPosition = React.useCallback(async (onSearching?: (stage: "fast" | "precise") => void) => {
    if (positionRef.current && Date.now() - positionFetchedAtRef.current < POSITION_MAX_AGE_MS) {
      return positionRef.current
    }
    return acquirePosition(onSearching)
  }, [acquirePosition])

  React.useEffect(() => {
    acquirePosition().catch(() => { /* retried at submit time; silent here */ })
  }, [acquirePosition])

  // Strict GPS guard: proactively checks permission state so a denied/
  // unavailable location blocks the capture button up front, instead of
  // only failing after the user has already taken (and compressed) a
  // photo. The Permissions API's "geolocation" query isn't supported
  // everywhere (older Safari) — falls back to a direct probe there.
  const [geoStatus, setGeoStatus] = React.useState<GeoStatus>("checking")

  React.useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unsupported")
      return
    }
    let cancelled = false
    const settle = (next: GeoStatus) => { if (!cancelled) setGeoStatus(next) }

    const permissions = navigator.permissions
    if (permissions?.query) {
      permissions.query({ name: "geolocation" as PermissionName })
        .then(status => {
          const sync = () => settle(status.state === "granted" ? "granted" : status.state === "denied" ? "denied" : "prompt")
          sync()
          status.onchange = sync
        })
        .catch(() => {
          acquirePosition().then(() => settle("granted")).catch(() => settle("denied"))
        })
    } else {
      acquirePosition().then(() => settle("granted")).catch(() => settle("denied"))
    }

    return () => { cancelled = true }
  }, [acquirePosition])

  const retryGeo = () => {
    setGeoStatus("checking")
    acquirePosition().then(() => setGeoStatus("granted")).catch(() => setGeoStatus("denied"))
  }

  // Explicit rendering (not the implicit data-attribute API) so the
  // callback can write straight into a ref instead of needing a global
  // named function on window.
  React.useEffect(() => {
    if (!turnstileReady || !turnstileContainerRef.current || !window.turnstile) return
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!sitekey) {
      console.warn("NEXT_PUBLIC_TURNSTILE_SITE_KEY not set — Turnstile widget will not render.")
      return
    }
    turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey,
      size: "invisible",
      callback: token => { turnstileTokenRef.current = token },
    })
  }, [turnstileReady])

  const handleCapture = (file: File | null) => {
    if (!file || !employee || !site.trim()) return
    setFailed(false)

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setPreviewUrl(url)

    startTransition(async () => {
      try {
        setStatusText("Memproses...")
        // Position (usually already cached from mount) and compression have
        // no dependency on each other, so they run concurrently instead of
        // as a sequential wait — the rest of the 5s -> 0-3s latency win.
        const [position, compressed] = await Promise.all([
          getFreshPosition(stage =>
            setStatusText(stage === "fast" ? "Mencari lokasi..." : "Mencari lokasi (dalam ruangan)...")
          ),
          compressSelfie(file),
        ])

        setStatusText("Mengirim...")
        await clockIn.mutateAsync({
          employeeId: employee.employee_id,
          site: site.trim(),
          file: compressed,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          speed: position.coords.speed,
          deviceReportedAt: new Date().toISOString(),
          turnstileToken: turnstileTokenRef.current,
        })

        const now = new Date()
        const clockTime = now.toLocaleTimeString("id-ID", {
          hour:     "2-digit",
          minute:   "2-digit",
          timeZone: "Asia/Jakarta",
        })
        const dateLabel = now.toLocaleDateString("id-ID", {
          weekday:  "long",
          day:      "numeric",
          month:    "long",
          year:     "numeric",
          timeZone: "Asia/Jakarta",
        })
        setSuccessInfo({ name: employee.full_name, time: clockTime, dateLabel })
      } catch (err) {
        // No manual-location fallback on failure — that would defeat the
        // geo-lock's anti-fraud purpose. Surface a retry action instead.
        setFailed(true)
        toast.error(err instanceof Error ? err.message : "Gagal melakukan absen.")
      } finally {
        setStatusText(null)
        if (turnstileWidgetIdRef.current) window.turnstile?.reset(turnstileWidgetIdRef.current)
      }
    })
  }

  const handleFrameCaptured = (blob: Blob) => {
    setPhase("idle")
    handleCapture(new File([blob], "capture.jpg", { type: "image/jpeg", lastModified: Date.now() }))
  }

  const geoBlocked = geoStatus === "denied" || geoStatus === "unsupported"
  const canCapture = !isPending && !!employee && !!site.trim() && !geoBlocked

  return (
    // .clockin-light strictly pins this page to the light shadcn tokens
    // regardless of the device's OS theme — see globals.css for why a
    // scoped class beats fighting next-themes globally.
    <div className="clockin-light">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setTurnstileReady(true)}
      />
      {/* Invisible Turnstile widget — kept mounted across both phases (not
          inside either branch below) so switching into camera mode never
          unmounts the container the widget was rendered into; doing so
          would silently orphan it and break subsequent submits. */}
      <div ref={turnstileContainerRef} />

      {phase === "camera" ? (
        <LiveCameraCapture onCapture={handleFrameCaptured} onCancel={() => setPhase("idle")} />
      ) : (
        <div className="flex min-h-dvh flex-col overflow-x-hidden bg-hr-surface">
          <header className="flex shrink-0 items-center gap-3 px-5 pb-1 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <img
              src="/logo pt.jpg"
              alt="PT Tri Bangun Usaha Persada"
              className="h-10 w-10 shrink-0 rounded-lg object-contain"
            />
            <div className="min-w-0">
              <p className="truncate font-hr-sans text-[11px] font-semibold uppercase tracking-hr-wide text-hr-text-2">
                PT Tri Bangun Usaha Persada
              </p>
              <h1 className="font-hr-display text-lg font-black leading-tight text-hr-ink">Absen</h1>
            </div>
          </header>

          <LiveClock />

          <main className="min-h-0 flex-1 overflow-y-auto px-5">
            {geoBlocked && (
              <div className="mb-4 mt-4 flex flex-col items-center gap-2 rounded-hr-2xl border border-hr-danger/30 bg-hr-danger/5 p-4 text-center">
                <ShieldAlert className="h-5 w-5 text-hr-danger-deep" />
                <p className="font-hr-sans text-sm font-semibold text-hr-danger-deep">Lokasi (GPS) tidak aktif</p>
                <p className="font-hr-sans text-xs text-hr-text-2">
                  {geoStatus === "unsupported"
                    ? "Perangkat/browser ini tidak mendukung layanan lokasi."
                    : "Aktifkan izin lokasi di pengaturan browser untuk melakukan absen."}
                  {" "}Tanpa GPS, absen tidak dapat dilakukan.
                </p>
                <button
                  type="button"
                  onClick={retryGeo}
                  className="mt-1 rounded-hr-lg border border-hr-hairline px-3 py-1.5 font-hr-sans text-xs font-semibold active:scale-95"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-4 rounded-hr-3xl border border-hr-hairline bg-white p-4 shadow-hr-card">
              <EmployeeCombobox
                employees={employees}
                value={employee}
                onChange={setEmployee}
                disabled={isPending}
              />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="site" className="font-hr-sans text-[11px] font-semibold uppercase tracking-hr-wide text-hr-text-2">
                  Lokasi / Site
                </Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hr-text-3" />
                  <Input
                    id="site"
                    value={site}
                    onChange={e => setSite(e.target.value)}
                    disabled={isPending}
                    className="h-14 rounded-hr-xl border-hr-hairline pl-9 font-hr-sans text-base"
                  />
                </div>
              </div>
            </div>

            {/* Lazy: only mounts (and only fires its own network request)
                once an employee is picked — never blocks or delays the
                capture form's initial render or the geolocation/Turnstile
                warm-up above. */}
            {employee && <AttendanceHistory employeeId={employee.employee_id} />}

            {previewUrl && (
              <div className="relative mt-4 overflow-hidden rounded-hr-3xl border border-hr-hairline bg-white shadow-hr-card">
                <img src={previewUrl} alt="Foto selfie" className="aspect-[4/3] w-full object-cover" />
                {isPending && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p className="font-hr-sans text-sm font-medium">{statusText ?? "Memproses..."}</p>
                  </div>
                )}
              </div>
            )}

            <p className="mt-4 pb-4 text-center font-hr-sans text-xs text-hr-text-3">
              Pastikan wajah terlihat jelas dan GPS aktif sebelum mengambil foto.
            </p>
          </main>

          <div className="shrink-0 border-t border-hr-hairline bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="button"
              onClick={() => setPhase("camera")}
              disabled={!canCapture}
              aria-disabled={!canCapture}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-hr-2xl bg-hr-brand font-hr-sans text-base font-semibold text-white shadow-hr-brand transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              {isPending ? (statusText ?? "Memproses...") : failed ? "Coba Lagi" : "Ambil Foto & Absen"}
            </button>
          </div>
        </div>
      )}

      {/* Large, screenshot-friendly success state. Persistent by design —
          stays up until the tech explicitly closes it (see dismissSuccess)
          rather than auto-dismissing out from under a screenshot attempt.
          Sits above everything, including the camera phase (which has
          already been switched back to "idle" by the time this renders),
          so there's zero ambiguity that the absen landed. */}
      {successInfo && (
        <div
          role="status"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-hr-cream-100 px-6 animate-hr-fade-up"
        >
          <button
            type="button"
            onClick={dismissSuccess}
            aria-label="Tutup"
            className="absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-white text-hr-text-2 shadow-hr-card active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>

          <span className="grid h-24 w-24 place-items-center rounded-full bg-hr-success-grad shadow-hr-success animate-hr-badge-pop">
            <CheckCircle2 className="h-14 w-14 text-white" strokeWidth={2.5} />
          </span>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <p className="font-hr-display text-2xl font-black text-hr-ink">Absen Berhasil!</p>
            <p className="font-hr-sans text-sm font-medium text-hr-text-2">{successInfo.name}</p>
            <p className="font-hr-sans text-sm font-semibold capitalize text-hr-ink">{successInfo.dateLabel}</p>
            <p className="font-hr-sans text-xs text-hr-text-3">Tercatat pukul {successInfo.time} WIB</p>
          </div>

          <button
            type="button"
            onClick={dismissSuccess}
            className="mt-4 rounded-hr-2xl bg-hr-brand px-8 py-3 font-hr-sans text-sm font-semibold text-white shadow-hr-brand active:scale-[0.98]"
          >
            Tutup
          </button>
        </div>
      )}
    </div>
  )
}
