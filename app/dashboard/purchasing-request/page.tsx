"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar }  from "@/components/app-sidebar"
import { SiteHeader }  from "@/components/site-header"
import { Toaster }     from "@/components/ui/sonner"
import { toast }       from "sonner"
import { useCurrentUser } from "@/components/providers/current-user-provider"
import { Button }      from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Separator }   from "@/components/ui/separator"
import {
  Search, Plus, FileText, CheckCircle2,
  Clock, RefreshCw, ChevronRight, X, ShoppingCart, Package,
  Truck, Receipt, UploadCloud, Trash2, Ban, ArrowRight, Download,
} from "lucide-react"
import type { PRStatus, SJStatus, PurchaseRequestItem, PurchaseRequestRecord } from "@/types/purchase-request"

// ─── Constants ───────────────────────────────────────────────────────────────

const SATUAN_OPTIONS = ["Pcs", "Set", "Mtr", "Pack", "Roll"]

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

const STATUS_CFG: Record<PRStatus, { label: string; badge: string }> = {
  DRAFT:           { label: "Draft",                  badge: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300" },
  WAITING_PAYMENT: { label: "Menunggu Pembayaran",     badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  PURCHASED:       { label: "Sudah Dibayar",           badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  COMPLETED:       { label: "Selesai / Terkirim",      badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  REJECTED:        { label: "Ditolak",                 badge: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400" },
}

const SJ_STATUS_CFG: Record<Exclude<SJStatus, null>, { label: string; badge: string }> = {
  PENDING_SIGNED_SJ: { label: "Menunggu Surat Jalan", badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  BILLING_READY:     { label: "Siap Billing",         badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
}

const LEGAL_TRANSITIONS: Record<PRStatus, { to: PRStatus; label: string }[]> = {
  DRAFT:           [{ to: "WAITING_PAYMENT", label: "Setujui → Menunggu Pembayaran" }],
  WAITING_PAYMENT: [{ to: "PURCHASED",       label: "Tandai Sudah Dibayar" }],
  PURCHASED:       [{ to: "COMPLETED",       label: "Tandai Selesai / Terkirim" }],
  COMPLETED:       [],
  REJECTED:        [],
}

const STATUS_FILTERS: (PRStatus | "ALL")[] = ["ALL", "DRAFT", "WAITING_PAYMENT", "PURCHASED", "COMPLETED", "REJECTED"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthNameId(iso: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  return `${MONTH_NAMES_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function quarterLabel(iso: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  const q = Math.floor(d.getUTCMonth() / 3) + 1
  return `Q${q} Tahun ${d.getUTCFullYear()}`
}

function fDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

let tempIdCounter = 0
function nextTempId() {
  tempIdCounter += 1
  return `draft-${tempIdCounter}`
}

interface ItemDraft {
  tempId:      string
  qty:         string
  satuan:      string
  nama_barang: string
}

function blankItem(): ItemDraft {
  return { tempId: nextTempId(), qty: "1", satuan: "Pcs", nama_barang: "" }
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string | number
  sub?: string; accent?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <div className={`mt-0.5 rounded-lg p-2 shrink-0 ${accent ?? "bg-muted"}`}>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground tracking-tight leading-none mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ─── StatusFilterChips ────────────────────────────────────────────────────────

function StatusFilterChips({ active, onChange, counts }: {
  active:   PRStatus | "ALL"
  onChange: (s: PRStatus | "ALL") => void
  counts:   Record<PRStatus | "ALL", number>
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {STATUS_FILTERS.map(s => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`h-7 px-3 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
            active === s
              ? "bg-foreground text-background shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          }`}
        >
          {s === "ALL" ? "Semua" : STATUS_CFG[s].label}
          <span className={`ml-1.5 text-[10px] ${active === s ? "opacity-60" : "opacity-50"}`}>{counts[s]}</span>
        </button>
      ))}
    </div>
  )
}

// ─── ItemsTable (read-only, used in detail drawer) ───────────────────────────

function ItemsTable({ items }: { items: PurchaseRequestItem[] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider w-10">No</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider w-16">Qty</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider w-20">Satuan</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider">Nama Barang</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map(it => (
            <tr key={it.id}>
              <td className="px-3 py-2 text-muted-foreground">{it.line_no}</td>
              <td className="px-3 py-2 text-foreground">{it.qty}</td>
              <td className="px-3 py-2 text-foreground">{it.satuan}</td>
              <td className="px-3 py-2 text-foreground">{it.nama_barang}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── CreatePRSheet ────────────────────────────────────────────────────────────

function CreatePRSheet({ open, onClose, onCreated }: {
  open:      boolean
  onClose:   () => void
  onCreated: () => void
}) {
  const { user } = useCurrentUser()
  const today = new Date().toISOString().split("T")[0]

  const [siteMaintenance, setSiteMaintenance] = React.useState("")
  const [unit, setUnit]                       = React.useState("")
  const [tanggal, setTanggal]                 = React.useState(today)
  const [notes, setNotes]                     = React.useState("")
  const [items, setItems]                     = React.useState<ItemDraft[]>([blankItem()])
  const [saving, setSaving]                   = React.useState(false)

  const reset = React.useCallback(() => {
    setSiteMaintenance("")
    setUnit("")
    setTanggal(today)
    setNotes("")
    setItems([blankItem()])
  }, [today])

  const addItem    = () => setItems(prev => [...prev, blankItem()])
  const removeItem = (tempId: string) => setItems(prev => prev.filter(i => i.tempId !== tempId))
  const updateItem = (tempId: string, patch: Partial<ItemDraft>) =>
    setItems(prev => prev.map(i => i.tempId === tempId ? { ...i, ...patch } : i))

  const validItems = items.filter(i => Number(i.qty) > 0 && i.satuan.trim() && i.nama_barang.trim())
  const canSubmit = siteMaintenance.trim() && unit.trim() && tanggal && validItems.length > 0 && !saving

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error("Lengkapi Site Maintenance, Unit, Tanggal, dan minimal satu item.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/purchase-requests", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_maintenance:   siteMaintenance.trim(),
          unit:                unit.trim(),
          permintaan_tanggal:  tanggal,
          notes:               notes.trim() || undefined,
          requested_by:        user.email || undefined,
          items: validItems.map(i => ({
            qty:         Number(i.qty),
            satuan:      i.satuan.trim(),
            nama_barang: i.nama_barang.trim(),
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`PR ${data.data.pr_no} berhasil dibuat.`)
      reset()
      onCreated()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat PR.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Buat Purchasing Request</p>
              <p className="text-xs text-muted-foreground mt-0.5">PR NO dibuat otomatis saat disimpan</p>
            </div>
            <button type="button" aria-label="Close panel" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">
          {/* Auto-derived preview */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">PR NO</p>
              <p className="text-xs text-muted-foreground italic mt-0.5">otomatis</p>
            </div>
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Periode</p>
              <p className="text-xs text-foreground font-medium mt-0.5">{monthNameId(tanggal)}</p>
            </div>
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">KET</p>
              <p className="text-xs text-foreground font-medium mt-0.5">{quarterLabel(tanggal)}</p>
            </div>
          </div>

          {/* Manual header fields */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground">Site Maintenance</label>
              <input
                type="text"
                value={siteMaintenance}
                onChange={e => setSiteMaintenance(e.target.value)}
                placeholder="e.g. TTC TB SIMATUPANG"
                className="mt-1.5 w-full rounded-lg border border-border bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all placeholder:text-muted-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">Unit</label>
                <input
                  type="text"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="e.g. JKS016/L10/CLM/060/084"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all placeholder:text-muted-foreground font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Permintaan Tanggal</label>
                <input
                  type="date"
                  title="Permintaan Tanggal"
                  value={tanggal}
                  onChange={e => setTanggal(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Catatan (opsional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Catatan internal..."
                className="mt-1.5 w-full rounded-lg border border-border bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all resize-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <Separator />

          {/* Dynamic items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Daftar Barang</p>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Tambah Item
              </Button>
            </div>

            <datalist id="satuan-options">
              {SATUAN_OPTIONS.map(s => <option key={s} value={s} />)}
            </datalist>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.tempId} className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5">
                  <span className="text-xs text-muted-foreground w-5 mt-2 shrink-0">{idx + 1}</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={item.qty}
                    onChange={e => updateItem(item.tempId, { qty: e.target.value })}
                    placeholder="Qty"
                    title="Qty"
                    className="w-16 rounded-md border border-border bg-background text-xs text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  <input
                    type="text"
                    list="satuan-options"
                    value={item.satuan}
                    onChange={e => updateItem(item.tempId, { satuan: e.target.value })}
                    placeholder="Satuan"
                    title="Satuan"
                    className="w-24 rounded-md border border-border bg-background text-xs text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  <input
                    type="text"
                    value={item.nama_barang}
                    onChange={e => updateItem(item.tempId, { nama_barang: e.target.value })}
                    placeholder="Nama Barang"
                    title="Nama Barang"
                    className="flex-1 min-w-0 rounded-md border border-border bg-background text-xs text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  <button
                    type="button"
                    aria-label="Remove item"
                    onClick={() => removeItem(item.tempId)}
                    disabled={items.length === 1}
                    className="text-muted-foreground hover:text-red-500 transition-colors mt-1.5 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full h-9 text-sm gap-2">
            <ShoppingCart className="h-3.5 w-3.5" />
            {saving ? "Menyimpan…" : "Buat PR"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── PRDetailSheet ────────────────────────────────────────────────────────────

function PRDetailSheet({ pr, open, onClose, onUpdated }: {
  pr:        PurchaseRequestRecord | null
  open:      boolean
  onClose:   () => void
  onUpdated: (updated: PurchaseRequestRecord) => void
}) {
  const { user } = useCurrentUser()
  const [rejecting, setRejecting] = React.useState(false)
  const [reason, setReason]       = React.useState("")
  const [busy, setBusy]           = React.useState(false)

  React.useEffect(() => {
    if (!open) { setRejecting(false); setReason("") }
  }, [open])

  if (!pr) return null

  const changeStatus = async (status: PRStatus, rejection_reason?: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/purchase-requests/${pr.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status, rejection_reason, actor_email: user.email || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onUpdated({ ...pr, ...data.data })
      toast.success(`Status PR diubah menjadi ${STATUS_CFG[status].label}.`)
      setRejecting(false)
      setReason("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status.")
    } finally {
      setBusy(false)
    }
  }

  const transitions = LEGAL_TRANSITIONS[pr.status]
  const canReject    = pr.status === "DRAFT" || pr.status === "WAITING_PAYMENT" || pr.status === "PURCHASED"

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold text-foreground">{pr.pr_no}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{pr.site_maintenance}</p>
            </div>
            <button type="button" aria-label="Close panel" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 py-5 space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_CFG[pr.status].badge}`}>
              {STATUS_CFG[pr.status].label}
            </span>
            {pr.sj_status && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SJ_STATUS_CFG[pr.sj_status].badge}`}>
                {SJ_STATUS_CFG[pr.sj_status].label}
              </span>
            )}
          </div>

          {pr.status === "REJECTED" && pr.rejection_reason && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2.5">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">Alasan penolakan</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">{pr.rejection_reason}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Unit",               value: pr.unit },
              { label: "Permintaan Tanggal", value: fDate(pr.permintaan_tanggal) },
              { label: "Periode",            value: monthNameId(pr.permintaan_tanggal) },
              { label: "KET",                value: quarterLabel(pr.permintaan_tanggal) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-sm text-foreground font-medium truncate mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {pr.notes && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
              <p className="text-xs text-amber-800 dark:text-amber-300">📌 {pr.notes}</p>
            </div>
          )}

          {pr.sj_document_url && (
            <a
              href={pr.sj_document_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground hover:bg-muted/70 transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">Dokumen Surat Jalan</span>
              <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </a>
          )}

          <Separator />

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Daftar Barang</p>
            <ItemsTable items={pr.items} />
          </div>

          {(transitions.length > 0 || canReject) && (
            <>
              <Separator />
              <div className="space-y-2">
                {transitions.map(t => (
                  <Button
                    key={t.to}
                    onClick={() => changeStatus(t.to)}
                    disabled={busy}
                    className="w-full h-9 text-sm gap-2"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    {t.label}
                  </Button>
                ))}

                {canReject && !rejecting && (
                  <Button
                    variant="outline"
                    onClick={() => setRejecting(true)}
                    disabled={busy}
                    className="w-full h-9 text-sm gap-2 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Tolak / Batalkan PR
                  </Button>
                )}

                {canReject && rejecting && (
                  <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10 p-3 space-y-2">
                    <label className="text-xs font-medium text-foreground">Alasan penolakan (wajib diisi)</label>
                    <textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      rows={2}
                      placeholder="Contoh: budget tidak tersedia, barang habis, dibatalkan manajemen..."
                      className="w-full rounded-lg border border-border bg-background text-xs text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all resize-none placeholder:text-muted-foreground"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setRejecting(false); setReason("") }} className="flex-1 h-8 text-xs">
                        Batal
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => changeStatus("REJECTED", reason)}
                        disabled={!reason.trim() || busy}
                        className="flex-1 h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                      >
                        Konfirmasi Tolak
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── WarehouseTab ─────────────────────────────────────────────────────────────

function WarehouseTab({ prs, onUploaded }: {
  prs:        PurchaseRequestRecord[]
  onUploaded: (updated: PurchaseRequestRecord) => void
}) {
  const { user } = useCurrentUser()
  const pending = prs.filter(p => p.status === "COMPLETED" && p.sj_status === "PENDING_SIGNED_SJ")
  const uploadTargetRef = React.useRef<string | null>(null)
  const fileInputRef    = React.useRef<HTMLInputElement>(null)
  const [uploadingId, setUploadingId] = React.useState<string | null>(null)

  const triggerUpload = (prId: string) => {
    uploadTargetRef.current = prId
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const prId = uploadTargetRef.current
    e.target.value = ""
    if (!file || !prId) return

    setUploadingId(prId)
    try {
      const formData = new FormData()
      formData.append("file", file)
      if (user.email) formData.append("uploaded_by", user.email)

      const res = await fetch(`/api/purchase-requests/${prId}/surat-jalan`, { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onUploaded(data.data)
      toast.success("Surat Jalan berhasil diunggah.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah Surat Jalan.")
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" title="Upload Surat Jalan" className="hidden" onChange={handleFileChange} />
      {pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Truck className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Tidak ada PR yang menunggu Surat Jalan.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["PR NO", "Site Maintenance", "Unit", "Tanggal Selesai", ""].map((col, i) => (
                    <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pending.map(pr => (
                  <tr key={pr.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-foreground whitespace-nowrap">{pr.pr_no}</td>
                    <td className="px-4 py-3 text-xs text-foreground max-w-[180px] truncate">{pr.site_maintenance}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{pr.unit}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fDate(pr.updated_at)}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        disabled={uploadingId === pr.id}
                        onClick={() => triggerUpload(pr.id)}
                      >
                        <UploadCloud className="h-3.5 w-3.5" />
                        {uploadingId === pr.id ? "Mengunggah…" : "Upload SJ"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── BillingTab ───────────────────────────────────────────────────────────────

function BillingTab({ prs }: { prs: PurchaseRequestRecord[] }) {
  const ready = prs.filter(p => p.sj_status === "BILLING_READY")
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const toggleAll = () => {
    setSelected(prev => prev.size === ready.length ? new Set() : new Set(ready.map(p => p.id)))
  }

  const downloadSelected = () => {
    const targets = ready.filter(p => selected.has(p.id) && p.sj_document_url)
    if (targets.length === 0) {
      toast.error("Pilih minimal satu PR untuk diunduh.")
      return
    }
    targets.forEach(p => window.open(p.sj_document_url!, "_blank"))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">{selected.size} dari {ready.length} dipilih</p>
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={downloadSelected} disabled={selected.size === 0}>
          <Download className="h-3.5 w-3.5" />
          Download Terpilih
        </Button>
      </div>

      {ready.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Receipt className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Belum ada PR yang siap billing.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" title="Pilih semua" checked={ready.length > 0 && selected.size === ready.length} onChange={toggleAll} />
                  </th>
                  {["PR NO", "Site Maintenance", "Unit", "SJ Diunggah", "Dokumen"].map((col, i) => (
                    <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ready.map(pr => (
                  <tr key={pr.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" title={`Pilih ${pr.pr_no}`} checked={selected.has(pr.id)} onChange={() => toggle(pr.id)} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-foreground whitespace-nowrap">{pr.pr_no}</td>
                    <td className="px-4 py-3 text-xs text-foreground max-w-[180px] truncate">{pr.site_maintenance}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{pr.unit}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fDate(pr.sj_uploaded_at)}</td>
                    <td className="px-4 py-3">
                      {pr.sj_document_url && (
                        <a href={pr.sj_document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <FileText className="h-3.5 w-3.5" /> Lihat
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PurchasingRequestPage() {
  const [prs, setPrs]                 = React.useState<PurchaseRequestRecord[]>([])
  const [loading, setLoading]         = React.useState(true)
  const [searchQuery, setQ]           = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<PRStatus | "ALL">("ALL")
  const [createOpen, setCreateOpen]   = React.useState(false)
  const [selected, setSelected]       = React.useState<PurchaseRequestRecord | null>(null)
  const [detailOpen, setDetailOpen]   = React.useState(false)

  const loadPrs = React.useCallback(() => {
    setLoading(true)
    fetch("/api/purchase-requests")
      .then(r => r.json())
      .then(({ data }) => setPrs(data ?? []))
      .catch(() => toast.error("Gagal memuat data Purchasing Request."))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { loadPrs() }, [loadPrs])

  const applyUpdate = (updated: PurchaseRequestRecord) => {
    setPrs(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
    setSelected(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev)
  }

  const openDetail = (pr: PurchaseRequestRecord) => { setSelected(pr); setDetailOpen(true) }

  const counts = React.useMemo(() => {
    const c = { ALL: prs.length } as Record<PRStatus | "ALL", number>
    ;(["DRAFT", "WAITING_PAYMENT", "PURCHASED", "COMPLETED", "REJECTED"] as PRStatus[]).forEach(s => {
      c[s] = prs.filter(p => p.status === s).length
    })
    return c
  }, [prs])

  const filtered = React.useMemo(() => {
    let result = prs
    if (statusFilter !== "ALL") result = result.filter(p => p.status === statusFilter)
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(p =>
        p.pr_no.toLowerCase().includes(q) ||
        p.site_maintenance.toLowerCase().includes(q) ||
        p.unit.toLowerCase().includes(q)
      )
    }
    return result
  }, [prs, statusFilter, searchQuery])

  const warehousePendingCount = React.useMemo(
    () => prs.filter(p => p.status === "COMPLETED" && p.sj_status === "PENDING_SIGNED_SJ").length,
    [prs]
  )
  const billingReadyCount = React.useMemo(
    () => prs.filter(p => p.sj_status === "BILLING_READY").length,
    [prs]
  )

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-col gap-6 p-6 min-h-0">

          {/* Page Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">Purchasing Request</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Pengajuan dan pelacakan status permintaan barang maintenance
              </p>
            </div>
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Buat PR Baru
            </Button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={ShoppingCart} label="Total PR" value={prs.length} sub="semua permintaan" />
            <StatCard icon={Clock} label="Menunggu Pembayaran" value={counts.WAITING_PAYMENT} sub="perlu diproses Purchasing" accent="bg-amber-50 dark:bg-amber-950/40" />
            <StatCard icon={Package} label="Dalam Pembelian" value={counts.PURCHASED} sub="sudah dibayar, dalam perjalanan" accent="bg-blue-50 dark:bg-blue-950/40" />
            <StatCard icon={CheckCircle2} label="Selesai" value={counts.COMPLETED} sub="sudah sampai di tujuan" accent="bg-emerald-50 dark:bg-emerald-950/40" />
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">Semua PR</TabsTrigger>
              <TabsTrigger value="warehouse" className="text-xs">
                Warehouse (SJ)
                {warehousePendingCount > 0 && <span className="ml-1.5 text-[10px] opacity-70">{warehousePendingCount}</span>}
              </TabsTrigger>
              <TabsTrigger value="billing" className="text-xs">
                Billing
                {billingReadyCount > 0 && <span className="ml-1.5 text-[10px] opacity-70">{billingReadyCount}</span>}
              </TabsTrigger>
            </TabsList>

            {/* ── Semua PR ── */}
            <TabsContent value="all" className="mt-4 space-y-4">
              <StatusFilterChips active={statusFilter} onChange={setStatusFilter} counts={counts} />

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Cari PR NO, site, atau unit..."
                    className="w-full text-sm rounded-lg border border-border bg-background text-foreground pl-9 pr-9 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/50 transition-all placeholder:text-muted-foreground"
                  />
                  {searchQuery && (
                    <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                <p className="text-xs text-muted-foreground ml-auto">{filtered.length} dari {prs.length} PR</p>
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["PR NO", "Periode", "KET", "Site Maintenance", "Unit", "Tanggal", "Items", "Status", ""].map((col, i) => (
                          <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                            Tidak ada PR yang cocok dengan pencarian.
                          </td>
                        </tr>
                      ) : (
                        filtered.map(pr => (
                          <tr key={pr.id} onClick={() => openDetail(pr)} className="hover:bg-muted/40 transition-colors cursor-pointer group">
                            <td className="px-4 py-3 font-mono text-xs font-medium text-foreground whitespace-nowrap">{pr.pr_no}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{monthNameId(pr.permintaan_tanggal)}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{quarterLabel(pr.permintaan_tanggal)}</td>
                            <td className="px-4 py-3 text-xs text-foreground max-w-[160px] truncate">{pr.site_maintenance}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{pr.unit}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fDate(pr.permintaan_tanggal)}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{pr.items.length}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_CFG[pr.status].badge}`}>
                                {STATUS_CFG[pr.status].label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ── Warehouse ── */}
            <TabsContent value="warehouse" className="mt-4">
              <WarehouseTab prs={prs} onUploaded={applyUpdate} />
            </TabsContent>

            {/* ── Billing ── */}
            <TabsContent value="billing" className="mt-4">
              <BillingTab prs={prs} />
            </TabsContent>
          </Tabs>
        </div>

        <CreatePRSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreated={loadPrs} />
        <PRDetailSheet pr={selected} open={detailOpen} onClose={() => setDetailOpen(false)} onUpdated={applyUpdate} />

        <Toaster richColors />
      </SidebarInset>
    </SidebarProvider>
  )
}
