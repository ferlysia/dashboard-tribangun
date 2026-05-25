"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  RefreshCw, Search, Plus, Trash2, Pencil, Check, X,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight,
  FolderOpen, DollarSign, AlertTriangle,
} from "lucide-react"
import type { ExecProjectRow } from "@/app/api/executive-summary/route"

// ─── Types ────────────────────────────────────────────────────────────────────
type CostItem = {
  id:           string
  project_key:  string
  category:     string
  description:  string
  amount:       number
  cost_date?:   string | null
  input_by?:    string
  cost_stream:  "main" | "vo"
  created_at:   string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CAT_LABELS: Record<string, string> = {
  gaji:        "Gaji & Upah",
  material:    "Material",
  transport:   "Transport",
  operasional: "Operasional",
  sewa:        "Sewa Alat",
  lainnya:     "Lain-lain",
}

const CAT_COLORS: Record<string, string> = {
  gaji:        "bg-slate-100 text-slate-600",
  material:    "bg-teal-50 text-teal-700",
  transport:   "bg-orange-50 text-orange-700",
  operasional: "bg-violet-50 text-violet-700",
  sewa:        "bg-pink-50 text-pink-700",
  lainnya:     "bg-neutral-100 text-neutral-500",
}

const CATS = Object.keys(CAT_LABELS)

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

const fShort = (n: number): string => {
  const abs  = Math.abs(n)
  const sign = n < 0 ? "−" : ""
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000)     return `${sign}${(abs / 1_000_000).toFixed(1)}Jt`
  if (abs >= 1_000)         return `${sign}${(abs / 1_000).toFixed(0)}Rb`
  return `${sign}${Math.round(abs)}`
}

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = React.useState(value)
  React.useEffect(() => {
    const id = setTimeout(() => setDv(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return dv
}

// ─── Margin Pill ──────────────────────────────────────────────────────────────
function MarginPill({ margin, contractVal }: { margin: number; contractVal: number }) {
  if (contractVal <= 0) return <span className="text-neutral-200 text-sm">—</span>
  const style =
    margin >= 15 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    margin >= 0  ? "bg-amber-50 text-amber-700 border-amber-200" :
                   "bg-red-50 text-red-600 border-red-200"
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border tabular-nums ${style}`}>
      {margin >= 0 ? "+" : ""}{margin.toFixed(1)}%
    </span>
  )
}

// ─── Cost Bar ─────────────────────────────────────────────────────────────────
function CostBar({ actual, budget }: { actual: number; budget: number }) {
  const pct   = budget > 0 ? Math.min(110, (actual / budget) * 100) : 0
  const color = pct > 100 ? "bg-red-500" : pct > 80 ? "bg-amber-400" : "bg-indigo-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-neutral-400 w-8 text-right">{Math.round(pct)}%</span>
    </div>
  )
}

// ─── Cost Item: view row ──────────────────────────────────────────────────────
function CostItemView({
  item, onEdit, onDelete, confirming, onConfirmDelete, onCancelDelete,
}: {
  item:            CostItem
  onEdit:          () => void
  onDelete:        () => void
  confirming:      boolean
  onConfirmDelete: () => void
  onCancelDelete:  () => void
}) {
  const catLabel = CAT_LABELS[item.category] ?? item.category
  const catColor = CAT_COLORS[item.category] ?? CAT_COLORS.lainnya
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 group hover:bg-neutral-50 transition-colors">
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${
        item.cost_stream === "vo"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-indigo-50 text-indigo-700 border-indigo-200"
      }`}>
        {item.cost_stream === "vo" ? "KT" : "PO"}
      </span>

      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${catColor}`}>
        {catLabel}
      </span>

      <p className="flex-1 text-xs text-neutral-600 truncate min-w-0">{item.description}</p>

      {item.cost_date && (
        <span className="text-[10px] text-neutral-300 flex-shrink-0 hidden sm:block">
          {new Date(item.cost_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" })}
        </span>
      )}

      <span className="text-sm font-bold tabular-nums text-neutral-800 flex-shrink-0 w-28 text-right">
        {fShort(Number(item.amount))}
      </span>

      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {confirming ? (
          <>
            <button type="button" onClick={onConfirmDelete}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
              <Trash2 className="h-3 w-3" />Hapus?
            </button>
            <button type="button" onClick={onCancelDelete}
              className="p-1 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onEdit}
              className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors">
              <Pencil className="h-3 w-3" />
            </button>
            <button type="button" onClick={onDelete}
              className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors">
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Cost Item: inline edit row ───────────────────────────────────────────────
function CostItemEdit({
  item, onSave, onCancel, saving,
}: {
  item:    CostItem
  onSave:  (data: { description: string; amount: number; category: string; cost_date: string | null }) => void
  onCancel: () => void
  saving:  boolean
}) {
  const [desc,   setDesc]   = React.useState(item.description)
  const [amount, setAmount] = React.useState(String(item.amount))
  const [cat,    setCat]    = React.useState(item.category || "lainnya")
  const [date,   setDate]   = React.useState(item.cost_date ?? "")

  const commit = () => {
    const a = Number(amount.replace(/[^0-9.-]/g, ""))
    if (!desc.trim() || isNaN(a) || a <= 0) return
    onSave({ description: desc.trim(), amount: a, category: cat, cost_date: date || null })
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter")  { e.preventDefault(); commit() }
    if (e.key === "Escape") onCancel()
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50/70 border-l-2 border-indigo-400">
      <select value={cat} onChange={e => setCat(e.target.value)}
        className="text-[11px] border border-neutral-200 rounded px-1.5 py-1 bg-white text-neutral-700 outline-none focus:border-indigo-400 flex-shrink-0">
        {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
      </select>

      <input value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={onKey}
        placeholder="Deskripsi" autoFocus
        className="flex-1 min-w-0 text-xs border border-neutral-200 rounded px-2 py-1 bg-white outline-none focus:border-indigo-400" />

      <input value={date} onChange={e => setDate(e.target.value)} type="date"
        className="text-[11px] border border-neutral-200 rounded px-1.5 py-1 bg-white outline-none focus:border-indigo-400 flex-shrink-0 w-32" />

      <input value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={onKey}
        placeholder="Jumlah"
        className="text-xs border border-neutral-200 rounded px-2 py-1 bg-white outline-none focus:border-indigo-400 w-32 text-right tabular-nums flex-shrink-0" />

      <button type="button" onClick={commit} disabled={saving}
        className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0">
        {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        Simpan
      </button>
      <button type="button" onClick={onCancel}
        className="p-1.5 rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors flex-shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Add Cost Form ────────────────────────────────────────────────────────────
function AddCostForm({
  projectKey, onAdd, onCancel,
}: {
  projectKey: string
  onAdd:      (item: CostItem) => void
  onCancel:   () => void
}) {
  const [desc,   setDesc]   = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [cat,    setCat]    = React.useState("lainnya")
  const [stream, setStream] = React.useState<"main" | "vo">("main")
  const [date,   setDate]   = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [err,    setErr]    = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const a = Number(amount.replace(/[^0-9.-]/g, ""))
    if (!desc.trim() || isNaN(a) || a <= 0) { setErr("Deskripsi dan jumlah wajib diisi."); return }
    setSaving(true); setErr(null)
    try {
      const res = await fetch("/api/project-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_key: projectKey,
          description: desc.trim(),
          amount:      a,
          category:    cat,
          cost_stream: stream,
          cost_date:   date || null,
          input_by:    "",
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      onAdd(json.data as CostItem)
      setDesc(""); setAmount(""); setCat("lainnya"); setDate(""); setStream("main")
    } catch (e2) { setErr(String(e2)) }
    finally      { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit}
      className="flex items-center gap-2 px-4 py-3 bg-emerald-50/60 border-t border-emerald-100">
      <select value={stream} onChange={e => setStream(e.target.value as "main" | "vo")}
        className="text-[11px] border border-neutral-200 rounded px-1.5 py-1 bg-white text-neutral-700 outline-none focus:border-emerald-400 flex-shrink-0">
        <option value="main">PO Utama</option>
        <option value="vo">Kerja Tambah</option>
      </select>

      <select value={cat} onChange={e => setCat(e.target.value)}
        className="text-[11px] border border-neutral-200 rounded px-1.5 py-1 bg-white text-neutral-700 outline-none focus:border-emerald-400 flex-shrink-0">
        {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
      </select>

      <input value={desc} onChange={e => setDesc(e.target.value)}
        placeholder="Deskripsi pengeluaran…" required autoFocus
        className="flex-1 min-w-0 text-xs border border-neutral-200 rounded px-2 py-1 bg-white outline-none focus:border-emerald-400" />

      <input value={date} onChange={e => setDate(e.target.value)} type="date"
        className="text-[11px] border border-neutral-200 rounded px-1.5 py-1 bg-white outline-none focus:border-emerald-400 flex-shrink-0 w-32" />

      <input value={amount} onChange={e => setAmount(e.target.value)}
        placeholder="Jumlah (Rp)" required
        className="text-xs border border-neutral-200 rounded px-2 py-1 bg-white outline-none focus:border-emerald-400 w-32 text-right tabular-nums flex-shrink-0" />

      {err && <span className="text-[10px] text-red-500 flex-shrink-0 max-w-[120px] truncate">{err}</span>}

      <button type="submit" disabled={saving}
        className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex-shrink-0">
        {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        Tambah
      </button>
      <button type="button" onClick={onCancel}
        className="p-1.5 rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors flex-shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  )
}

// ─── Expanded cost section ────────────────────────────────────────────────────
function ExpandedCosts({
  projectKey, costs, loadingCosts,
  onItemAdded, onItemSaved, onItemDeleted,
}: {
  projectKey:    string
  costs:         CostItem[] | undefined
  loadingCosts:  boolean
  onItemAdded:   (item: CostItem) => void
  onItemSaved:   (id: string, patch: Partial<CostItem>) => void
  onItemDeleted: (id: string) => void
}) {
  const [editingId,  setEditingId]  = React.useState<string | null>(null)
  const [savingId,   setSavingId]   = React.useState<string | null>(null)
  const [confirmId,  setConfirmId]  = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [showAdd,    setShowAdd]    = React.useState(false)
  const [streamTab,  setStreamTab]  = React.useState<"all" | "main" | "vo">("all")

  const handleSave = async (
    id: string,
    data: { description: string; amount: number; category: string; cost_date: string | null }
  ) => {
    setSavingId(id)
    try {
      const res = await fetch(`/api/project-costs/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      onItemSaved(id, json.data ?? data)
      setEditingId(null)
    } catch { /* keep edit open on failure */ }
    finally { setSavingId(null) }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/project-costs/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
      onItemDeleted(id)
      setConfirmId(null)
    } catch { /* surface nothing */ }
    finally { setDeletingId(null) }
  }

  if (loadingCosts || !costs)
    return (
      <div className="py-6 text-center text-xs text-neutral-400 bg-white border-t border-neutral-100">
        <RefreshCw className="h-3 w-3 animate-spin inline mr-1.5" />Memuat pengeluaran…
      </div>
    )

  const shown     = streamTab === "all" ? costs : costs.filter(c => c.cost_stream === streamTab)
  const mainTotal = costs.filter(c => c.cost_stream === "main").reduce((s, c) => s + Number(c.amount), 0)
  const voTotal   = costs.filter(c => c.cost_stream === "vo").reduce((s, c)   => s + Number(c.amount), 0)

  return (
    <div className="bg-white border-t border-neutral-100">

      {/* Sub-toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-neutral-50/80 border-b border-neutral-100">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-0.5 p-0.5 rounded-md bg-neutral-100">
            {(["all", "main", "vo"] as const).map(f => {
              const count = f === "all" ? costs.length : costs.filter(c => c.cost_stream === f).length
              return (
                <button key={f} type="button" onClick={() => setStreamTab(f)}
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                    streamTab === f ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                  }`}>
                  {f === "all" ? `Semua (${count})` : f === "main" ? `PO Utama (${count})` : `Kerja Tambah (${count})`}
                </button>
              )
            })}
          </div>
          {voTotal > 0 && (
            <span className="text-[10px] text-neutral-400">
              PO: <strong className="text-neutral-600">{fShort(mainTotal)}</strong>
              &nbsp;·&nbsp;KT: <strong className="text-amber-600">{fShort(voTotal)}</strong>
            </span>
          )}
        </div>

        <button type="button" onClick={() => setShowAdd(v => !v)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
            showAdd
              ? "bg-neutral-200 text-neutral-600"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}>
          {showAdd ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showAdd ? "Batal" : "Tambah Pengeluaran"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddCostForm
          projectKey={projectKey}
          onAdd={item => { onItemAdded(item); setShowAdd(false) }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Item list */}
      {shown.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-neutral-400">
            {costs.length === 0 ? "Belum ada pengeluaran dicatat." : "Tidak ada item di stream ini."}
          </p>
          {costs.length === 0 && (
            <p className="text-[10px] text-neutral-300 mt-1">
              Klik &quot;+ Tambah Pengeluaran&quot; untuk mencatat biaya pertama.
            </p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-neutral-50">
          {/* Column labels */}
          <div className="flex items-center gap-3 px-4 py-1.5 bg-neutral-50/40">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-300 w-6">Str</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-300 w-20">Kategori</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-300 flex-1">Deskripsi</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-300 w-24 hidden sm:block">Tanggal</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-300 w-28 text-right">Jumlah</span>
            <span className="w-16" />
          </div>

          {shown.map(item =>
            editingId === item.id ? (
              <CostItemEdit
                key={item.id}
                item={item}
                saving={savingId === item.id}
                onSave={data => handleSave(item.id, data)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <CostItemView
                key={item.id}
                item={item}
                confirming={confirmId === item.id}
                onEdit={() => { setEditingId(item.id); setConfirmId(null) }}
                onDelete={() => setConfirmId(item.id)}
                onConfirmDelete={() => { if (deletingId !== item.id) handleDelete(item.id) }}
                onCancelDelete={() => setConfirmId(null)}
              />
            )
          )}

          {/* Stream totals footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-2 bg-neutral-50/40">
            <span className="text-[10px] text-neutral-400">
              {shown.length} item ·
            </span>
            <span className="text-xs font-bold tabular-nums text-neutral-700">
              {fShort(shown.reduce((s, c) => s + Number(c.amount), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CostControlPage() {
  const [rows,        setRows]        = React.useState<ExecProjectRow[]>([])
  const [costsCache,  setCostsCache]  = React.useState<Record<string, CostItem[]>>({})
  const [loadingKeys, setLoadingKeys] = React.useState<Record<string, boolean>>({})
  const [loading,     setLoading]     = React.useState(true)
  const [error,       setError]       = React.useState<string | null>(null)
  const [lastAt,      setLastAt]      = React.useState<Date | null>(null)
  const [expanded,    setExpanded]    = React.useState<string | null>(null)
  const [search,      setSearch]      = React.useState("")
  const debouncedSearch               = useDebounce(search, 280)

  const loadSummary = React.useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/executive-summary", { cache: "no-store" })
      if (!res.ok) throw new Error(await res.text())
      setRows((await res.json()).data ?? [])
      setLastAt(new Date())
    } catch (e) { setError(String(e)) }
    finally     { setLoading(false) }
  }, [])

  React.useEffect(() => { loadSummary() }, [loadSummary])

  const expandRow = React.useCallback(async (key: string) => {
    if (expanded === key) { setExpanded(null); return }
    setExpanded(key)
    if (costsCache[key] !== undefined) return
    setLoadingKeys(prev => ({ ...prev, [key]: true }))
    try {
      const res   = await fetch(`/api/project-costs?key=${encodeURIComponent(key)}`)
      const items = res.ok ? ((await res.json()).data ?? []) as CostItem[] : []
      setCostsCache(prev => ({ ...prev, [key]: items }))
    } catch {
      setCostsCache(prev => ({ ...prev, [key]: [] }))
    } finally {
      setLoadingKeys(prev => ({ ...prev, [key]: false }))
    }
  }, [expanded, costsCache])

  // Reactive total costs: once a project is expanded, use live cache
  const effectiveCosts = React.useCallback((key: string, fallback: number) =>
    costsCache[key] !== undefined
      ? costsCache[key].reduce((s, c) => s + Number(c.amount), 0)
      : fallback
  , [costsCache])

  const handleItemAdded = React.useCallback((key: string, item: CostItem) => {
    setCostsCache(prev => ({ ...prev, [key]: [...(prev[key] ?? []), item] }))
  }, [])

  const handleItemSaved = React.useCallback((key: string, id: string, patch: Partial<CostItem>) => {
    setCostsCache(prev => ({
      ...prev,
      [key]: (prev[key] ?? []).map(c => c.id === id ? { ...c, ...patch } : c),
    }))
  }, [])

  const handleItemDeleted = React.useCallback((key: string, id: string) => {
    setCostsCache(prev => ({
      ...prev,
      [key]: (prev[key] ?? []).filter(c => c.id !== id),
    }))
  }, [])

  // Filter by PO number, project name, or customer name
  const q         = debouncedSearch.toLowerCase().trim()
  const displayed = React.useMemo(() =>
    q ? rows.filter(r =>
      r.po_number?.toLowerCase().includes(q) ||
      r.display_name.toLowerCase().includes(q) ||
      r.customer_name.toLowerCase().includes(q)
    ) : rows
  , [rows, q])

  // KPI aggregates over visible rows
  const kpiContract = displayed.reduce((s, r) => s + r.contractVal, 0)
  const kpiCosts    = displayed.reduce((s, r) => s + effectiveCosts(r.project_key, r.totalCosts), 0)
  const kpiProfit   = kpiContract - kpiCosts
  const kpiMargin   = kpiContract > 0 ? (kpiProfit / kpiContract) * 100 : 0

  const COLS = "minmax(220px,2.5fr) minmax(150px,1.2fr) minmax(200px,1.5fr) minmax(160px,1fr) minmax(120px,0.9fr)"

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-1 flex-col gap-6 p-6">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-lg font-bold text-neutral-900 tracking-tight">Cost Control</h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Pengelolaan pengeluaran lapangan per proyek · CRUD inline
                {lastAt && (
                  <span className="ml-2 text-neutral-300">
                    · {lastAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
            </div>
            <button type="button" onClick={loadSummary} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border border-neutral-200 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Global PO search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-300 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari Berdasarkan Nomor PO Utama..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-800 placeholder:text-neutral-300 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500 transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-xs font-medium bg-red-50 border border-red-200 text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              Gagal memuat: {error}
            </div>
          )}

          {loading && rows.length === 0 && (
            <div className="flex items-center justify-center py-20 text-neutral-400">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Memuat data proyek…</span>
            </div>
          )}

          {!loading && displayed.length > 0 && (
            <>
              {/* KPI strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Total Nilai Kontrak",
                    val:   fShort(kpiContract),
                    sub:   fIDR(kpiContract),
                    color: "text-neutral-800",
                  },
                  {
                    label: "Total Pengeluaran",
                    val:   fShort(kpiCosts),
                    sub:   fIDR(kpiCosts),
                    color: "text-indigo-600",
                  },
                  {
                    label: "Net Profit Gabungan",
                    val:   fShort(kpiProfit),
                    sub:   fIDR(kpiProfit),
                    color: kpiProfit >= 0 ? "text-emerald-600" : "text-red-500",
                  },
                  {
                    label: "Avg Margin",
                    val:   `${kpiMargin.toFixed(1)}%`,
                    sub:   `${displayed.length} proyek`,
                    color: kpiMargin >= 15 ? "text-emerald-600" : kpiMargin >= 0 ? "text-amber-500" : "text-red-500",
                  },
                ].map(k => (
                  <div key={k.label} className="rounded-xl p-4 bg-white border border-neutral-200">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">{k.label}</p>
                    <p className={`text-2xl font-black tabular-nums leading-none ${k.color}`}>{k.val}</p>
                    <p className="text-[10px] text-neutral-400 mt-1.5 truncate">{k.sub}</p>
                  </div>
                ))}
              </div>

              {/* Relational table */}
              <div className="rounded-xl overflow-hidden border border-neutral-200 bg-white">

                {/* Header row */}
                <div className="grid px-5 py-3 bg-neutral-50 border-b border-neutral-200"
                  style={{ gridTemplateColumns: COLS, columnGap: 16 }}>
                  {[
                    { label: "Nama Proyek / PO",   icon: <FolderOpen  className="h-3 w-3" /> },
                    { label: "Budget PM (Plafon)",  icon: <DollarSign  className="h-3 w-3" /> },
                    { label: "Pengeluaran Aktual",  icon: <TrendingUp  className="h-3 w-3" /> },
                    { label: "Net Profit",          icon: <TrendingUp  className="h-3 w-3" /> },
                    { label: "Net Margin",          icon: null },
                  ].map(h => (
                    <div key={h.label} className="flex items-center gap-1.5">
                      {h.icon && <span className="text-neutral-300">{h.icon}</span>}
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{h.label}</span>
                    </div>
                  ))}
                </div>

                {/* Data rows */}
                <div className="divide-y divide-neutral-100">
                  {displayed.map(row => {
                    const isOpen      = expanded === row.project_key
                    const actualCosts = effectiveCosts(row.project_key, row.totalCosts)
                    const netProfit   = row.contractVal - actualCosts
                    const netMargin   = row.contractVal > 0 ? (netProfit / row.contractVal) * 100 : 0
                    const profitColor = netProfit >= 0 ? "text-emerald-600" : "text-red-500"
                    const budgetPct   = row.contractVal > 0 ? (actualCosts / row.contractVal) * 100 : 0

                    return (
                      <div key={row.project_key}>
                        {/* Summary row — click to expand */}
                        <div
                          className={`grid px-5 py-4 items-center cursor-pointer transition-colors select-none ${
                            isOpen ? "bg-indigo-50/60" : "hover:bg-neutral-50"
                          }`}
                          style={{ gridTemplateColumns: COLS, columnGap: 16 }}
                          onClick={() => expandRow(row.project_key)}>

                          {/* Col 1 — Nama Proyek & PO */}
                          <div className="min-w-0 flex items-start gap-2">
                            <div className="pt-0.5 flex-shrink-0">
                              {isOpen
                                ? <ChevronDown  className="h-4 w-4 text-indigo-500" />
                                : <ChevronRight className="h-4 w-4 text-neutral-300" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-800 truncate" title={row.display_name}>
                                {row.display_name}
                              </p>
                              {row.customer_name && (
                                <p className="text-[11px] text-neutral-400 truncate">{row.customer_name}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {row.po_number ? (
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                                    {row.po_number}
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-neutral-300 italic">No PO</span>
                                )}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  row.project_status === "SELESAI"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-blue-50 text-blue-600"
                                }`}>
                                  {row.project_status}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Col 2 — Budget PM (Plafon) */}
                          <div>
                            {row.contractVal > 0 ? (
                              <>
                                <p className="text-sm font-bold tabular-nums text-neutral-800">{fShort(row.contractVal)}</p>
                                <p className="text-[10px] text-neutral-400 mt-0.5 truncate" title={fIDR(row.contractVal)}>
                                  {fIDR(row.contractVal)}
                                </p>
                              </>
                            ) : (
                              <span className="text-sm text-neutral-200">—</span>
                            )}
                          </div>

                          {/* Col 3 — Pengeluaran Aktual */}
                          <div>
                            <p className="text-sm font-bold tabular-nums text-neutral-800 mb-1.5">
                              {fShort(actualCosts)}
                            </p>
                            {row.contractVal > 0 && (
                              <>
                                <CostBar actual={actualCosts} budget={row.contractVal} />
                                {budgetPct > 85 && (
                                  <p className={`text-[10px] mt-1 font-semibold ${
                                    budgetPct > 100 ? "text-red-500" : "text-amber-500"
                                  }`}>
                                    {budgetPct > 100 ? "⚠ Melebihi plafon!" : "Mendekati plafon"}
                                  </p>
                                )}
                              </>
                            )}
                          </div>

                          {/* Col 4 — Net Profit */}
                          <div>
                            <div className="flex items-center gap-1.5">
                              {netProfit > 0
                                ? <TrendingUp   className={`h-3.5 w-3.5 ${profitColor}`} />
                                : netProfit < 0
                                  ? <TrendingDown className={`h-3.5 w-3.5 ${profitColor}`} />
                                  : <Minus        className={`h-3.5 w-3.5 ${profitColor}`} />}
                              <span className={`text-sm font-bold tabular-nums ${profitColor}`}>
                                {fShort(netProfit)}
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-400 mt-0.5 truncate" title={fIDR(netProfit)}>
                              {fIDR(netProfit)}
                            </p>
                          </div>

                          {/* Col 5 — Net Margin */}
                          <div>
                            <MarginPill margin={netMargin} contractVal={row.contractVal} />
                          </div>
                        </div>

                        {/* Inline expanded cost items */}
                        {isOpen && (
                          <ExpandedCosts
                            projectKey={row.project_key}
                            costs={costsCache[row.project_key]}
                            loadingCosts={loadingKeys[row.project_key] ?? false}
                            onItemAdded={item      => handleItemAdded(row.project_key, item)}
                            onItemSaved={(id, p)   => handleItemSaved(row.project_key, id, p)}
                            onItemDeleted={id      => handleItemDeleted(row.project_key, id)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <p className="text-[10px] text-center text-neutral-200">
                Net Profit = Budget PM − Pengeluaran Aktual · Klik baris untuk kelola pengeluaran · KPI diperbarui reaktif
              </p>
            </>
          )}

          {/* Empty search state */}
          {!loading && rows.length > 0 && displayed.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="h-8 w-8 text-neutral-200 mb-3" />
              <p className="text-sm font-medium text-neutral-400">
                Tidak ada hasil untuk &quot;{debouncedSearch}&quot;
              </p>
              <p className="text-xs text-neutral-300 mt-1">
                Coba nomor PO, nama proyek, atau nama klien yang berbeda.
              </p>
            </div>
          )}

        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
