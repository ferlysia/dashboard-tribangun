"use client"

import * as React from "react"
import Script from "next/script"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"
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

// iOS Safari's canvas.toBlob has spotty/inconsistent image/webp encode
// support (unlike Chrome/Android), so browser-image-compression can hand
// back a blob whose actual bytes don't match its labeled type there. jpeg
// is universally supported by canvas.toBlob across engines. The result is
// also explicitly rebuilt as a fresh File — Safari has been known to drop
// or mangle Blobs appended to FormData when they lack a real filename/type,
// so we never rely on whatever name/type the compression lib happened to
// preserve internally.
async function compressSelfie(file: File): Promise<File> {
  const imageCompression = (await import("browser-image-compression")).default
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.1,
    maxWidthOrHeight: 720,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.8,
  })
  return new File([compressed], "selfie.jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  })
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

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 p-6">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setTurnstileReady(true)}
      />

      <div>
        <h1 className="text-lg font-semibold">Clock In</h1>
        <p className="text-sm text-muted-foreground">Isi nama dan lokasi, lalu ambil foto untuk clock-in.</p>
      </div>

      <EmployeeCombobox
        employees={employees}
        value={employee}
        onChange={setEmployee}
        disabled={isPending}
      />

      <input
        value={site}
        onChange={e => setSite(e.target.value)}
        placeholder="Lokasi / Site"
        disabled={isPending}
        className="rounded border px-3 py-2"
      />

      {/* Invisible Turnstile widget — no user interaction, just proof-of-browser
          before the API route does any Storage/DB work. */}
      <div ref={turnstileContainerRef} />

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded bg-primary py-3 font-medium text-primary-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-60">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {isPending ? (statusText ?? "Memproses...") : failed ? "Coba Lagi" : "Capture & Clock In"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          disabled={isPending || !employee || !site.trim()}
          onChange={e => handleCapture(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  )
}
