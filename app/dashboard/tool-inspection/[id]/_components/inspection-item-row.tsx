"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { Condition, ToolInspectionItem, ToolInspectionPhoto } from "@/lib/tool-inspection/types"
import { isBadCondition } from "@/lib/tool-inspection/types"
import { PhotoUploadCell } from "./photo-upload-cell"

const inputCls = "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-sm text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/40"

const CONDITION_BADGE: Record<Condition, "default" | "destructive" | "secondary"> = {
  GOOD:    "default",
  DAMAGED: "destructive",
  MISSING: "destructive",
  REPAIR:  "secondary",
}

interface Props {
  inspectionId:   string
  item:           ToolInspectionItem
  onPatch:        (itemId: string, patch: Partial<ToolInspectionItem>) => void
  onPhotosChange: (itemId: string, photos: ToolInspectionPhoto[]) => void
}

function InspectionItemRowImpl({ inspectionId, item, onPatch, onPhotosChange }: Props) {
  const photos = item.tool_inspection_photos ?? []

  const handleConditionChange = (next: Condition) => {
    // Flipping a bad-condition item back to GOOD orphans any evidence photos
    // semantically (the UI rule is "photos only for bad-condition assets"),
    // so ask before silently leaving them attached to a now-GOOD row.
    if (!isBadCondition(next) && photos.length > 0) {
      const confirmed = window.confirm(
        `Item ini punya ${photos.length} foto. Ubah ke "${next}" akan menghapus foto tersebut. Lanjutkan?`
      )
      if (!confirmed) return
      photos.forEach(p => {
        fetch(`/api/tool-inspections/${inspectionId}/items/${item.id}/photo?photo_id=${p.id}`, { method: "DELETE" })
          .catch(() => { /* best-effort */ })
      })
      onPhotosChange(item.id, [])
    }
    onPatch(item.id, { condition: next })
  }

  return (
    <div className="grid grid-cols-12 items-start gap-2 border-b px-3 py-2 text-sm">
      <div className="col-span-1 pt-1.5 text-xs text-muted-foreground">{item.line_no}</div>

      <div className="col-span-3 pt-1.5">
        <p className="font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">{item.qty} {item.unit}{item.asset_no ? ` · ${item.asset_no}` : ""}</p>
      </div>

      {item.item_kind === "ASSET" ? (
        <>
          <div className="col-span-2">
            <Select value={item.condition ?? "GOOD"} onValueChange={(v) => handleConditionChange(v as Condition)}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue>
                  <Badge variant={CONDITION_BADGE[item.condition ?? "GOOD"]} className="text-[10px]">
                    {item.condition ?? "GOOD"}
                  </Badge>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GOOD">Good</SelectItem>
                <SelectItem value="DAMAGED">Damaged</SelectItem>
                <SelectItem value="MISSING">Missing</SelectItem>
                <SelectItem value="REPAIR">Repair</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <input
              className={inputCls}
              placeholder="Action required"
              defaultValue={item.action_required ?? ""}
              onBlur={e => onPatch(item.id, { action_required: e.target.value || null })}
            />
          </div>
          <div className="col-span-1">
            <input
              type="date"
              className={inputCls}
              defaultValue={item.due_date ?? ""}
              onChange={e => onPatch(item.id, { due_date: e.target.value || null })}
            />
          </div>
          <div className="col-span-2">
            {isBadCondition(item.condition) ? (
              <PhotoUploadCell
                inspectionId={inspectionId}
                itemId={item.id}
                photos={photos}
                onPhotosChange={(next) => onPhotosChange(item.id, next)}
              />
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="col-span-2">
            <input
              type="number" min={0} step="any"
              className={inputCls}
              placeholder="Qty used"
              defaultValue={item.qty_used ?? 0}
              onBlur={e => {
                const used = Number(e.target.value) || 0
                onPatch(item.id, { qty_used: used, qty_remaining: Math.max(item.qty - used, 0) })
              }}
            />
          </div>
          <div className="col-span-2 pt-1.5 text-xs text-muted-foreground">
            Sisa: {item.qty_remaining ?? item.qty} {item.unit}
          </div>
          <div className="col-span-1" />
          <div className="col-span-2" />
        </>
      )}

      <div className="col-span-1">
        <input
          className={inputCls}
          placeholder="Remarks"
          defaultValue={item.remarks ?? ""}
          onBlur={e => onPatch(item.id, { remarks: e.target.value || null })}
        />
      </div>
    </div>
  )
}

// The list is 30-190 rows; without memoization every keystroke in one row
// re-renders the entire virtualized list. Equality check covers the fields
// that actually change per row plus the photo array reference.
export const InspectionItemRow = React.memo(InspectionItemRowImpl, (prev, next) =>
  prev.item === next.item && prev.onPatch === next.onPatch && prev.onPhotosChange === next.onPhotosChange
)
