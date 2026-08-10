"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import type { PurchaseRequestRecord } from "@/types/purchase-request"
import { needsStockValidation, isReadyToBuy, isInGudangPipeline, isInStockCheckQueue } from "@/lib/purchase-request/status-rules"
import type { PaginatedItemRow } from "@/app/api/purchase-requests/items/route"

async function safeJson(res: Response) {
  const text = await res.text()
  if (!text) return { error: `Server error (${res.status})` }
  try {
    return JSON.parse(text)
  } catch {
    return { error: text.slice(0, 300) || `Server error (${res.status})` }
  }
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const body = await safeJson(res)
  if (!res.ok) throw new Error(body.error ?? "Request failed")
  return body
}

// ─── Query keys ─────────────────────────────────────────────────────────────
// "pr-list"/"pr-items"/"pr-counts" are kept as distinct top-level keys (not
// nested under a shared "purchase-requests" prefix) so a queryKey-prefix
// sweep in applyUpdateToCache can never accidentally touch the counts cache.

export const prListQueryKey  = (status: string, q: string) => ["pr-list", status, q] as const
export const prItemsQueryKey = (queue: "stock_check" | "ready_to_buy", q: string) => ["pr-items", queue, q] as const
export const prCountsQueryKey = ["pr-counts"] as const

interface PrPage    { data: PurchaseRequestRecord[]; nextCursor: string | null }
interface ItemsPage { data: PaginatedItemRow[]; nextCursor: string | null }

// ─── Reads ──────────────────────────────────────────────────────────────────

export function usePurchaseRequestsInfinite(status: string, q: string) {
  return useInfiniteQuery({
    queryKey: prListQueryKey(status, q),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "30" })
      if (pageParam) params.set("cursor", pageParam as string)
      if (status && status !== "ALL") params.set("status", status)
      if (q) params.set("q", q)
      return fetchJson<PrPage>(`/api/purchase-requests?${params.toString()}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}

export function usePurchaseRequestItemsInfinite(queue: "stock_check" | "ready_to_buy", q: string) {
  return useInfiniteQuery({
    queryKey: prItemsQueryKey(queue, q),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "30", queue })
      if (pageParam) params.set("cursor", pageParam as string)
      if (q) params.set("q", q)
      return fetchJson<ItemsPage>(`/api/purchase-requests/items?${params.toString()}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}

export interface PurchaseRequestCounts {
  counts:      Record<string, number>
  stockCheck:  number
  readyToBuy:  number
}

export function usePurchaseRequestCounts() {
  return useQuery({
    queryKey: prCountsQueryKey,
    queryFn:  () => fetchJson<PurchaseRequestCounts>("/api/purchase-requests/counts"),
  })
}

// ─── Zero-lag cache splicing ────────────────────────────────────────────────
//
// Replaces the old single-array applyUpdate()'s .map(). The critical
// difference from a naive in-place patch: every cached page belongs to a
// query with its OWN status/q/queue filter, and a mutation can move a record
// OUT of what a specific cached page's filter matches (e.g. a PR moves
// WAITING_PAYMENT -> PURCHASED while the "Menunggu Pembayaran" tab's page is
// cached — that record must be evicted from that page, not just patched in
// place with a status that no longer belongs there). matchesPrFilter and the
// per-queue predicates below decide membership per cached query, read off
// that query's own key (not assumed) via getQueryCache().findAll().
function matchesPrFilter(pr: PurchaseRequestRecord, status: string, q: string): boolean {
  if (q) {
    const needle = q.toLowerCase()
    const haystack = `${pr.pr_no} ${pr.site_maintenance} ${pr.unit}`.toLowerCase()
    if (!haystack.includes(needle)) return false
  }
  if (!status || status === "ALL") return true
  // Both buckets are item-derived, not literal status matches — mirrors the
  // server's fetchGudangPipelineIds/fetchStockCheckQueueIds in
  // app/api/purchase-requests/route.ts, so optimistic cache membership never
  // disagrees with what a refetch of the same filter would actually return.
  if (status === "ARRIVED_AT_WAREHOUSE") return isInGudangPipeline(pr)
  if (status === "PENDING_STOCK_CHECK") return isInStockCheckQueue(pr)
  return pr.status === status
}

export function applyUpdateToCache(queryClient: QueryClient, updated: PurchaseRequestRecord) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ["pr-list"] })) {
    const [, status, q] = query.queryKey as [string, string, string]
    const matches = matchesPrFilter(updated, status, q)
    queryClient.setQueryData<{ pages: PrPage[]; pageParams: unknown[] }>(query.queryKey, (old) => {
      if (!old) return old
      let found = false
      const pages = old.pages.map(page => {
        const idx = page.data.findIndex(r => r.id === updated.id)
        if (idx === -1) return page
        found = true
        if (matches) {
          const data = [...page.data]
          data[idx] = updated
          return { ...page, data }
        }
        return { ...page, data: page.data.filter(r => r.id !== updated.id) }
      })
      // Newly-matching record not present in any loaded page (e.g. a PR that
      // just entered this filtered tab's bucket) — optimistically prepend to
      // the first page rather than waiting for a refetch.
      if (!found && matches && pages.length > 0) {
        pages[0] = { ...pages[0], data: [updated, ...pages[0].data] }
      }
      return { ...old, pages }
    })
  }

  for (const query of queryClient.getQueryCache().findAll({ queryKey: ["pr-items"] })) {
    const [, queue] = query.queryKey as [string, "stock_check" | "ready_to_buy", string]
    const pred = queue === "stock_check" ? needsStockValidation : isReadyToBuy
    queryClient.setQueryData<{ pages: ItemsPage[]; pageParams: unknown[] }>(query.queryKey, (old) => {
      if (!old) return old
      const presentIds = new Set<string>()
      let pages = old.pages.map(page => ({
        ...page,
        data: page.data.flatMap((row) => {
          if (row.pr.id !== updated.id) return [row]
          const item = updated.items.find(it => it.id === row.item.id)
          if (!item) return [] // item was removed from the PR entirely
          presentIds.add(item.id)
          if (!pred(item)) return [] // no longer belongs in this queue
          return [{ item, pr: updated }]
        }),
      }))
      const newlyQualifying = updated.items.filter(it => pred(it) && !presentIds.has(it.id))
      if (newlyQualifying.length > 0 && pages.length > 0) {
        pages = [
          { ...pages[0], data: [...newlyQualifying.map(item => ({ item, pr: updated })), ...pages[0].data] },
          ...pages.slice(1),
        ]
      }
      return { ...old, pages }
    })
  }

  // Tab badges/KPIs: cheap to recompute (small aggregate counts, zero rows
  // transferred) but computing the exact before/after delta here would need
  // the pre-mutation record, which callers don't have on hand — a full
  // refetch of just this endpoint is a deliberate, low-cost simplification,
  // not a refetch of any record list.
  queryClient.invalidateQueries({ queryKey: prCountsQueryKey })
}

