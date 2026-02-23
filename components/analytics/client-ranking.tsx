"use client"

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n)

export function ClientRanking({
  clients,
  totalRevenue,
}: {
  clients: { name: string; value: number }[]
  totalRevenue: number
}) {
  return (
    <div className="space-y-4">
      {clients.map((client, i) => {
        const pct = totalRevenue > 0 ? (client.value / totalRevenue) * 100 : 0
        return (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="font-medium truncate">{client.name}</span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums font-mono">
                {pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary opacity-80"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground pl-7">{formatIDR(client.value)}</p>
          </div>
        )
      })}
    </div>
  )
}