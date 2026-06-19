"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { formatPeriodLabel, formatThousands, type PnlHistoryRecord } from "@/lib/pnl"

export function HistoryTable({
  rows,
  loading,
  onSelectRow,
}: {
  rows: PnlHistoryRecord[]
  loading: boolean
  onSelectRow: (record: PnlHistoryRecord) => void
}) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Laporan Tersimpan</h2>
        {loading && <Loader2 className="h-3.5 w-3.5 text-zinc-500 animate-spin" />}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-zinc-500">
          {loading ? "Memuat riwayat..." : "Belum ada laporan tersimpan"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/60">
                <th className="text-left py-2.5 px-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Perusahaan
                </th>
                <th className="text-left py-2.5 px-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Project Name
                </th>
                <th className="text-right py-2.5 px-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Laba
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectRow(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelectRow(row)
                  }}
                  className="border-b border-zinc-800/40 last:border-0 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="py-2.5 px-4 text-sm text-zinc-300">{row.perusahaan || "-"}</td>
                  <td className="py-2.5 px-4">
                    <div className="text-sm text-zinc-100 font-medium">{row.project_name || "-"}</div>
                    <div className="text-[11px] text-zinc-500">
                      {formatPeriodLabel(row.period_type, row.period_year, row.period_month)}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right text-sm font-medium text-zinc-100 tabular-nums">
                    {formatThousands(String(row.laba_bersih_fiskal))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
