"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MoneyInput } from "@/components/pnl/money-input"
import { computeGajiJumlah, formatThousands, type PnlGajiCalcMode, type PnlGajiRow } from "@/lib/pnl"

type Draft = {
  nama: string
  nik: string
  tahun: string
  ptkp: string
  upah: number
  hari: number
  calc_mode: PnlGajiCalcMode
}

const EMPTY_DRAFT: Draft = { nama: "", nik: "", tahun: "", ptkp: "", upah: 0, hari: 0, calc_mode: "multiply" }

function fieldClass() {
  return "w-full bg-transparent text-sm text-zinc-100 outline-none border border-zinc-700 rounded-md px-2.5 py-2 placeholder:text-zinc-600 focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400"
}

function ColGroup() {
  return (
    <colgroup>
      <col className="w-[4%]" />
      <col className="w-[17%]" />
      <col className="w-[14%]" />
      <col className="w-[7%]" />
      <col className="w-[8%]" />
      <col className="w-[13%]" />
      <col className="w-[6%]" />
      <col className="w-[12%]" />
      <col className="w-[13%]" />
      <col className="w-[6%]" />
    </colgroup>
  )
}

function GajiRowForm({
  initial,
  onSubmit,
  onCancel,
  saving,
}: {
  initial: Draft
  onSubmit: (draft: Draft) => void
  onCancel: () => void
  saving: boolean
}) {
  const [draft, setDraft] = React.useState<Draft>(initial)
  const jumlah = computeGajiJumlah(draft.upah, draft.hari, draft.calc_mode)

  return (
    <tr className="bg-zinc-800/40">
      <td className="px-2 py-2" />
      <td className="px-2 py-2">
        <input
          value={draft.nama}
          onChange={(e) => setDraft((d) => ({ ...d, nama: e.target.value }))}
          placeholder="Nama lengkap"
          autoFocus
          className={fieldClass()}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={draft.nik}
          onChange={(e) => setDraft((d) => ({ ...d, nik: e.target.value.replace(/\D/g, "") }))}
          placeholder="16 digit NIK"
          inputMode="numeric"
          className={fieldClass()}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={draft.tahun}
          onChange={(e) => setDraft((d) => ({ ...d, tahun: e.target.value.replace(/\D/g, "") }))}
          placeholder="Tahun"
          inputMode="numeric"
          className={fieldClass()}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={draft.ptkp}
          onChange={(e) => setDraft((d) => ({ ...d, ptkp: e.target.value }))}
          placeholder="PTKP"
          className={fieldClass()}
        />
      </td>
      <td className="px-2 py-2">
        <MoneyInput value={draft.upah} onChange={(v) => setDraft((d) => ({ ...d, upah: v }))} />
      </td>
      <td className="px-2 py-2 text-center">
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, calc_mode: d.calc_mode === "multiply" ? "add" : "multiply" }))}
          title="Ganti rumus: Upah x Hari atau Upah + Hari"
          className="h-9 w-9 flex items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:border-zinc-500 text-sm font-semibold"
        >
          {draft.calc_mode === "multiply" ? "×" : "+"}
        </button>
      </td>
      <td className="px-2 py-2">
        <MoneyInput value={draft.hari} onChange={(v) => setDraft((d) => ({ ...d, hari: v }))} />
      </td>
      <td className="px-2 py-2 text-right text-sm text-zinc-100 tabular-nums">{formatThousands(String(jumlah)) || "0"}</td>
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

