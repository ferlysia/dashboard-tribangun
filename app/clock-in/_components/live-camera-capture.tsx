"use client"

import * as React from "react"
import { X, Loader2 } from "lucide-react"

// Anti-spoofing: renders our own in-page camera viewfinder via
// getUserMedia + a canvas snapshot, instead of an <input type="file"
// capture> element. A file input's `capture` attribute is only ever a
// hint — most mobile browsers still surface a "Photos" option alongside
// the camera in the native picker sheet, so a determined field tech
// could upload a pre-staged photo of the site. There is no OS file
// picker anywhere in this flow at all, so there is nothing to pick a
// gallery image from — the only pixels that can ever reach onCapture
// are ones the live sensor produced at the moment of the tap.
//
// Full-bleed `fixed inset-0` layout (rather than a bounded card) so this
// reads as a native OS camera app, not an embedded widget — the single
// biggest ask behind this redesign.
export function LiveCameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (blob: Blob) => void
  onCancel:  () => void
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [status, setStatus] = React.useState<"starting" | "ready" | "error">("starting")
  const [capturing, setCapturing] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus("ready")
      } catch {
        if (!cancelled) setStatus("error")
      }
    }
    start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const handleSnap = () => {
    const video = videoRef.current
    if (!video || status !== "ready" || capturing) return
    setCapturing(true)

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setCapturing(false)
      return
    }
    // Draws the raw sensor frame — unaffected by the CSS mirror applied
    // to the <video> preview below, so the saved photo reads naturally
    // (not left-right flipped) for whoever reviews it later.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      blob => {
        if (blob) onCapture(blob)
        setCapturing(false)
      },
      "image/jpeg",
      0.92
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
      />

      {/* Framing guide — decorative, mirrors the oval face outline native
          camera selfie modes show, purely to help technicians center
          themselves at a glance. */}
      {status === "ready" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="aspect-[3/4] h-[52%] rounded-[50%] border-2 border-white/40" />
        </div>
      )}

      {status === "starting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-white">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="text-sm font-medium">Membuka kamera...</p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black p-6 text-center text-white">
          <p className="text-sm font-medium">Tidak dapat mengakses kamera.</p>
          <p className="text-xs text-white/70">Pastikan izin kamera diaktifkan di pengaturan browser, lalu coba lagi.</p>
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 rounded-full border border-white/30 px-4 py-2 text-xs font-semibold"
          >
            Kembali
          </button>
        </div>
      )}

      {/* Top bar — cancel only; kept minimal so the viewfinder stays the focus. */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Batal"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium text-white/90">Ambil Selfie</span>
        <span className="h-10 w-10" />
      </div>

      {/* Bottom bar — large native-style shutter, scrim keeps it legible
          over any background. */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/70 to-transparent px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10">
        <button
          type="button"
          onClick={handleSnap}
          disabled={status !== "ready" || capturing}
          aria-label="Ambil foto"
          className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-white bg-white/20 shadow-lg backdrop-blur-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {capturing
            ? <Loader2 className="h-7 w-7 animate-spin text-white" />
            : <span className="h-14 w-14 rounded-full bg-white" />}
        </button>
      </div>
    </div>
  )
}
