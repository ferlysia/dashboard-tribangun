"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

export function GlobalSearchBar({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <div className="sticky top-0 z-20 -mx-6 px-6 py-2.5 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm border-b border-rose-100 dark:border-slate-800">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-400 pointer-events-none" />
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Cari No. PO, Vendor, atau No. Invoice..."
          className="pl-9 pr-8 h-10 text-sm rounded-xl border-rose-200 dark:border-slate-700 focus-visible:ring-rose-300 dark:focus-visible:ring-fuchsia-800"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
            title="Bersihkan pencarian"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
