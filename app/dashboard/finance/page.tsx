"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import Link from "next/link"
import {
  RefreshCw, Search, X, Lock, AlertTriangle, Clock, CheckCircle2,
  ChevronDown, ChevronRight, FolderOpen, Send, DollarSign,
  CalendarDays, FileCheck2,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
type TerminSchedule = {
  id: string
  nama: string
  target_progres: number
  persen_tagihan?: number
}

type TerminInvoice = {
  id:            string
  project_key:   string
  termin_id:     string
  status:        "TERKUNCI" | "SIAP_TAGIH" | "PROSES_COLLECT" | "LUNAS"
  amount_billed?: number | null
  invoice_date?:  string | null
  notes?:         string | null
  created_at:    string
  updated_at:    string
}

type VOEntry = { id: string; nilai_po: number }

type ProjectFinance = {
  project_key:       string
  display_name:      string
  customer_name:     string
  po_number:         string | null
  physical_progress: number
  project_status:    string
  po_value_manual:   number
  op_budget_vo:      number
  vo_entries:        VOEntry[]
  termin_schedule:   TerminSchedule[]
  site_location:     string | null
  pic_name:          string | null
}

type TerminStatus = TerminInvoice["status"]

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

function buildInvoiceUrl(p: ProjectFinance, t: TerminSchedule, billingAmt: number): string {
  const params = new URLSearchParams({
    po:             p.po_number       ?? "",
    project_name:   p.display_name,
    client:         p.customer_name,
    termin_name:    t.nama,
    billing_pct:    String(t.persen_tagihan ?? 0),
    amount:         String(billingAmt),
    contract_value: String(computeContractVal(p)),
    site:           p.site_location   ?? "",
    pic:            p.pic_name        ?? "",
    progress:       String(p.physical_progress),
  })
  return `/input-invoice?${params.toString()}`
}

function computeContractVal(p: ProjectFinance): number {
  const poBase    = Number(p.po_value_manual || 0)
  const voEntries = Array.isArray(p.vo_entries) ? p.vo_entries : []
  const voTotal   = voEntries.length > 0
    ? voEntries.reduce((s, e) => s + Number(e.nilai_po || 0), 0)
    : Number(p.op_budget_vo || 0)
  return poBase + voTotal
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<TerminStatus, { label: string; bg: string; text: string; border: string }> = {
  TERKUNCI:       { label: "TERKUNCI",          bg: "bg-neutral-100",  text: "text-neutral-500",  border: "border-neutral-200"  },
  SIAP_TAGIH:     { label: "⚠ SIAP TAGIH",     bg: "bg-amber-50",     text: "text-amber-700",    border: "border-amber-200"    },
  PROSES_COLLECT: { label: "⏳ PROSES COLLECT", bg: "bg-blue-50",      text: "text-blue-700",     border: "border-blue-200"     },
  LUNAS:          { label: "✓ LUNAS",           bg: "bg-emerald-50",   text: "text-emerald-700",  border: "border-emerald-200"  },
}

function StatusBadge({ status }: { status: TerminStatus }) {
  const c = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function MiniProgress({ pct }: { pct: number }) {
  const barColor  = pct >= 90 ? "bg-emerald-500" : pct >= 50 ? "bg-indigo-500" : "bg-amber-400"
  const textColor = pct >= 90 ? "text-emerald-600" : pct >= 50 ? "text-indigo-600" : "text-amber-600"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-[11px] font-bold tabular-nums w-8 text-right flex-shrink-0 ${textColor}`}>
        {pct}%
      </span>
    </div>
  )
}

// ─── Single Termin Block ──────────────────────────────────────────────────────
function TerminBlock({
  index, termin, invoice, contractVal, progress,
  onUpsert, onPatch,
}: {
  index:       number
  termin:      TerminSchedule
  invoice:     TerminInvoice | undefined
  contractVal: number
  progress:    number
  onUpsert:    (terminId: string, data: Partial<TerminInvoice>) => Promise<void>
  onPatch:     (invoice: TerminInvoice, data: Partial<TerminInvoice>) => Promise<void>
}) {
  const isUnlocked  = progress >= termin.target_progres
  const status      = (invoice?.status ?? (isUnlocked ? "SIAP_TAGIH" : "TERKUNCI")) as TerminStatus
  const estAmount   = termin.persen_tagihan !== undefined && contractVal > 0
    ? Math.round(contractVal * termin.persen_tagihan / 100) : null

  const initAmount = invoice?.amount_billed
    ? String(invoice.amount_billed)
    : estAmount !== null ? String(estAmount) : ""

  const [amount,     setAmount]     = React.useState(initAmount)
  const [invDate,    setInvDate]    = React.useState(invoice?.invoice_date ?? "")
  const [notes,      setNotes]      = React.useState(invoice?.notes ?? "")
  const [saving,     setSaving]     = React.useState(false)
  const [markSaving, setMarkSaving] = React.useState(false)

  // Re-sync form state if invoice record arrives/changes
  React.useEffect(() => {
    if (invoice) {
      if (invoice.amount_billed) setAmount(String(invoice.amount_billed))
      setInvDate(invoice.invoice_date ?? "")
      setNotes(invoice.notes ?? "")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id])

  const sendInvoice = async () => {
    const a = Number(amount.replace(/[^0-9.-]/g, ""))
    if (isNaN(a) || a <= 0) return
    setSaving(true)
    try {
      const patch: Partial<TerminInvoice> = {
        status:        "PROSES_COLLECT",
        amount_billed: a,
        invoice_date:  invDate || null,
        notes:         notes   || null,
      }
      if (invoice) await onPatch(invoice, patch)
      else         await onUpsert(termin.id, patch)
    } finally { setSaving(false) }
  }

  const markLunas = async () => {
    if (!invoice) return
    setMarkSaving(true)
    try { await onPatch(invoice, { status: "LUNAS" }) }
    finally { setMarkSaving(false) }
  }

  const numBg =
    status === "LUNAS"          ? "bg-emerald-500 text-white" :
    status === "PROSES_COLLECT" ? "bg-blue-500 text-white"    :
    status === "SIAP_TAGIH"     ? "bg-amber-500 text-white"   :
    "bg-neutral-200 text-neutral-500"

  const blockBorder =
    status === "SIAP_TAGIH"     ? "border-amber-200 bg-amber-50/30"   :
    status === "PROSES_COLLECT" ? "border-blue-200 bg-blue-50/20"     :
    status === "LUNAS"          ? "border-emerald-200 bg-emerald-50/20" :
    "border-neutral-200 bg-neutral-50/40"

  return (
    <div className={`rounded-xl border p-4 transition-colors ${blockBorder}`}>

      {/* Termin header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5 ${numBg}`}>
            {index + 1}
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-800">{termin.nama}</p>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-[10px] text-neutral-400">
                Trigger: progres ≥ <strong className="text-neutral-600">{termin.target_progres}%</strong>
              </span>
              {termin.persen_tagihan !== undefined && (
                <span className="text-[10px] text-neutral-400">
                  Porsi: <strong className="text-neutral-600">{termin.persen_tagihan}%</strong> kontrak
                </span>
              )}
              {estAmount !== null && (
                <span className="text-[10px] font-semibold text-neutral-600">
                  ≈ {fShort(estAmount)}
                </span>
              )}
            </div>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* TERKUNCI — show gap to unlock */}
      {status === "TERKUNCI" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 border border-neutral-200">
          <Lock className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
          <p className="text-[11px] text-neutral-500">
            Butuh progres fisik <strong className="text-neutral-700">{termin.target_progres}%</strong>
            {" · "}Saat ini <strong className="text-neutral-700">{progress}%</strong>
            {" · "}Selisih <strong className="text-red-500">{termin.target_progres - progress}%</strong>
          </p>
        </div>
      )}

      {/* SIAP_TAGIH — invoice drafting form */}
      {status === "SIAP_TAGIH" && (
        <div className="mt-3 p-3.5 rounded-xl border border-amber-200 bg-white">
          <div className="flex items-center gap-1.5 mb-3">
            <Send className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-xs font-semibold text-amber-700">Draf Invoice Termin</p>
            {estAmount !== null && (
              <span className="ml-auto text-[10px] text-neutral-400">
                Estimasi kontrak: <strong className="text-neutral-600">{fIDR(estAmount)}</strong>
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                Jumlah Tagihan (Rp)
              </label>
              <input
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm font-semibold tabular-nums bg-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                Tanggal Invoice
              </label>
              <input
                type="date"
                title="Tanggal invoice"
                value={invDate}
                onChange={e => setInvDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm bg-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                Catatan / No. Invoice
              </label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Nomor invoice, catatan…"
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm bg-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={sendInvoice}
              disabled={saving || !amount}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {saving
                ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                : <Send className="h-3.5 w-3.5" />}
              Kirim Invoice →
            </button>
          </div>
        </div>
      )}

      {/* PROSES_COLLECT — sent details + mark lunas */}
      {status === "PROSES_COLLECT" && invoice && (
        <div className="mt-3 flex items-start justify-between gap-4 p-3.5 rounded-xl border border-blue-200 bg-white">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-sm font-bold tabular-nums text-neutral-800">
                {invoice.amount_billed ? fIDR(Number(invoice.amount_billed)) : "—"}
              </span>
              <span className="text-[10px] text-blue-500 font-semibold">menunggu cair</span>
            </div>
            {invoice.invoice_date && (
              <div className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                <span className="text-[11px] text-neutral-500">
                  Dikirim:{" "}
                  {new Date(invoice.invoice_date).toLocaleDateString("id-ID", {
                    day: "2-digit", month: "long", year: "numeric",
                  })}
                </span>
              </div>
            )}
            {invoice.notes && (
              <p className="text-[11px] text-neutral-400 italic pl-5">{invoice.notes}</p>
            )}
          </div>
          <button
            type="button"
            onClick={markLunas}
            disabled={markSaving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {markSaving
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <FileCheck2 className="h-3.5 w-3.5" />}
            Tandai Lunas ✓
          </button>
        </div>
      )}

      {/* LUNAS — cleared */}
      {status === "LUNAS" && invoice && (
        <div className="mt-3 flex items-center gap-3 p-3.5 rounded-xl border border-emerald-200 bg-white">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-700 tabular-nums">
              {invoice.amount_billed ? fIDR(Number(invoice.amount_billed)) : "Lunas"}
            </p>
            <p className="text-[10px] text-emerald-500 mt-0.5">
              Pembayaran diterima
              {invoice.invoice_date && (
                <>{" · "}{new Date(invoice.invoice_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</>
              )}
            </p>
          </div>
          {invoice.notes && (
            <p className="text-[11px] text-neutral-400 italic truncate max-w-[180px]">{invoice.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Expanded project: all termins ───────────────────────────────────────────
function ProjectExpanded({
  project, invoices, loadingInvoices, onUpsert, onPatch,
}: {
  project:        ProjectFinance
  invoices:       TerminInvoice[] | undefined
  loadingInvoices: boolean
  onUpsert:       (terminId: string, data: Partial<TerminInvoice>) => Promise<void>
  onPatch:        (invoice: TerminInvoice, data: Partial<TerminInvoice>) => Promise<void>
}) {
  const contractVal = computeContractVal(project)

  if (loadingInvoices || !invoices)
    return (
      <div className="py-6 text-center text-xs text-neutral-400 bg-white border-t border-neutral-100">
        <RefreshCw className="h-3 w-3 animate-spin inline mr-1.5" />Memuat data termin…
      </div>
    )

  if (project.termin_schedule.length === 0)
    return (
      <div className="py-10 text-center bg-white border-t border-neutral-100">
        <DollarSign className="h-6 w-6 text-neutral-200 mx-auto mb-2" />
        <p className="text-xs text-neutral-400">Belum ada jadwal termin (TOP) untuk proyek ini.</p>
        <p className="text-[10px] text-neutral-300 mt-1">Atur di halaman detail proyek → Finance → TOP Schedule.</p>
      </div>
    )

  const invoicedTotal = invoices
    .filter(i => i.status === "PROSES_COLLECT" || i.status === "LUNAS")
    .reduce((s, i) => s + Number(i.amount_billed || 0), 0)

  return (
    <div className="border-t border-neutral-100 bg-white">
      {/* Project financial summary bar */}
      <div className="flex items-center gap-6 px-5 py-3 bg-neutral-50/70 border-b border-neutral-100">
        <div className="flex-1">
          <p className="text-[10px] text-neutral-400 mb-1">Progres fisik (SOW Bridge)</p>
          <MiniProgress pct={project.physical_progress} />
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] text-neutral-400">Nilai Kontrak</p>
          <p className="text-sm font-bold tabular-nums text-neutral-800">
            {contractVal > 0 ? fShort(contractVal) : "—"}
          </p>
        </div>
        {contractVal > 0 && invoicedTotal > 0 && (
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-neutral-400">Tertagih</p>
            <p className="text-sm font-bold tabular-nums text-indigo-600">{fShort(invoicedTotal)}</p>
          </div>
        )}
      </div>

      {/* Termin blocks */}
      <div className="p-4 space-y-3">
        {project.termin_schedule.map((t, i) => (
          <TerminBlock
            key={t.id}
            index={i}
            termin={t}
            invoice={invoices.find(inv => inv.termin_id === t.id)}
            contractVal={contractVal}
            progress={project.physical_progress}
            onUpsert={onUpsert}
            onPatch={onPatch}
          />
        ))}
      </div>

      {/* Footer totals */}
      {contractVal > 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-neutral-50 border border-neutral-100">
            <span className="text-[11px] text-neutral-500">Total tertagih (dikirim + lunas):</span>
            <span className="text-sm font-bold tabular-nums text-neutral-800">
              {fShort(invoicedTotal)} / {fShort(contractVal)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FinancePage() {
  const [projects,    setProjects]    = React.useState<ProjectFinance[]>([])
  const [invCache,    setInvCache]    = React.useState<Record<string, TerminInvoice[]>>({})
  const [loadingKeys, setLoadingKeys] = React.useState<Record<string, boolean>>({})
  const [loading,     setLoading]     = React.useState(true)
  const [error,       setError]       = React.useState<string | null>(null)
  const [lastAt,      setLastAt]      = React.useState<Date | null>(null)
  const [expanded,    setExpanded]    = React.useState<string | null>(null)
  const [search,      setSearch]      = React.useState("")
  const debouncedSearch               = useDebounce(search, 280)

  const loadProjects = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/project-details", { cache: "no-store" })
      if (!res.ok) throw new Error(await res.text())
      const all = ((await res.json()).data ?? []) as Record<string, unknown>[]
      setProjects(all.map(p => ({
        project_key:       String(p.project_key ?? ""),
        display_name:      String(p.display_name ?? ""),
        customer_name:     String(p.customer_name ?? ""),
        po_number:         p.po_number ? String(p.po_number) : null,
        physical_progress: Number(p.physical_progress ?? 0),
        project_status:    String(p.project_status ?? "BERJALAN"),
        po_value_manual:   Number(p.po_value_manual ?? 0),
        op_budget_vo:      Number(p.op_budget_vo ?? 0),
        vo_entries:        Array.isArray(p.vo_entries)      ? (p.vo_entries      as VOEntry[])       : [],
        termin_schedule:   Array.isArray(p.termin_schedule) ? (p.termin_schedule as TerminSchedule[]) : [],
        site_location:     p.site_location ? String(p.site_location) : null,
        pic_name:          p.pic_name      ? String(p.pic_name)      : null,
      })))
      setLastAt(new Date())
    } catch (e) { setError(String(e)) }
    finally     { if (!silent) setLoading(false) }
  }, [])

  React.useEffect(() => { loadProjects() }, [loadProjects])

  // Pre-load invoices for all projects with termins (drives the Billing Queue)
  React.useEffect(() => {
    const toLoad = projects.filter(p => p.termin_schedule.length > 0 && invCache[p.project_key] === undefined)
    if (toLoad.length === 0) return
    Promise.all(toLoad.map(p =>
      fetch(`/api/termin-invoices?key=${encodeURIComponent(p.project_key)}`)
        .then(r => r.ok ? r.json() : { data: [] })
        .then(d => ({ key: p.project_key, items: (d.data ?? []) as TerminInvoice[] }))
        .catch(() => ({ key: p.project_key, items: [] as TerminInvoice[] }))
    )).then(results => {
      setInvCache(prev => {
        const next = { ...prev }
        results.forEach(({ key, items }) => { if (next[key] === undefined) next[key] = items })
        return next
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects])

  // 30s auto-refresh — drives the SOW Bridge polling
  React.useEffect(() => {
    const id = setInterval(() => loadProjects(true), 30_000)
    return () => clearInterval(id)
  }, [loadProjects])

  // SOW Bridge: for each project that is expanded (or newly loaded), auto-unlock
  // any termin whose target_progres <= physical_progress if its DB status is TERKUNCI.
  const runSowBridge = React.useCallback(async (
    project: ProjectFinance,
    currentInvoices: TerminInvoice[]
  ) => {
    const { project_key, physical_progress, termin_schedule } = project
    const toUnlock = termin_schedule.filter(t => {
      if (physical_progress < t.target_progres) return false
      const existing = currentInvoices.find(i => i.termin_id === t.id)
      return !existing || existing.status === "TERKUNCI"
    })
    if (toUnlock.length === 0) return

    await Promise.all(toUnlock.map(async t => {
      try {
        const res = await fetch("/api/termin-invoices", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ project_key, termin_id: t.id, status: "SIAP_TAGIH" }),
        })
        if (!res.ok) return
        const newInv = (await res.json()).data as TerminInvoice
        setInvCache(prev => ({
          ...prev,
          [project_key]: [
            ...(prev[project_key] ?? []).filter(i => i.termin_id !== t.id),
            newInv,
          ],
        }))
      } catch { /* silent — non-critical */ }
    }))
  }, [])

  // Expand a row: fetch its invoices lazily, then run SOW Bridge
  const expandRow = React.useCallback(async (key: string) => {
    if (expanded === key) { setExpanded(null); return }
    setExpanded(key)

    const project = projects.find(p => p.project_key === key)
    if (!project) return

    if (invCache[key] !== undefined) {
      runSowBridge(project, invCache[key])
      return
    }

    setLoadingKeys(prev => ({ ...prev, [key]: true }))
    try {
      const res   = await fetch(`/api/termin-invoices?key=${encodeURIComponent(key)}`)
      const items = res.ok ? ((await res.json()).data ?? []) as TerminInvoice[] : []
      setInvCache(prev => ({ ...prev, [key]: items }))
      runSowBridge(project, items)
    } catch {
      setInvCache(prev => ({ ...prev, [key]: [] }))
    } finally {
      setLoadingKeys(prev => ({ ...prev, [key]: false }))
    }
  }, [expanded, invCache, projects, runSowBridge])

  // Upsert — creates or overwrites a termin_invoice record
  const handleUpsert = React.useCallback(async (
    key: string,
    terminId: string,
    data: Partial<TerminInvoice>
  ) => {
    const res = await fetch("/api/termin-invoices", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ project_key: key, termin_id: terminId, ...data }),
    })
    if (!res.ok) throw new Error(await res.text())
    const newInv = (await res.json()).data as TerminInvoice
    setInvCache(prev => ({
      ...prev,
      [key]: [...(prev[key] ?? []).filter(i => i.termin_id !== terminId), newInv],
    }))
  }, [])

  // Patch — updates an existing termin_invoice record
  const handlePatch = React.useCallback(async (
    key: string,
    invoice: TerminInvoice,
    data: Partial<TerminInvoice>
  ) => {
    const res = await fetch(`/api/termin-invoices/${invoice.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await res.text())
    const updated = { ...invoice, ...((await res.json()).data ?? data) } as TerminInvoice
    setInvCache(prev => ({
      ...prev,
      [key]: (prev[key] ?? []).map(i => i.id === invoice.id ? updated : i),
    }))
  }, [])

  // Filter: only projects with termin_schedule defined, then search
  const q = debouncedSearch.toLowerCase().trim()
  const withTermin  = React.useMemo(() => projects.filter(p => p.termin_schedule.length > 0), [projects])
  const displayed   = React.useMemo(() =>
    q ? withTermin.filter(p =>
      p.po_number?.toLowerCase().includes(q) ||
      p.display_name.toLowerCase().includes(q) ||
      p.customer_name.toLowerCase().includes(q)
    ) : withTermin
  , [withTermin, q])

  // Billing queue: eligible termins not yet in PROSES_COLLECT or LUNAS
  const billingQueue = React.useMemo(() => {
    const items: Array<{
      project: ProjectFinance; termin: TerminSchedule
      invoice: TerminInvoice | undefined; billingAmt: number
    }> = []
    for (const p of projects) {
      const invs = invCache[p.project_key] ?? []
      const cv   = computeContractVal(p)
      for (const t of p.termin_schedule) {
        if (p.physical_progress < t.target_progres) continue
        const inv = invs.find(i => i.termin_id === t.id)
        if (inv && (inv.status === "PROSES_COLLECT" || inv.status === "LUNAS")) continue
        items.push({ project: p, termin: t, invoice: inv, billingAmt: t.persen_tagihan && cv > 0 ? Math.round(cv * t.persen_tagihan / 100) : 0 })
      }
    }
    return items
  }, [projects, invCache])

  // KPI aggregates
  const allInvoices = React.useMemo(() => Object.values(invCache).flat(), [invCache])

  const kpiSiap = React.useMemo(() =>
    displayed.filter(p => {
      const invs = invCache[p.project_key] ?? []
      return p.termin_schedule.some(t => {
        const inv = invs.find(i => i.termin_id === t.id)
        return (inv?.status ?? (p.physical_progress >= t.target_progres ? "SIAP_TAGIH" : "TERKUNCI")) === "SIAP_TAGIH"
      })
    }).length
  , [displayed, invCache])

  const kpiProses   = allInvoices.filter(i => i.status === "PROSES_COLLECT").length
  const kpiLunas    = allInvoices.filter(i => i.status === "LUNAS").length
  const kpiLunasAmt = allInvoices.filter(i => i.status === "LUNAS").reduce((s, i) => s + Number(i.amount_billed || 0), 0)

  const COLS = "minmax(220px,2.5fr) minmax(120px,1fr) minmax(180px,1.5fr) minmax(160px,1fr)"

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-1 flex-col gap-6 p-6">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-lg font-bold text-neutral-900 tracking-tight">Finance</h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Milestone pembayaran kontrak (TOP) · SOW Bridge aktif
                {lastAt && (
                  <span className="ml-2 text-neutral-300">
                    · Diperbarui {lastAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-neutral-400">Live 30s</span>
              </div>
              <button type="button" onClick={() => loadProjects()} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border border-neutral-200 transition-colors">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Global PO Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-300 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari Berdasarkan Nomor PO Utama..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-800 placeholder:text-neutral-300 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} title="Hapus pencarian" aria-label="Hapus pencarian"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500 transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-xs font-medium bg-red-50 border border-red-200 text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />Gagal memuat: {error}
            </div>
          )}

          {loading && projects.length === 0 && (
            <div className="flex items-center justify-center py-20 text-neutral-400">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Memuat data proyek…</span>
            </div>
          )}

          {/* Empty: no projects have termin configured */}
          {!loading && withTermin.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-28 text-center">
              <div className="w-16 h-16 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-center mb-5">
                <DollarSign className="h-7 w-7 text-neutral-300" />
              </div>
              <p className="text-sm font-semibold text-neutral-500 mb-1">
                Belum ada jadwal termin (TOP).
              </p>
              <p className="text-xs text-neutral-400 max-w-xs">
                Halaman ini aktif setelah termin pembayaran dikonfigurasi di halaman detail proyek.
              </p>
            </div>
          )}

          {/* ── Billing Pipeline Queue ── */}
          {billingQueue.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[9px] font-black">⚡</span>
                </span>
                <p className="text-sm font-bold text-neutral-900">Pipeline — Siap Ditagih</p>
                <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  {billingQueue.length} termin menunggu proses
                </span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
                {billingQueue.map(({ project: p, termin: t, invoice: inv, billingAmt }) => (
                  <div key={`${p.project_key}_${t.id}`}
                    className="flex-shrink-0 w-72 rounded-2xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    style={{ borderColor: inv?.status === "SIAP_TAGIH" ? "#fbbf24" : "#e5e7eb" }}>
                    {/* Card stripe */}
                    <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
                    {/* Header */}
                    <div className="px-4 pt-3.5 pb-3 border-b border-neutral-100">
                      <div className="flex items-start gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                          <FolderOpen className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-neutral-900 truncate">{p.display_name}</p>
                          <p className="text-[10px] text-neutral-400 truncate">{p.customer_name}</p>
                        </div>
                        <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          inv?.status === "SIAP_TAGIH" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-amber-50 text-amber-600 border-amber-100"
                        }`}>⚡ SIAP</span>
                      </div>
                    </div>
                    {/* Metadata */}
                    <div className="px-4 py-3 flex flex-col gap-2">
                      {p.site_location && (
                        <p className="text-[10px] text-neutral-500 truncate">📍 {p.site_location}</p>
                      )}
                      {p.po_number && (
                        <p className="text-[10px] font-mono text-neutral-600 truncate">📜 {p.po_number}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Progres Fisik</p>
                        <p className="text-[10px] font-black tabular-nums text-indigo-600">{p.physical_progress}%</p>
                      </div>
                      <div className="h-1 w-full rounded-full bg-neutral-100 overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${p.physical_progress}%` }} />
                      </div>
                      <div className="mt-1 pt-2 border-t border-neutral-100">
                        <p className="text-[10px] font-bold text-neutral-700 truncate">{t.nama}</p>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-[9px] text-neutral-400">Trigger: ≥{t.target_progres}% · Porsi: {t.persen_tagihan}%</p>
                          {billingAmt > 0 && (
                            <p className="text-[10px] font-bold text-amber-700">{fShort(billingAmt)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Action */}
                    <div className="px-4 pb-4 pt-1">
                      <Link href={buildInvoiceUrl(p, t, billingAmt)}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors shadow-sm">
                        🧾 Proses Penagihan
                      </Link>
                      {billingAmt > 0 && (
                        <p className="text-[9px] text-neutral-400 text-center mt-1.5">
                          Form invoice akan diisi otomatis · {fIDR(billingAmt)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && displayed.length > 0 && (
            <>
              {/* KPI strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Proyek dengan TOP",
                    val:   String(displayed.length),
                    sub:   "memiliki jadwal termin",
                    color: "text-indigo-600",
                  },
                  {
                    label: "Siap Ditagih",
                    val:   String(kpiSiap),
                    sub:   "termin terbuka SOW Bridge",
                    color: "text-amber-600",
                  },
                  {
                    label: "Proses Collect",
                    val:   String(kpiProses),
                    sub:   "invoice dikirim, menunggu cair",
                    color: "text-blue-600",
                  },
                  {
                    label: "Total Lunas",
                    val:   kpiLunasAmt > 0 ? fShort(kpiLunasAmt) : String(kpiLunas),
                    sub:   kpiLunasAmt > 0 ? `${kpiLunas} termin cleared` : "termin cleared",
                    color: "text-emerald-600",
                  },
                ].map(k => (
                  <div key={k.label} className="rounded-xl p-4 bg-white border border-neutral-200">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">{k.label}</p>
                    <p className={`text-2xl font-black tabular-nums leading-none ${k.color}`}>{k.val}</p>
                    <p className="text-[10px] text-neutral-400 mt-1.5">{k.sub}</p>
                  </div>
                ))}
              </div>

              {/* Notion-style relational table */}
              <div className="rounded-xl overflow-hidden border border-neutral-200 bg-white">

                {/* Table header */}
                <div className="grid px-5 py-3 bg-neutral-50 border-b border-neutral-200"
                  style={{ gridTemplateColumns: COLS, columnGap: 16 }}>
                  {[
                    { label: "Nama Proyek / PO",  icon: <FolderOpen    className="h-3 w-3" /> },
                    { label: "Progres Fisik",      icon: null },
                    { label: "Jadwal Termin",      icon: <Clock         className="h-3 w-3" /> },
                    { label: "Status Tagihan",     icon: <CheckCircle2  className="h-3 w-3" /> },
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
                    const rowInvs     = invCache[row.project_key] ?? []
                    const contractVal = computeContractVal(row)

                    // Resolve status for each termin (local first, then derived)
                    const terminStatuses: TerminStatus[] = row.termin_schedule.map(t => {
                      const inv = rowInvs.find(i => i.termin_id === t.id)
                      return inv?.status ?? (row.physical_progress >= t.target_progres ? "SIAP_TAGIH" : "TERKUNCI")
                    })

                    const rowStatus: TerminStatus =
                      terminStatuses.some(s => s === "PROSES_COLLECT") ? "PROSES_COLLECT" :
                      terminStatuses.some(s => s === "SIAP_TAGIH")     ? "SIAP_TAGIH"     :
                      terminStatuses.every(s => s === "LUNAS")         ? "LUNAS"          :
                      terminStatuses.some(s => s === "LUNAS")          ? "PROSES_COLLECT" :
                      "TERKUNCI"

                    const pctColor = row.physical_progress >= 90 ? "bg-emerald-500"
                                   : row.physical_progress >= 50 ? "bg-indigo-500"
                                   : "bg-amber-400"
                    const pctText  = row.physical_progress >= 90 ? "text-emerald-600"
                                   : row.physical_progress >= 50 ? "text-indigo-600"
                                   : "text-amber-600"

                    const lunasCount = terminStatuses.filter(s => s === "LUNAS").length

                    return (
                      <div key={row.project_key}>
                        {/* Summary row */}
                        <div
                          className={`grid px-5 py-4 items-center cursor-pointer transition-colors select-none ${
                            isOpen ? "bg-indigo-50/50" : "hover:bg-neutral-50"
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

                          {/* Col 2 — Progres */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pctColor}`} style={{ width: `${row.physical_progress}%` }} />
                              </div>
                              <span className={`text-[11px] font-bold tabular-nums w-8 text-right flex-shrink-0 ${pctText}`}>
                                {row.physical_progress}%
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-300">
                              {contractVal > 0 ? fShort(contractVal) : "—"}
                            </p>
                          </div>

                          {/* Col 3 — Termin preview chips */}
                          <div>
                            <div className="flex flex-wrap gap-1">
                              {row.termin_schedule.slice(0, 3).map((t, i) => {
                                const st = terminStatuses[i]
                                const chipColor =
                                  st === "LUNAS"          ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                                  st === "PROSES_COLLECT" ? "bg-blue-50 text-blue-600 border-blue-200"         :
                                  st === "SIAP_TAGIH"     ? "bg-amber-50 text-amber-600 border-amber-200"      :
                                  "bg-neutral-100 text-neutral-400 border-neutral-200"
                                return (
                                  <span key={t.id} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${chipColor}`}>
                                    T{i + 1} {t.target_progres}%
                                    {t.persen_tagihan ? ` · ${t.persen_tagihan}%` : ""}
                                  </span>
                                )
                              })}
                              {row.termin_schedule.length > 3 && (
                                <span className="text-[9px] text-neutral-300">
                                  +{row.termin_schedule.length - 3}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Col 4 — Status summary */}
                          <div>
                            <StatusBadge status={rowStatus} />
                            <p className="text-[10px] mt-1 text-neutral-400">
                              {lunasCount}/{row.termin_schedule.length} lunas
                            </p>
                          </div>
                        </div>

                        {/* Expanded termin blocks */}
                        {isOpen && (
                          <ProjectExpanded
                            project={row}
                            invoices={invCache[row.project_key]}
                            loadingInvoices={loadingKeys[row.project_key] ?? false}
                            onUpsert={(terminId, data) => handleUpsert(row.project_key, terminId, data)}
                            onPatch={(invoice, data)   => handlePatch(row.project_key, invoice, data)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <p className="text-[10px] text-center text-neutral-200">
                TOP = Terms of Payment · SOW Bridge auto-unlock saat progres Doc Con memenuhi syarat termin · Live 30s
              </p>
            </>
          )}

          {/* Empty search result */}
          {!loading && withTermin.length > 0 && displayed.length === 0 && q && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="h-8 w-8 text-neutral-200 mb-3" />
              <p className="text-sm font-medium text-neutral-400">
                Tidak ada hasil untuk &quot;{debouncedSearch}&quot;
              </p>
              <p className="text-xs text-neutral-300 mt-1">Coba nomor PO, nama proyek, atau nama klien.</p>
            </div>
          )}

        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