export function removePrFromCache(queryClient: QueryClient, id: string) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ["pr-list"] })) {
    queryClient.setQueryData<{ pages: PrPage[]; pageParams: unknown[] }>(query.queryKey, (old) => {
      if (!old) return old
      return { ...old, pages: old.pages.map(page => ({ ...page, data: page.data.filter(r => r.id !== id) })) }
    })
  }
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ["pr-items"] })) {
    queryClient.setQueryData<{ pages: ItemsPage[]; pageParams: unknown[] }>(query.queryKey, (old) => {
      if (!old) return old
      return { ...old, pages: old.pages.map(page => ({ ...page, data: page.data.filter(row => row.pr.id !== id) })) }
    })
  }
  queryClient.invalidateQueries({ queryKey: prCountsQueryKey })
}

// ─── Mutations ──────────────────────────────────────────────────────────────
// Route contracts are unchanged — every one of these still returns the full
// updated PurchaseRequestRecord (or an array of them for the bulk route), so
// applyUpdateToCache can splice the response into every relevant cached page
// with no extra round trip.

export function useUpdateItemMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ prId, itemId, patch }: { prId: string; itemId: string; patch: Record<string, unknown> }) =>
      fetchJson<{ data: PurchaseRequestRecord }>(`/api/purchase-requests/${prId}/items/${itemId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      }),
    onSuccess: ({ data }) => applyUpdateToCache(queryClient, data),
  })
}

export function useBulkMarkPurchasedMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemIds: string[]) =>
      fetchJson<{ data: PurchaseRequestRecord[] }>("/api/purchase-requests/items/bulk-mark-purchased", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ item_ids: itemIds }),
      }),
    onSuccess: ({ data }) => data.forEach(pr => applyUpdateToCache(queryClient, pr)),
  })
}

export function useUpdatePrStatusMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, rejection_reason, actor_email }: {
      id: string; status: string; rejection_reason?: string; actor_email?: string
    }) =>
      fetchJson<{ data: PurchaseRequestRecord }>(`/api/purchase-requests/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status, rejection_reason, actor_email }),
      }),
    onSuccess: ({ data }) => applyUpdateToCache(queryClient, data),
  })
}

export function useDeletePrMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, actor_email }: { id: string; actor_email?: string }) =>
      fetchJson<{ success: true }>(`/api/purchase-requests/${id}`, {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ actor_email }),
      }).then(() => id),
    // Optimistic — DELETE returns no record to splice, so remove by id
    // immediately instead of waiting on the response (replaces the old
    // loadPrs() full reload, the one remaining non-zero-lag mutation).
    onMutate: async (vars) => {
      removePrFromCache(queryClient, vars.id)
    },
    onSuccess: (id) => removePrFromCache(queryClient, id),
  })
}
