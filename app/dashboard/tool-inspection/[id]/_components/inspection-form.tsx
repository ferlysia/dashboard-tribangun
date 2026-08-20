"use client"

import * as React from "react"
import { CheckCircle2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { ToolInspectionItem, ToolInspectionPhoto } from "@/lib/tool-inspection/types"
import { useInspection, usePatchInspectionHeader, usePatchInspectionItem } from "../../_hooks/use-tool-inspection"
import { InspectionItemTable } from "./inspection-item-table"
import { SignaturePadField } from "./signature-pad-field"

const inputCls = "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-sm text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/40"

const AUTOSAVE_DEBOUNCE_MS = 800

export function InspectionForm({ inspectionId }: { inspectionId: string }) {
  const { data: inspection, isLoading } = useInspection(inspectionId)
  const patchHeader = usePatchInspectionHeader(inspectionId)
  const patchItem = usePatchInspectionItem(inspectionId)

  const [items, setItems] = React.useState<ToolInspectionItem[]>([])
  const initializedFor = React.useRef<string | null>(null)

  // Seed local state once per inspection load — after that, this component
  // owns the array (row edits + debounced autosave), so a background
  // refetch of the parent query must not clobber in-flight local edits.
  React.useEffect(() => {
    if (inspection && initializedFor.current !== inspection.id) {
      setItems(inspection.tool_inspection_items ?? [])
      initializedFor.current = inspection.id
    }
  }, [inspection])

  const pendingPatches = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const handlePatchItem = React.useCallback((itemId: string, patch: Partial<ToolInspectionItem>) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, ...patch } : it))

    const existing = pendingPatches.current.get(itemId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      pendingPatches.current.delete(itemId)
      patchItem.mutate({ itemId, patch }, {
        onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan perubahan item."),
      })
    }, AUTOSAVE_DEBOUNCE_MS)
    pendingPatches.current.set(itemId, timer)
  }, [patchItem])

  const handlePhotosChange = React.useCallback((itemId: string, photos: ToolInspectionPhoto[]) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, tool_inspection_photos: photos } : it))
  }, [])

  const summary = React.useMemo(() => {
    const total = items.length
    let good = 0, damaged = 0, missing = 0, repair = 0
    for (const it of items) {
      if (it.item_kind !== "ASSET") continue
      if (it.condition === "DAMAGED") damaged++
      else if (it.condition === "MISSING") missing++
      else if (it.condition === "REPAIR") repair++
      else good++
    }
    return { total, good, damaged, missing, repair }
  }, [items])

  const isSubmitted = inspection?.status === "SUBMITTED"
  const canSubmit = !!inspection?.inspected_by_signature && !!inspection?.responsible_signature

  const handleSaveSignature = (field: "inspected_by_signature" | "responsible_signature" | "reviewer_signature", dataUrl: string) => {
    patchHeader.mutate({ [field]: dataUrl }, {
      onSuccess: () => toast.success("Tanda tangan tersimpan."),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan tanda tangan."),
    })
  }

  const handleSubmit = () => {
    if (!canSubmit) {
      toast.error("Tanda tangan Inspected By dan Responsible Person wajib diisi sebelum submit.")
      return
    }
    patchHeader.mutate({ submit: true }, {
      onSuccess: () => toast.success("Weekly Tool Inspection Form disubmit."),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal submit form."),
    })
  }

  if (isLoading || !inspection) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Memuat form…</div>
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{inspection.week_label}</h2>
            <Badge variant={isSubmitted ? "default" : "secondary"}>
              {isSubmitted ? "Submitted" : "Draft"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{inspection.project_name} — {inspection.inspection_date}</p>
        </div>
        {isSubmitted ? (
          <Badge variant="outline" className="gap-1.5"><Lock className="h-3.5 w-3.5" /> Terkunci setelah submit</Badge>
        ) : (
          <Button size="sm" className="gap-1.5" disabled={!canSubmit || patchHeader.isPending} onClick={handleSubmit}>
            <CheckCircle2 className="h-4 w-4" /> Submit Inspection
          </Button>
        )}
      </div>

      <InspectionItemTable
        inspectionId={inspectionId}
        items={items}
        onPatch={handlePatchItem}
        onPhotosChange={handlePhotosChange}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm font-semibold">Weekly Summary</p>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Total Tools</p><p className="font-semibold">{summary.total}</p></div>
            <div><p className="text-xs text-muted-foreground">Good</p><p className="font-semibold">{summary.good}</p></div>
            <div><p className="text-xs text-muted-foreground">Damaged/Repair</p><p className="font-semibold">{summary.damaged + summary.repair}</p></div>
            <div><p className="text-xs text-muted-foreground">Missing</p><p className="font-semibold">{summary.missing}</p></div>
          </div>
          <div className="mt-4">
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Corrective Action / Important Notes</Label>
            <textarea
              className={`${inputCls} min-h-20`}
              defaultValue={inspection.corrective_notes ?? ""}
              disabled={isSubmitted}
              onBlur={e => patchHeader.mutate({ corrective_notes: e.target.value || null })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SignaturePadField
            label="Inspected By"
            name={inspection.inspector}
            value={inspection.inspected_by_signature}
            signedAt={inspection.inspected_by_signed_at}
            disabled={isSubmitted}
            onSave={(dataUrl) => handleSaveSignature("inspected_by_signature", dataUrl)}
          />
          <SignaturePadField
            label="Responsible Person"
            name={inspection.responsible_person}
            value={inspection.responsible_signature}
            signedAt={inspection.responsible_signed_at}
            disabled={isSubmitted}
            onSave={(dataUrl) => handleSaveSignature("responsible_signature", dataUrl)}
          />
          <SignaturePadField
            label="Project Manager / Review"
            name={inspection.reviewer_name ?? undefined}
            value={inspection.reviewer_signature}
            signedAt={inspection.reviewer_signed_at}
            disabled={isSubmitted}
            onSave={(dataUrl) => handleSaveSignature("reviewer_signature", dataUrl)}
          />
        </div>
      </div>
    </div>
  )
}
