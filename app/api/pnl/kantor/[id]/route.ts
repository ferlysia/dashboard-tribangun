import { makeDetailItemHandlers } from "@/lib/pnl-detail-handlers"
import { PNL_KANTOR_CATEGORIES } from "@/lib/pnl"

const { PATCH, DELETE } = makeDetailItemHandlers(
  "pnl_kantor_details",
  new Set(PNL_KANTOR_CATEGORIES.map((c) => c.key))
)

export { PATCH, DELETE }
