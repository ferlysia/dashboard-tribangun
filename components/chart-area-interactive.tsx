"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export type ChartData = {
  month: string
  revenue: number
}

export function ChartAreaInteractive({
  data,
}: {
  data: ChartData[]
}) {
  return (
    <div className="rounded-xl border bg-background p-6">
      {/* HEADER */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold">
          Revenue Trend 2025
        </h3>
        <p className="text-sm text-muted-foreground">
          Total pendapatan bulanan dari Penjualan Unit, Material,
          dan Kontrak Maintenance
        </p>
      </div>

      {/* CHART */}
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.6} />
                <stop offset="95%" stopColor="currentColor" stopOpacity={0.08} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `Rp ${(v / 1_000_000_000).toFixed(1)}B`}
            />

            {/* ✅ CUSTOM TOOLTIP – DARK MODE FRIENDLY */}
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-sm text-primary">
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      }).format(payload[0].value as number)}
                    </p>
                  </div>
                )
              }}
            />

            <Area
              type="monotone"
              dataKey="revenue"
              stroke="currentColor"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              className="text-primary"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
