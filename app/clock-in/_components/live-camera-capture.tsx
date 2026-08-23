"use client"

import * as React from "react"
import { Camera, X, Loader2 } from "lucide-react"

// Anti-spoofing: renders our own in-page camera viewfinder via
// getUserMedia + a canvas snapshot, instead of an <input type="file"
// capture> element. A file input's `capture` attribute is only ever a
// hint — most mobile browsers still surface a "Photos" option alongside
// the camera in the native picker sheet, so a determined field tech
// could upload a pre-staged photo of the site. There is no OS file
// picker anywhere in this flow at all, so there is nothing to pick a
// gallery image from — the only pixels that can ever reach onCapture
// are ones the live sensor produced at the moment of the tap.
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
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
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
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl border bg-black shadow-sm">
        <video
          ref={videoRef}
          playsInline
          muted
          className="aspect-[4/3] w-full scale-x-[-1] object-cover"
        />
        {status === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm font-medium">Membuka kamera...</p>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 p-4 text-center text-white">
            <p className="text-sm font-medium">Tidak dapat mengakses kamera.</p>
            <p className="text-xs text-white/70">Pastikan izin kamera diaktifkan di pengaturan browser, lalu coba lagi.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 w-11 items-center justify-center rounded-full border text-muted-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={handleSnap}
          disabled={status !== "ready" || capturing}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {capturing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
        </button>
        <span className="h-11 w-11" />
      </div>
    </div>
  )
}
