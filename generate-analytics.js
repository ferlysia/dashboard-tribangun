const fs = require("fs")

const invoices = JSON.parse(
  fs.readFileSync("./data/invoices-2025.json", "utf8")
)

// ======================
// BASIC STATS
// ======================

const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0)

const paidInvoices = invoices.filter(inv => inv.status === "PAID")
const unpaidInvoices = invoices.filter(inv => inv.status === "UNPAID")

const paidRevenue = paidInvoices.reduce((sum, inv) => sum + inv.total, 0)
const unpaidRevenue = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0)

// ======================
// MONTHLY REVENUE
// ======================

const monthlyRevenue = Array.from({ length: 12 }, (_, i) => ({
  month: i + 1,
  revenue: 0
}))

invoices.forEach(inv => {
  if (inv.month >= 1 && inv.month <= 12) {
    monthlyRevenue[inv.month - 1].revenue += inv.total
  }
})

// ======================
// MONTHLY GROWTH
// ======================

const monthlyGrowth = monthlyRevenue.map((item, index) => {
  if (index === 0) {
    return { month: item.month, growth: 0 }
  }

  const prev = monthlyRevenue[index - 1].revenue
  const current = item.revenue

  const growth = prev === 0
    ? 0
    : ((current - prev) / prev) * 100

  return {
    month: item.month,
    growth: Number(growth.toFixed(2))
  }
})

// ======================
// TOP CUSTOMERS
// ======================

const customerMap = {}

invoices.forEach(inv => {
  if (!customerMap[inv.customer]) {
    customerMap[inv.customer] = 0
  }
  customerMap[inv.customer] += inv.total
})

const topCustomers = Object.entries(customerMap)
  .map(([customer, total]) => ({ customer, total }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 5)

// ======================
// FINAL OBJECT
// ======================

const analytics = {
  summary: {
    totalInvoices: invoices.length,
    totalRevenue,
    paidRevenue,
    unpaidRevenue,
    paidCount: paidInvoices.length,
    unpaidCount: unpaidInvoices.length
  },
  monthlyRevenue,
  monthlyGrowth,
  topCustomers
}

// save file
fs.writeFileSync(
  "./data/dashboard-analytics.json",
  JSON.stringify(analytics, null, 2)
)

console.log("✅ dashboard-analytics.json berhasil dibuat!")
