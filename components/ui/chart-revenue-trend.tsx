"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type Invoice = {
  date: string
  amount: number
}

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--primary)",
  },
} satisfies ChartConfig

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function ChartRevenueTrend({ invoices }: { invoices: Invoice[] }) {
  // ✅ INIT 12 BULAN (URUT)
  const data = MONTHS.map((month, index) => ({
    month,
    revenue: invoices
      .filter(inv => new Date(inv.date).getMonth() === index)
      .reduce((sum, inv) => sum + inv.amount, 0),
  }))

  return (
    <div className="rounded-xl border bg-card p-6">
      {/* HEADER */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Revenue Trend</h3>
        <p className="text-sm text-muted-foreground">
          Monthly business revenue (IDR)
        </p>
      </div>

      <ChartContainer
        config={chartConfig}
        className="h-[340px] w-full"
      >
        <AreaChart
          data={data}
          margin={{ top: 10, left: 20, right: 20, bottom: 0 }}
        >
          {/* GRADIENT */}
          <defs>
            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-revenue)"
                stopOpacity={0.45}
              />
              <stop
                offset="95%"
                stopColor="var(--color-revenue)"
                stopOpacity={0.05}
              />
            </linearGradient>
          </defs>

          {/* GRID */}
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            className="stroke-muted"
          />

          {/* X AXIS */}
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tick={{ fontSize: 12 }}
          />

          {/* Y AXIS – CLEAN FINANCE FORMAT */}
          <YAxis
            width={76}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
            tickFormatter={(v) =>
              v >= 1_000_000_000
                ? `Rp ${(v / 1_000_000_000).toFixed(1)} B`
                : `Rp ${(v / 1_000_000).toFixed(0)} M`
            }
          />

          {/* TOOLTIP */}
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) =>
                  new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  }).format(value as number)
                }
              />
            }
          />

          {/* AREA */}
          <Area
            dataKey="revenue"
            type="monotone"
            stroke="var(--color-revenue)"
            strokeWidth={2}
            fill="url(#fillRevenue)"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
