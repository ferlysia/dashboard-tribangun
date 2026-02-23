export type AnalyticsData = {
  summary: {
    totalInvoices: number
    totalRevenue: number
    paidRevenue: number
    unpaidRevenue: number
    paidCount: number
    unpaidCount: number
  }

  monthlyRevenue: {
    month: number
    revenue: number
  }[]

  monthlyGrowth: {
    month: number
    growth: number
  }[]

  topCustomers: {
    customer: string
    total: number
  }[]
}