export function GajiModal({
  open,
  onOpenChange,
  pnlId,
  rows,
  onRowsChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pnlId: string | null
  rows: PnlGajiRow[]
  onRowsChange: (rows: PnlGajiRow[]) => void
}) {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)

  const total = rows.reduce((s, r) => s + Number(r.jumlah || 0), 0)

  async function handleAdd(draft: Draft) {
    if (!pnlId) return
    if (!draft.nama.trim()) {
      toast.error("Nama wajib diisi")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/pnl/gaji", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pnl_id: pnlId, ...draft, tahun: draft.tahun || null }),
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
    if (!draft.nama.trim()) {
      toast.error("Nama wajib diisi")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/pnl/gaji/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, tahun: draft.tahun || null }),
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
      const res = await fetch(`/api/pnl/gaji/${id}`, { method: "DELETE" })
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[1400px] max-h-[88vh] bg-zinc-950 border-zinc-800 text-zinc-100 p-0 flex flex-col gap-0">
        <DialogHeader className="border-b border-zinc-800/60 px-6 py-4">
          <DialogTitle className="text-zinc-100">Rincian Beban Gaji</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Total baris ini otomatis menjadi nilai Komersial pada baris BEBAN GAJI di laporan utama.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="rounded-xl border border-zinc-800/60 overflow-hidden">
            <table className="w-full table-fixed border-collapse">
              <ColGroup />
              <thead>
                <tr className="border-b border-zinc-800/60 bg-zinc-900/60">
                  <th className="text-left py-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">No</th>
                  <th className="text-left py-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Nama</th>
                  <th className="text-left py-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">NIK</th>
                  <th className="text-left py-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Tahun</th>
                  <th className="text-left py-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">PTKP</th>
                  <th className="text-right py-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Upah</th>
                  <th className="text-center py-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Rumus</th>
                  <th className="text-right py-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Hari</th>
                  <th className="text-right py-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Jumlah</th>
                  <th className="py-3 px-2" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !adding && (
                  <tr>
                    <td colSpan={10} className="px-2 py-6 text-center text-xs text-zinc-600">Belum ada data</td>
                  </tr>
                )}

                {rows.map((row, idx) =>
                  editingId === row.id ? (
                    <GajiRowForm
                      key={row.id}
                      initial={{
                        nama: row.nama,
                        nik: row.nik,
                        tahun: row.tahun ? String(row.tahun) : "",
                        ptkp: row.ptkp,
                        upah: row.upah,
                        hari: row.hari,
                        calc_mode: row.calc_mode,
                      }}
                      saving={saving}
                      onSubmit={(draft) => handleUpdate(row.id, draft)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr key={row.id} className="border-b border-zinc-800/40 last:border-0 group hover:bg-zinc-800/30 transition-colors">
                      <td className="px-2 py-3 text-xs text-zinc-500">{idx + 1}</td>
                      <td className="px-2 py-3 text-sm text-zinc-200 truncate">{row.nama}</td>
                      <td className="px-2 py-3 text-sm text-zinc-400 tabular-nums truncate">{row.nik || "-"}</td>
                      <td className="px-2 py-3 text-sm text-zinc-400">{row.tahun ?? "-"}</td>
                      <td className="px-2 py-3 text-sm text-zinc-400 truncate">{row.ptkp || "-"}</td>
                      <td className="px-2 py-3 text-sm text-zinc-300 text-right tabular-nums">{formatThousands(String(row.upah))}</td>
                      <td className="px-2 py-3 text-center text-sm text-zinc-500">{row.calc_mode === "multiply" ? "×" : "+"}</td>
                      <td className="px-2 py-3 text-sm text-zinc-300 text-right tabular-nums">{formatThousands(String(row.hari))}</td>
                      <td className="px-2 py-3 text-sm font-semibold text-zinc-100 text-right tabular-nums">{formatThousands(String(row.jumlah))}</td>
                      <td className="px-2 py-3">
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
                  <GajiRowForm initial={EMPTY_DRAFT} saving={saving} onSubmit={handleAdd} onCancel={() => setAdding(false)} />
                )}

                <tr className="bg-zinc-900/60">
                  <td colSpan={8} className="px-2 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">Total</td>
                  <td className="px-2 py-3 text-right text-sm font-bold text-zinc-100 tabular-nums">{formatThousands(String(total))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={!pnlId}
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800/60 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah Baris
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
