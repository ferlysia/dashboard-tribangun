"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Invoice = {
  date: string
  status: "PAID" | "UNPAID"
}

const chartConfig = {
  paid: {
    label: "Paid",
    color: "var(--primary)",
  },
  unpaid: {
    label: "Outstanding",
    color: "var(--destructive)",
  },
} satisfies ChartConfig

export function ChartInvoiceVolume({ invoices }: { invoices: Invoice[] }) {
  const data = Array.from({ length: 12 }, (_, i) => {
    const month = new Date(2025, i).toLocaleString("en-US", { month: "short" })
    return {
      month,
      paid: invoices.filter(
        inv => new Date(inv.date).getMonth() === i && inv.status === "PAID"
      ).length,
      unpaid: invoices.filter(
        inv => new Date(inv.date).getMonth() === i && inv.status === "UNPAID"
      ).length,
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Volume 2025</CardTitle>
      </CardHeader>

      <CardContent className="h-[320px]">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" />
            <YAxis allowDecimals={false} />

            <ChartTooltip content={<ChartTooltipContent />} />

            <Bar
              dataKey="paid"
              fill="var(--color-paid)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="unpaid"
              fill="var(--color-unpaid)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
