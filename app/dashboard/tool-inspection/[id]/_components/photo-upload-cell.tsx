"use client"

import * as React from "react"
import { Camera, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { ToolInspectionPhoto } from "@/lib/tool-inspection/types"
import { useUploadInspectionPhoto, useDeleteInspectionPhoto } from "../../_hooks/use-tool-inspection"

// Aggressive client-side compression before the photo ever leaves the
// browser — this is what protects the free-tier Storage quota, not
// anything server-side. maxSizeMB 0.3 + webp keeps a typical site photo
// under ~150-300KB regardless of the original camera resolution.
async function compress(file: File): Promise<File> {
  const imageCompression = (await import("browser-image-compression")).default
  return imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: "image/webp",
  })
}

export function PhotoUploadCell({ inspectionId, itemId, photos, onPhotosChange }: {
  inspectionId:    string
  itemId:          string
  photos:          ToolInspectionPhoto[]
  onPhotosChange:  (photos: ToolInspectionPhoto[]) => void
}) {
  const uploadPhoto = useUploadInspectionPhoto(inspectionId)
  const deletePhoto = useDeleteInspectionPhoto(inspectionId)
  const [compressing, setCompressing] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | null) => {
    if (!file) return
    setCompressing(true)
    try {
      const compressed = await compress(file)
      const photo = await uploadPhoto.mutateAsync({ itemId, file: compressed })
      onPhotosChange([...photos, photo])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah foto.")
    } finally {
      setCompressing(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const handleDelete = async (photoId: string) => {
    try {
      await deletePhoto.mutateAsync({ itemId, photoId })
      onPhotosChange(photos.filter(p => p.id !== photoId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus foto.")
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {photos.map(photo => (
        <div key={photo.id} className="group relative h-10 w-10 shrink-0 overflow-hidden rounded border">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage URL, no next.config remotePatterns set up in this project */}
          <img src={photo.url} alt="Bukti kondisi" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => handleDelete(photo.id)}
            className="absolute inset-0 hidden items-center justify-center bg-black/60 group-hover:flex"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
      ))}
      <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded border border-dashed text-muted-foreground hover:border-primary hover:text-primary">
        {compressing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={compressing}
          onChange={e => handleFile(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  )
}
