"use client"

import type { AttendanceFeedItem } from "../_hooks/use-attendance-feed"

export function LiveFeed({ items, isLoading }: { items: AttendanceFeedItem[] | undefined; isLoading: boolean }) {
  return (
    <div className="rounded-hr-3xl border border-hr-hairline bg-white p-5 shadow-hr-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-hr-display text-lg font-black text-hr-ink">Aktivitas Terbaru</h2>
        <span className="flex items-center gap-1.5 font-hr-sans text-[11px] font-semibold text-hr-text-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-hr-success" />
          Live
        </span>
      </div>

      {isLoading && <p className="font-hr-sans text-sm text-hr-text-2">Memuat...</p>}
      {!isLoading && (!items || items.length === 0) && (
        <p className="font-hr-sans text-sm text-hr-text-2">Belum ada clock-in pada tanggal ini.</p>
      )}

      <ul className="divide-y divide-hr-hairline">
        {items?.map(item => (
          <li key={item.id} className="flex items-center justify-between py-2.5">
            <div>
              <p className="font-hr-sans text-sm font-semibold text-hr-text">{item.fullName}</p>
              <p className="font-hr-sans text-xs text-hr-text-3">{item.siteName}</p>
            </div>
            <span className="font-hr-sans text-xs font-medium text-hr-text-2">
              {new Date(item.recordedAt).toLocaleTimeString("id-ID", {
                hour:     "2-digit",
                minute:   "2-digit",
                timeZone: "Asia/Jakarta",
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
