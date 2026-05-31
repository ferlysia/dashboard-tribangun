"use client"

/**
 * AdminDeleteProject
 *
 * A self-contained, ADMIN-only project purge control.
 * - Hidden entirely for non-ADMIN users (role check from session cookie via /api/auth/me).
 * - Two-step confirmation: user must type "HAPUS" before the destructive button activates.
 * - Calls DELETE /api/projects/[key] which runs an atomic DB cascade via Supabase RPC.
 * - On success: fires `onDeleted` so the parent page can clear its local state.
 *
 * Usage:
 *   <AdminDeleteProject
 *     projectKey="project_425"
 *     projectName="Proyek Instalasi SCADA PT XYZ"
 *     onDeleted={() => { setActiveKey(null); reloadSummary() }}
 *   />
 */

import * as React       from "react"
import { Trash2, AlertTriangle, X, RefreshCw, ShieldAlert } from "lucide-react"
import { useCurrentUser } from "@/components/providers/current-user-provider"

type Props = {
  projectKey:  string
  projectName: string
  onDeleted:   () => void
}

export function AdminDeleteProject({ projectKey, projectName, onDeleted }: Props) {
  const { user } = useCurrentUser()
  const [open,    setOpen]    = React.useState(false)
  const [confirm, setConfirm] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error,   setError]   = React.useState<string | null>(null)

  // Render nothing for non-ADMIN — component is invisible in the DOM
  if (user.role !== "ADMIN") return null

  const canDelete = confirm.trim().toUpperCase() === "HAPUS"

  const handleDelete = async () => {
    if (!canDelete || loading) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectKey)}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Gagal menghapus proyek."); return }
      setOpen(false)
      onDeleted()
    } catch { setError("Tidak dapat terhubung ke server.") }
    finally  { setLoading(false) }
  }

  const closeModal = () => {
    if (loading) return
    setOpen(false); setConfirm(""); setError(null)
  }

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Hapus seluruh data proyek ini (ADMIN)"
        aria-label="Hapus proyek"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Hapus Proyek
      </button>

      {/* ── Confirmation modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-100 overflow-hidden">

            {/* Header */}
            <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-neutral-100">
              <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 id="delete-modal-title" className="text-sm font-black text-neutral-900 mb-0.5">
                  Hapus Proyek Secara Permanen
                </h2>
                <p className="text-[11px] text-neutral-500 leading-snug">
                  Tindakan ini tidak dapat dibatalkan. Semua data lintas divisi akan terhapus.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                title="Tutup"
                aria-label="Tutup modal"
                className="flex-shrink-0 p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-4">

              {/* Project identity */}
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Proyek yang akan dihapus</p>
                <p className="text-sm font-bold text-neutral-900 truncate">{projectName}</p>
                <p className="text-[10px] font-mono text-neutral-400 mt-0.5">{projectKey}</p>
              </div>

              {/* What gets deleted */}
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-amber-700 mb-1">Data yang akan dihapus permanen:</p>
                  <ul className="text-[10px] text-amber-600 space-y-0.5 list-disc list-inside">
                    <li>Data master proyek (Doc Con)</li>
                    <li>Semua log mingguan &amp; fase jadwal</li>
                    <li>Semua entri biaya Cost Control</li>
                    <li>Eskalasi VO &amp; termin invoice Finance</li>
                  </ul>
                  <p className="text-[10px] text-amber-500 mt-1.5 font-semibold">
                    Invoice keuangan (tabel invoices) tidak terpengaruh.
                  </p>
                </div>
              </div>

              {/* Type-to-confirm */}
              <div>
                <label
                  htmlFor="delete-confirm-input"
                  className="block text-[11px] font-bold text-neutral-700 mb-1.5"
                >
                  Ketik <span className="font-black text-red-600 tracking-widest">HAPUS</span> untuk mengaktifkan tombol hapus:
                </label>
                <input
                  id="delete-confirm-input"
                  type="text"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="HAPUS"
                  autoFocus
                  autoComplete="off"
                  disabled={loading}
                  onKeyDown={e => { if (e.key === "Enter" && canDelete) handleDelete() }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold tracking-widest outline-none transition-all ${
                    canDelete
                      ? "border-red-400 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-500/20"
                      : "border-neutral-200 bg-neutral-50 text-neutral-700 focus:border-neutral-400"
                  }`}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 pb-6">
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-600 border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete || loading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {loading
                  ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Menghapus…</>
                  : <><Trash2    className="h-3.5 w-3.5" />              Hapus Permanen</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
