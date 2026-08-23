"use client"

import * as React from "react"
import Script from "next/script"
import { Camera, Loader2, MapPin } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useClockIn } from "../_hooks/use-clock-in"
import { EmployeeCombobox, type Employee } from "./employee-combobox"

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
  const inputRef = React.useRef<HTMLInputElement>(null)

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
          deviceReportedAt: new Date().toISOString(),
          turnstileToken: turnstileTokenRef.current,
        })

        toast.success("Clock-in berhasil.")
        setEmployee(null)
        setSite("")
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current)
          previewUrlRef.current = null
        }
        setPreviewUrl(null)
      } catch (err) {
        // No manual-location fallback on failure — that would defeat the
        // geo-lock's anti-fraud purpose. Surface a retry action instead.
        setFailed(true)
        toast.error(err instanceof Error ? err.message : "Gagal melakukan clock-in.")
      } finally {
        setStatusText(null)
        if (inputRef.current) inputRef.current.value = ""
        if (turnstileWidgetIdRef.current) window.turnstile?.reset(turnstileWidgetIdRef.current)
      }
    })
  }

  const canCapture = !isPending && !!employee && !!site.trim()

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-muted/30">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setTurnstileReady(true)}
      />

      <header className="flex shrink-0 items-center gap-3 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <img
          src="/logo pt.jpg"
          alt="PT Tri Bangun Usaha Persada"
          className="h-10 w-10 shrink-0 rounded-lg object-contain"
        />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            PT Tri Bangun Usaha Persada
          </p>
          <h1 className="text-lg font-bold leading-tight">Clock In</h1>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-5">
        <div className="flex flex-col gap-4 rounded-2xl border bg-background p-4 shadow-sm">
          <EmployeeCombobox
            employees={employees}
            value={employee}
            onChange={setEmployee}
            disabled={isPending}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="site" className="text-xs text-muted-foreground">Lokasi / Site</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="site"
                value={site}
                onChange={e => setSite(e.target.value)}
                placeholder="mis. Site Bekasi"
                disabled={isPending}
                className="h-14 pl-9 text-base"
              />
            </div>
          </div>
        </div>

        {previewUrl && (
          <div className="relative mt-4 overflow-hidden rounded-2xl border bg-background shadow-sm">
            <img src={previewUrl} alt="Foto selfie" className="aspect-[4/3] w-full object-cover" />
            {isPending && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm font-medium">{statusText ?? "Memproses..."}</p>
              </div>
            )}
          </div>
        )}

        <p className="mt-4 pb-4 text-center text-xs text-muted-foreground">
          Pastikan wajah terlihat jelas dan GPS aktif sebelum mengambil foto.
        </p>
      </main>

      {/* Invisible Turnstile widget — no user interaction, just proof-of-browser
          before the API route does any Storage/DB work. */}
      <div ref={turnstileContainerRef} />

      <div className="shrink-0 border-t bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <label
          aria-disabled={!canCapture}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-lg transition active:scale-[0.98] aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          {isPending ? (statusText ?? "Memproses...") : failed ? "Coba Lagi" : "Ambil Foto & Clock In"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            disabled={!canCapture}
            onChange={e => handleCapture(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </div>
  )
}
