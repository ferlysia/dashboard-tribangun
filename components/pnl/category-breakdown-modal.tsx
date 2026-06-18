"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MoneyInput } from "@/components/pnl/money-input"
import { formatThousands, type DetailCategoryConfig, type PnlDetailRow } from "@/lib/pnl"

type Draft = { tanggal: string; deskripsi: string; jumlah: number }

function fieldClass() {
  return "w-full bg-transparent text-sm text-zinc-100 outline-none border border-zinc-700 rounded-md px-2.5 py-2 placeholder:text-zinc-600 focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400"
}

function ColGroup({ hasDate }: { hasDate: boolean }) {
  return hasDate ? (
    <colgroup>
      <col className="w-[6%]" />
      <col className="w-[16%]" />
      <col className="w-[46%]" />
      <col className="w-[20%]" />
      <col className="w-[12%]" />
    </colgroup>
  ) : (
    <colgroup>
      <col className="w-[6%]" />
      <col className="w-[62%]" />
      <col className="w-[20%]" />
      <col className="w-[12%]" />
    </colgroup>
  )
}

function DetailRowForm({
  hasDate,
  initial,
  onSubmit,
  onCancel,
  saving,
}: {
  hasDate: boolean
  initial: Draft
  onSubmit: (draft: Draft) => void
  onCancel: () => void
  saving: boolean
}) {
  const [draft, setDraft] = React.useState<Draft>(initial)

  return (
    <tr className="bg-zinc-800/40">
      <td className="px-2 py-2" />
      {hasDate && (
        <td className="px-2 py-2">
          <input
            type="date"
            value={draft.tanggal}
            onChange={(e) => setDraft((d) => ({ ...d, tanggal: e.target.value }))}
            className={fieldClass()}
          />
        </td>
      )}
      <td className="px-2 py-2">
        <input
          value={draft.deskripsi}
          onChange={(e) => setDraft((d) => ({ ...d, deskripsi: e.target.value }))}
          placeholder="Deskripsi"
          autoFocus
          className={fieldClass()}
        />
      </td>
      <td className="px-2 py-2">
        <MoneyInput value={draft.jumlah} onChange={(v) => setDraft((d) => ({ ...d, jumlah: v }))} />
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1 justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => onSubmit(draft)}
            className="h-9 w-9 flex items-center justify-center rounded-md bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-9 w-9 flex items-center justify-center rounded-md border border-zinc-700 text-zinc-400 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function CategorySection({
  config,
  rows,
  apiBase,
  pnlId,
  onRowsChange,
}: {
  config: DetailCategoryConfig
  rows: PnlDetailRow[]
  apiBase: string
  pnlId: string | null
  onRowsChange: (rows: PnlDetailRow[]) => void
}) {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)

  const categoryRows = rows.filter((r) => r.category === config.key)
  const total = categoryRows.reduce((s, r) => s + Number(r.jumlah || 0), 0)
  const colCount = config.hasDate ? 4 : 3

  async function handleAdd(draft: Draft) {
    if (!pnlId) return
    if (!draft.deskripsi.trim()) {
      toast.error("Deskripsi wajib diisi")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pnl_id: pnlId,
          category: config.key,
          tanggal: draft.tanggal || null,
          deskripsi: draft.deskripsi,
          jumlah: draft.jumlah,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menambah baris")
      onRowsChange([...rows, data.data])
      setAdding(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menambah baris")
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(id: string, draft: Draft) {
    if (!draft.deskripsi.trim()) {
      toast.error("Deskripsi wajib diisi")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`${apiBase}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tanggal: draft.tanggal || null, deskripsi: draft.deskripsi, jumlah: draft.jumlah }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan baris")
      onRowsChange(rows.map((r) => (r.id === id ? data.data : r)))
      setEditingId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan baris")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error || "Gagal menghapus baris")
      onRowsChange(rows.filter((r) => r.id !== id))
      setConfirmDeleteId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus baris")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{config.label}</h3>
        <span className="text-xs text-zinc-500 tabular-nums">
          Subtotal: <span className="text-zinc-200 font-semibold">{formatThousands(String(total))}</span>
        </span>
      </div>
      <div className="rounded-xl border border-zinc-800/60 overflow-hidden">
        <table className="w-full table-fixed border-collapse">
          <ColGroup hasDate={config.hasDate} />
          <thead>
            <tr className="border-b border-zinc-800/60 bg-zinc-900/60">
              <th className="text-left py-2.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">No</th>
              {config.hasDate && (
                <th className="text-left py-2.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Tanggal</th>
              )}
              <th className="text-left py-2.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Deskripsi</th>
              <th className="text-right py-2.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Jumlah</th>
              <th className="py-2.5 px-2" />
            </tr>
          </thead>
          <tbody>
            {categoryRows.length === 0 && !adding && (
              <tr>
                <td colSpan={colCount + 1} className="px-2 py-4 text-center text-xs text-zinc-600">Belum ada data</td>
              </tr>
            )}
            {categoryRows.map((row, idx) =>
              editingId === row.id ? (
                <DetailRowForm
                  key={row.id}
                  hasDate={config.hasDate}
                  initial={{ tanggal: row.tanggal ?? "", deskripsi: row.deskripsi, jumlah: row.jumlah }}
                  saving={saving}
                  onSubmit={(draft) => handleUpdate(row.id, draft)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <tr key={row.id} className="border-b border-zinc-800/40 last:border-0 group hover:bg-zinc-800/30 transition-colors">
                  <td className="px-2 py-2.5 text-xs text-zinc-500">{idx + 1}</td>
                  {config.hasDate && (
                    <td className="px-2 py-2.5 text-sm text-zinc-400">
                      {row.tanggal
                        ? new Date(row.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
                        : "-"}
                    </td>
                  )}
                  <td className="px-2 py-2.5 text-sm text-zinc-200 truncate">{row.deskripsi}</td>
                  <td className="px-2 py-2.5 text-sm font-medium text-zinc-100 text-right tabular-nums">{formatThousands(String(row.jumlah))}</td>
                  <td className="px-2 py-2.5">
                    {confirmDeleteId === row.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button type="button" onClick={() => handleDelete(row.id)} className="px-2 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">Hapus?</button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} className="p-1 rounded text-zinc-500 hover:text-zinc-300"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => setEditingId(row.id)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => setConfirmDeleteId(row.id)} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            )}
            {adding && (
              <DetailRowForm
                hasDate={config.hasDate}
                initial={{ tanggal: "", deskripsi: "", jumlah: 0 }}
                saving={saving}
                onSubmit={handleAdd}
                onCancel={() => setAdding(false)}
              />
            )}
          </tbody>
        </table>
      </div>
      {!adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={!pnlId}
          className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800/60 text-[11px] font-medium text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Tambah {config.label}
        </button>
      )}
    </div>
  )
}

export function CategoryBreakdownModal({
  open,
  onOpenChange,
  title,
  description,
  categories,
  apiBase,
  pnlId,
  rows,
  onRowsChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  categories: DetailCategoryConfig[]
  apiBase: string
  pnlId: string | null
  rows: PnlDetailRow[]
  onRowsChange: (rows: PnlDetailRow[]) => void
}) {
  const grandTotal = rows.reduce((s, r) => s + Number(r.jumlah || 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-[1200px] max-h-[88vh] bg-zinc-950 border-zinc-800 text-zinc-100 p-0 flex flex-col gap-0">
        <DialogHeader className="border-b border-zinc-800/60 px-6 py-4">
          <DialogTitle className="text-zinc-100">{title}</DialogTitle>
          <DialogDescription className="text-zinc-500">{description}</DialogDescription>
          <p className="text-xs text-zinc-400 mt-1">
            Total gabungan: <span className="font-semibold text-zinc-100">{formatThousands(String(grandTotal))}</span>
          </p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {categories.map((config) => (
            <CategorySection key={config.key} config={config} rows={rows} apiBase={apiBase} pnlId={pnlId} onRowsChange={onRowsChange} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
