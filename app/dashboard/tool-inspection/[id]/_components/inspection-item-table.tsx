"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { ToolInspectionItem, ToolInspectionPhoto } from "@/lib/tool-inspection/types"
import { InspectionItemRow } from "./inspection-item-row"

// Virtualized so a 190-row site doesn't render 190 live rows (selects,
// inputs, photo cells) at once — the single biggest lag source on mobile.
// Mirrors the exact estimateSize/overscan/measureElement shape already used
// for purchasing-request's PR table.
export function InspectionItemTable({ inspectionId, items, onPatch, onPhotosChange }: {
  inspectionId:   string
  items:          ToolInspectionItem[]
  onPatch:        (itemId: string, patch: Partial<ToolInspectionItem>) => void
  onPhotosChange: (itemId: string, photos: ToolInspectionPhoto[]) => void
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count:             items.length,
    getScrollElement:  () => scrollRef.current,
    estimateSize:      () => 56,
    overscan:          8,
    measureElement:    (el) => el.getBoundingClientRect().height,
  })
  const virtualItems = virtualizer.getVirtualItems()
  const paddingTop    = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom = virtualItems.length > 0 ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end : 0

  return (
    <div className="rounded-lg border">
      <div className="grid grid-cols-12 gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
        <div className="col-span-1">No.</div>
        <div className="col-span-3">Tool / Equipment</div>
        <div className="col-span-2">Condition / Qty Used</div>
        <div className="col-span-2">Action / Remaining</div>
        <div className="col-span-1">Due Date</div>
        <div className="col-span-2">Photo (bad condition only)</div>
        <div className="col-span-1">Remarks</div>
      </div>
      {/* h-[65vh], not max-h — max-h alone has no intrinsic height, so on
          first render (before any rows exist) this div is 0px tall. The
          virtualizer measures that 0px viewport, computes zero visible
          rows, and nothing ever grows the container afterward — a
          permanent deadlock where getVirtualItems() stays empty forever. */}
      <div ref={scrollRef} className="h-[65vh] overflow-y-auto">
        <div style={{ height: paddingTop }} />
        {virtualItems.map(vi => {
          const item = items[vi.index]
          return (
            <div key={item.id} data-index={vi.index} ref={virtualizer.measureElement}>
              <InspectionItemRow
                inspectionId={inspectionId}
                item={item}
                onPatch={onPatch}
                onPhotosChange={onPhotosChange}
              />
            </div>
          )
        })}
        <div style={{ height: paddingBottom }} />
      </div>
    </div>
  )
}
