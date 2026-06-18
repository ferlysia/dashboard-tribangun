"use client"

import * as React from "react"
import { Search } from "lucide-react"
import type { PnlPackage } from "@/lib/pnl"

function inputClass() {
  return "w-full bg-zinc-900 border border-zinc-800/60 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400"
}

export function PackageSelector({
  perusahaan,
  npwp,
  projectName,
  onPerusahaanChange,
  onNpwpChange,
  onProjectNameChange,
  onCommit,
  onSelectPackage,
}: {
  perusahaan: string
  npwp: string
  projectName: string
  onPerusahaanChange: (v: string) => void
  onNpwpChange: (v: string) => void
  onProjectNameChange: (v: string) => void
  onCommit: () => void
  onSelectPackage: (pkg: PnlPackage) => void
}) {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<PnlPackage[]>([])
  const [open, setOpen] = React.useState(false)
  const [searching, setSearching] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const openRef = React.useRef(open)
  openRef.current = open
  const onCommitRef = React.useRef(onCommit)
  onCommitRef.current = onCommit

  React.useEffect(() => {
    if (!open) return
    const handle = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/pnl/packages?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.data ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(handle)
  }, [query, open])

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (openRef.current) {
          setOpen(false)
          onCommitRef.current()
        }
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  function handleSelect(pkg: PnlPackage) {
    onPerusahaanChange(pkg.perusahaan)
    onNpwpChange(pkg.npwp)
    onProjectNameChange(pkg.project_name)
    setQuery("")
    setOpen(false)
    onSelectPackage(pkg)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1.2fr] gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Perusahaan</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              value={perusahaan}
              onChange={(e) => {
                onPerusahaanChange(e.target.value)
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => {
                setQuery(perusahaan)
                setOpen(true)
              }}
              placeholder="Cari atau ketik nama perusahaan..."
              className={inputClass() + " pl-8"}
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">NPWP</label>
          <input
            value={npwp}
            onChange={(e) => {
              onNpwpChange(e.target.value)
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              setQuery(npwp)
              setOpen(true)
            }}
            placeholder="NPWP"
            className={inputClass()}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Project Name</label>
          <input
            value={projectName}
            onChange={(e) => {
              onProjectNameChange(e.target.value)
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              setQuery(projectName)
              setOpen(true)
            }}
            placeholder="Nama project..."
            className={inputClass()}
          />
        </div>
      </div>

      {open && query.trim().length > 0 && (
        <div className="absolute z-20 mt-1 w-full sm:w-[680px] max-h-72 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
          {searching && <div className="px-3 py-2.5 text-xs text-zinc-500">Mencari...</div>}
          {!searching && results.length === 0 && (
            <div className="px-3 py-2.5 text-xs text-zinc-500">Tidak ditemukan — akan dibuat sebagai paket baru saat disimpan.</div>
          )}
          {!searching &&
            results.map((pkg) => (
              <button
                key={`${pkg.perusahaan}||${pkg.project_name}`}
                type="button"
                onClick={() => handleSelect(pkg)}
                className="w-full text-left px-3 py-2.5 hover:bg-zinc-800/60 border-b border-zinc-800/40 last:border-0"
              >
                <div className="text-sm text-zinc-100 font-medium">{pkg.project_name || "(Tanpa nama project)"}</div>
                <div className="text-xs text-zinc-500">{pkg.perusahaan || "-"} &middot; NPWP {pkg.npwp || "-"}</div>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
