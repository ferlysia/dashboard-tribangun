import { makeDetailListHandlers } from "@/lib/pnl-detail-handlers"
import { PNL_KANTOR_CATEGORIES } from "@/lib/pnl"

const { GET, POST } = makeDetailListHandlers(
  "pnl_kantor_details",
  new Set(PNL_KANTOR_CATEGORIES.map((c) => c.key))
)

export { GET, POST }
