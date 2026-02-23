import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Package, CreditCard, Activity } from "lucide-react"

type Invoice = {
  invoice_no: string
  amount: number
  status: "PAID" | "UNPAID"
}

// Tambahkan onFilter di sini biar bisa "ngomong" ke Page
export function SectionCards({ invoices, onFilter }: { invoices: Invoice[], onFilter: (status: string | null) => void }) {
  const totalRevenue = invoices.reduce((sum, i) => sum + i.amount, 0)
  const paidInvoices = invoices.filter(i => i.status === "PAID").length
  const unpaidInvoices = invoices.filter(i => i.status === "UNPAID").length

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Klik ini buat balik ke semua data */}
      <Card className="transition-all hover:scale-105 cursor-pointer hover:border-blue-500" onClick={() => onFilter(null)}>
        <CardHeader className="flex flex-row justify-between pb-2">
          <CardTitle className="text-sm">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">Rp {totalRevenue.toLocaleString("id-ID")}</div>
          <p className="text-xs text-muted-foreground">Invoice 2025</p>
        </CardContent>
      </Card>

      <Card className="transition-all hover:scale-105 cursor-pointer hover:border-blue-500" onClick={() => onFilter(null)}>
        <CardHeader className="flex flex-row justify-between pb-2">
          <CardTitle className="text-sm">Total Invoices</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{invoices.length}</div>
          <p className="text-xs text-muted-foreground">Units / Projects</p>
        </CardContent>
      </Card>

      {/* KLIK INI CUMA MUNCULIN YANG PAID */}
      <Card className="transition-all hover:scale-105 cursor-pointer hover:border-green-500" onClick={() => onFilter("PAID")}>
        <CardHeader className="flex flex-row justify-between pb-2">
          <CardTitle className="text-sm">Paid</CardTitle>
          <CreditCard className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{paidInvoices}</div>
          <p className="text-xs text-green-600">Completed</p>
        </CardContent>
      </Card>

      {/* KLIK INI CUMA MUNCULIN YANG UNPAID */}
      <Card className="transition-all hover:scale-105 cursor-pointer hover:border-red-500" onClick={() => onFilter("UNPAID")}>
        <CardHeader className="flex flex-row justify-between pb-2">
          <CardTitle className="text-sm">Outstanding</CardTitle>
          <Activity className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{unpaidInvoices}</div>
          <p className="text-xs text-red-600">Pending</p>
        </CardContent>
      </Card>
    </div>
  )
}