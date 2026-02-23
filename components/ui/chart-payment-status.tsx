"use client"

import {
  PieChart,
  Pie,
  Cell,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Invoice = {
  status: "PAID" | "UNPAID"
  amount: number
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

export function ChartPaymentStatus({ invoices }: { invoices: Invoice[] }) {
  const paid = invoices
    .filter(i => i.status === "PAID")
    .reduce((a, b) => a + b.amount, 0)

  const unpaid = invoices
    .filter(i => i.status === "UNPAID")
    .reduce((a, b) => a + b.amount, 0)

  const total = paid + unpaid

  const data = [
    { name: "paid", value: paid },
    { name: "unpaid", value: unpaid },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Status</CardTitle>
      </CardHeader>

      <CardContent className="h-[320px] flex items-center justify-center relative">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={4}
            >
              <Cell fill="var(--color-paid)" />
              <Cell fill="var(--color-unpaid)" />
            </Pie>

            <ChartTooltip content={<ChartTooltipContent />} />
          </PieChart>
        </ChartContainer>

        <div className="absolute text-center">
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="text-2xl font-bold">
            {total ? Math.round((paid / total) * 100) : 0}%
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
