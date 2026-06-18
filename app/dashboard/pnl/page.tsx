"use client"

import * as React from "react"
import { toast } from "sonner"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { ChevronRight, Loader2, RefreshCw, Save } from "lucide-react"
import { MoneyInput } from "@/components/pnl/money-input"
import { GajiDrawer } from "@/components/pnl/gaji-drawer"
import { CategoryBreakdownDrawer } from "@/components/pnl/category-breakdown-drawer"
import {
  PNL_ROWS,
  PNL_PROYEK_CATEGORIES,
  PNL_KANTOR_CATEGORIES,
  emptyMatrix,
  recomputeMatrix,
  sumJumlah,
  type BreakdownKind,
  type PnlMatrixValues,
  type PnlGajiRow,
  type PnlDetailRow,
} from "@/lib/pnl"

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 4 + i)

export default function PnlPage() {
  const [periodType, setPeriodType] = React.useState<"monthly" | "yearly">("monthly")
  const [periodMonth, setPeriodMonth] = React.useState(new Date().getMonth() + 1)
  const [periodYear, setPeriodYear] = React.useState(CURRENT_YEAR)
  const [matrix, setMatrix] = React.useState<PnlMatrixValues>(emptyMatrix())
  const [pnlId, setPnlId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [openDrawer, setOpenDrawer] = React.useState<BreakdownKind | null>(null)

  const [gajiRows, setGajiRows] = React.useState<PnlGajiRow[]>([])
  const [proyekRows, setProyekRows] = React.useState<PnlDetailRow[]>([])
  const [kantorRows, setKantorRows] = React.useState<PnlDetailRow[]>([])

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
      setPnlId(data.id ?? null)

      if (data.id) {
        const [g, p, k] = await Promise.all([
          fetch(`/api/pnl/gaji?pnl_id=${data.id}`).then((r) => r.json()),
          fetch(`/api/pnl/proyek?pnl_id=${data.id}`).then((r) => r.json()),
          fetch(`/api/pnl/kantor?pnl_id=${data.id}`).then((r) => r.json()),
        ])
        setGajiRows(g.data ?? [])
        setProyekRows(p.data ?? [])
        setKantorRows(k.data ?? [])
      } else {
        setGajiRows([])
        setProyekRows([])
        setKantorRows([])
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat laporan P&L")
    } finally {
      setLoading(false)
    }
  }, [periodType, periodMonth, periodYear])

  React.useEffect(() => {
    loadPeriod()
  }, [loadPeriod])

  // BEBAN GAJI / PROYEK / KANTOR Komersial values are no longer manual — they
  // auto-sync from the sum of their breakdown drawer rows.
  const gajiTotal = React.useMemo(() => sumJumlah(gajiRows), [gajiRows])
  const proyekTotal = React.useMemo(() => sumJumlah(proyekRows), [proyekRows])
  const kantorTotal = React.useMemo(() => sumJumlah(kantorRows), [kantorRows])

  React.useEffect(() => {
    setMatrix((prev) =>
      recomputeMatrix({
        ...prev,
        beban_gaji: { ...prev.beban_gaji, komersial: gajiTotal },
        beban_keperluan_proyek: { ...prev.beban_keperluan_proyek, komersial: proyekTotal },
        beban_keperluan_kantor: { ...prev.beban_keperluan_kantor, komersial: kantorTotal },
      })
    )
  }, [gajiTotal, proyekTotal, kantorTotal])

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
      if (data.id) setPnlId(data.id)
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
                      const breakdownKind = row.kind === "input" ? row.breakdown : undefined
                      const isCosmeticDrilldown = !isCalc && !breakdownKind && row.indent

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
                              {...(breakdownKind
                                ? {
                                    role: "button" as const,
                                    tabIndex: 0,
                                    onClick: () => setOpenDrawer(breakdownKind),
                                    onKeyDown: (e: React.KeyboardEvent) => {
                                      if (e.key === "Enter" || e.key === " ") setOpenDrawer(breakdownKind)
                                    },
                                  }
                                : {})}
                              className={
                                "flex items-center gap-1.5 text-sm " +
                                (row.bold ? "font-semibold text-zinc-100" : "text-zinc-300") +
                                (breakdownKind ? " cursor-pointer hover:text-zinc-100" : isCosmeticDrilldown ? " cursor-pointer" : "")
                              }
                              title={
                                breakdownKind
                                  ? "Buka rincian breakdown"
                                  : isCosmeticDrilldown
                                    ? "Buka rincian breakdown (segera hadir)"
                                    : undefined
                              }
                            >
                              {row.indent && !row.bold ? "–" : ""}
                              <span>{row.label}</span>
                              {(breakdownKind || isCosmeticDrilldown) && (
                                <ChevronRight className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <MoneyInput
                              value={values.komersial}
                              disabled={isCalc || !!breakdownKind}
                              onChange={(next) => setCell(row.key, "komersial", next)}
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <MoneyInput
                              value={values.koreksi}
                              disabled={isCalc}
                              onChange={(next) => setCell(row.key, "koreksi", next)}
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <MoneyInput value={values.fiskal} disabled onChange={() => {}} />
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

        <GajiDrawer
          open={openDrawer === "gaji"}
          onOpenChange={(open) => setOpenDrawer(open ? "gaji" : null)}
          pnlId={pnlId}
          rows={gajiRows}
          onRowsChange={setGajiRows}
        />

        <CategoryBreakdownDrawer
          open={openDrawer === "proyek"}
          onOpenChange={(open) => setOpenDrawer(open ? "proyek" : null)}
          title="Rincian Beban Keperluan Proyek"
          description="Total gabungan 6 kategori ini otomatis menjadi nilai Komersial pada baris BEBAN KEPERLUAN PROYEK."
          categories={PNL_PROYEK_CATEGORIES}
          apiBase="/api/pnl/proyek"
          pnlId={pnlId}
          rows={proyekRows}
          onRowsChange={setProyekRows}
        />

        <CategoryBreakdownDrawer
          open={openDrawer === "kantor"}
          onOpenChange={(open) => setOpenDrawer(open ? "kantor" : null)}
          title="Rincian Beban Keperluan Kantor"
          description="Total gabungan 3 kategori ini otomatis menjadi nilai Komersial pada baris BEBAN KEPERLUAN KANTOR."
          categories={PNL_KANTOR_CATEGORIES}
          apiBase="/api/pnl/kantor"
          pnlId={pnlId}
          rows={kantorRows}
          onRowsChange={setKantorRows}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
