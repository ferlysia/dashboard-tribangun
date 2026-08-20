"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import type SignatureCanvas from "react-signature-canvas"
import { Button } from "@/components/ui/button"
import { Eraser, Check } from "lucide-react"

// react-signature-canvas draws to an actual <canvas>, which has no SSR
// representation — load it client-only so `next build` doesn't choke on it.
// Cast needed because next/dynamic's generic loses the class component's
// ref typing — react-signature-canvas is a real class component at runtime
// (ref-forwarding works fine), this only fixes the TS surface.
const SignatureCanvasImpl = dynamic(() => import("react-signature-canvas"), { ssr: false }) as unknown as typeof SignatureCanvas

// Stored as a compact base64 PNG data URI directly on the tool_inspections
// row (see the schema's signature columns) rather than uploaded to Storage
// — a signature is a few KB of ink, not worth a bucket + upload round trip.
export function SignaturePadField({ label, name, value, signedAt, onSave, disabled }: {
  label:      string
  name?:      string
  value:      string | null
  signedAt:   string | null
  onSave:     (dataUrl: string) => void
  disabled?:  boolean
}) {
  const padRef = React.useRef<SignatureCanvas | null>(null)
  const [editing, setEditing] = React.useState(false)

  const handleClear = () => padRef.current?.clear()

  const handleSave = () => {
    if (!padRef.current || padRef.current.isEmpty()) return
    // trimmed PNG at native canvas resolution — small (a few KB) since it's
    // mostly transparent background with a thin ink path.
    const dataUrl = padRef.current.getTrimmedCanvas().toDataURL("image/png")
    onSave(dataUrl)
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>

      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="rounded border bg-white">
            <SignatureCanvasImpl
              ref={padRef}
              penColor="black"
              canvasProps={{ className: "h-32 w-full touch-none" }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleClear}>
              <Eraser className="h-3.5 w-3.5" /> Bersihkan
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={handleSave}>
              <Check className="h-3.5 w-3.5" /> Simpan
            </Button>
          </div>
        </div>
      ) : value ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setEditing(true)}
          className="flex h-20 items-center justify-center rounded border bg-white disabled:cursor-not-allowed"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- inline base64 data URI, next/image adds no value here */}
          <img src={value} alt={`Tanda tangan ${label}`} className="h-full object-contain" />
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setEditing(true)}
          className="flex h-20 items-center justify-center rounded border border-dashed text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:hover:border-inherit disabled:hover:text-inherit"
        >
          Ketuk untuk tanda tangan
        </button>
      )}

      {(name || signedAt) && (
        <p className="text-[11px] text-muted-foreground">
          {name}{name && signedAt ? " — " : ""}{signedAt ? new Date(signedAt).toLocaleString("id-ID") : ""}
        </p>
      )}
    </div>
  )
}
