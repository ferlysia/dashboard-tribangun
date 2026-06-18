"use client"

import * as React from "react"
import { toast } from "sonner"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { ChevronRight, Loader2, RefreshCw, Save } from "lucide-react"
import { PNL_ROWS, emptyMatrix, recomputeMatrix, type PnlMatrixValues } from "@/lib/pnl"

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 4 + i)

const fIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)

function parseIDR(raw: string): number {
  const cleaned = raw.replace(/[^0-9-]/g, "")
  if (!cleaned || cleaned === "-") return 0
  return Number(cleaned)
}

// ─── Matrix cell input ──────────────────────────────────────────────────────
function MatrixInput({
  value,
  onCommit,
  disabled,
}: {
  value: number
  onCommit: (next: number) => void
  disabled?: boolean
}) {
  const [focused, setFocused] = React.useState(false)
  const [draft, setDraft] = React.useState(() => String(value))

  React.useEffect(() => {
    if (!focused) setDraft(value === 0 ? "" : fIDR(value))
  }, [value, focused])

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={focused ? draft : value === 0 ? "" : fIDR(value)}
      placeholder="0"
      onFocus={() => {
        setFocused(true)
        setDraft(value === 0 ? "" : String(value))
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false)
        onCommit(parseIDR(draft))
      }}
      className={
        "w-full bg-transparent text-right tabular-nums text-sm outline-none px-3 py-2 rounded-md border transition-colors " +
        (disabled
          ? "border-transparent bg-zinc-900/40 text-zinc-500 cursor-not-allowed"
          : "border-zinc-800/60 text-zinc-100 placeholder:text-zinc-600 hover:border-zinc-700 focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400")
      }
    />
  )
}

export default function PnlPage() {
  const [periodType, setPeriodType] = React.useState<"monthly" | "yearly">("monthly")
  const [periodMonth, setPeriodMonth] = React.useState(new Date().getMonth() + 1)
  const [periodYear, setPeriodYear] = React.useState(CURRENT_YEAR)
  const [matrix, setMatrix] = React.useState<PnlMatrixValues>(emptyMatrix())
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const loadPeriod = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        period_type: periodType,
        period_year: String(periodYear),
        ...(periodType === "monthly" ? { period_month: String(periodMonth) } : {}),
      })
      const res = await fetch(`/api/pnl?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal memuat laporan")
      setMatrix(recomputeMatrix(data.matrix))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat laporan P&L")
    } finally {
      setLoading(false)
    }
  }, [periodType, periodMonth, periodYear])

  React.useEffect(() => {
    loadPeriod()
  }, [loadPeriod])

  function setCell(key: string, column: "komersial" | "koreksi", next: number) {
    setMatrix((prev) => {
      const updated: PnlMatrixValues = {
        ...prev,
        [key]: { ...prev[key], [column]: next },
      }
      return recomputeMatrix(updated)
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/pnl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_type: periodType,
          period_year: periodYear,
          period_month: periodType === "monthly" ? periodMonth : 0,
          matrix,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan laporan")
      setMatrix(recomputeMatrix(data.matrix))
      toast.success("Laporan P&L tersimpan")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan laporan P&L")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex-1 bg-zinc-950">
          <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto">

            {/* Page header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-lg font-bold text-zinc-100 tracking-tight">Laporan Laba Rugi (P&amp;L)</h1>
                <p className="text-xs text-zinc-500 mt-0.5">Rekonsiliasi Komersial &middot; Koreksi &middot; Fiskal</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Monthly / Yearly toggle */}
                <div className="flex items-center rounded-lg border border-zinc-800/60 bg-zinc-900 p-0.5">
                  {(["monthly", "yearly"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPeriodType(opt)}
                      className={
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors " +
                        (periodType === opt
                          ? "bg-zinc-800 text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-300")
                      }
                    >
                      {opt === "monthly" ? "Bulanan" : "Tahunan"}
                    </button>
                  ))}
                </div>

                {periodType === "monthly" && (
                  <select
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(Number(e.target.value))}
                    className="h-9 rounded-lg border border-zinc-800/60 bg-zinc-900 px-3 text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                )}

                <select
                  value={periodYear}
                  onChange={(e) => setPeriodYear(Number(e.target.value))}
                  className="h-9 rounded-lg border border-zinc-800/60 bg-zinc-900 px-3 text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={loadPeriod}
                  disabled={loading}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-zinc-800/60 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors disabled:opacity-50"
                  title="Muat ulang"
                >
                  <RefreshCw className={"h-4 w-4" + (loading ? " animate-spin" : "")} />
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="h-9 px-4 flex items-center gap-2 rounded-lg bg-zinc-100 text-zinc-900 text-xs font-semibold hover:bg-white transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Simpan Laporan
                </button>
              </div>
            </div>

            {/* Matrix table */}
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/60">
                      <th className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400 w-[38%]">
                        Keterangan
                      </th>
                      <th className="text-right py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Komersial
                      </th>
                      <th className="text-right py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Koreksi
                      </th>
                      <th className="text-right py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Fiskal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {PNL_ROWS.map((row, idx) => {
                      if (row.kind === "section") {
                        return (
                          <tr key={`section-${idx}`} className="bg-zinc-900/60">
                            <td colSpan={4} className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                              {row.label}
                            </td>
                          </tr>
                        )
                      }

                      const values = matrix[row.key] ?? { komersial: 0, koreksi: 0, fiskal: 0 }
                      const isCalc = row.kind === "calc"
                      const isDrillable = !isCalc && row.indent

                      return (
                        <tr
                          key={row.key}
                          className={
                            "border-b border-zinc-800/40 last:border-0 group transition-colors hover:bg-zinc-800/30 " +
                            (row.bold ? "bg-zinc-900/40" : "")
                          }
                        >
                          <td className={"py-3.5 px-4 " + (row.indent ? "pl-8" : "")}>
                            <div
                              className={
                                "flex items-center gap-1.5 text-sm " +
                                (row.bold ? "font-semibold text-zinc-100" : "text-zinc-300") +
                                (isDrillable ? " cursor-pointer" : "")
                              }
                              title={isDrillable ? "Buka rincian breakdown (segera hadir)" : undefined}
                            >
                              {row.indent && !row.bold ? "–" : ""}
                              <span>{row.label}</span>
                              {isDrillable && (
                                <ChevronRight className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <MatrixInput
                              value={values.komersial}
                              disabled={isCalc}
                              onCommit={(next) => setCell(row.key, "komersial", next)}
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <MatrixInput
                              value={values.koreksi}
                              disabled={isCalc}
                              onCommit={(next) => setCell(row.key, "koreksi", next)}
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <MatrixInput value={values.fiskal} disabled onCommit={() => {}} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
