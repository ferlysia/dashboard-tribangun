import { makeDetailListHandlers } from "@/lib/pnl-detail-handlers"
import { PNL_PROYEK_CATEGORIES } from "@/lib/pnl"

const { GET, POST } = makeDetailListHandlers(
  "pnl_proyek_details",
  new Set(PNL_PROYEK_CATEGORIES.map((c) => c.key))
)

export { GET, POST }
