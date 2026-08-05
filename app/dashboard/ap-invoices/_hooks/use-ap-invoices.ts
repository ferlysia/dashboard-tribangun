"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ApInvoice, ApVendor } from "@/types/ap-invoice"

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
  return body.data as T
}

export const vendorsQueryKey = ["ap-vendors"] as const
export const invoicesQueryKey = ["ap-invoices"] as const

export function useVendorsQuery() {
  return useQuery({
    queryKey: vendorsQueryKey,
    queryFn:  () => fetchJson<ApVendor[]>("/api/ap-vendors"),
    staleTime: 5 * 60_000, // vendors change rarely
  })
}

// The single shared query every tab (Priority/All/By Vendor/Done) reads
// from — urgency bucketing happens client-side in status-rules.ts, so
// switching tabs never triggers a refetch.
export function useInvoicesQuery() {
  return useQuery({
    queryKey: invoicesQueryKey,
    queryFn:  () => fetchJson<ApInvoice[]>("/api/ap-invoices"),
  })
}

export interface InvoicePatch {
  id:              string
  po_date?:        string | null
  po_number?:      string | null
  project_name?:   string | null
  invoice_date?:   string | null
  invoice_number?: string | null
  dpp_amount?:     number | null
  ppn_amount?:     number | null
  pph_amount?:     number | null
  total_amount?:   number | null
  due_date?:       string | null
  payment_date?:   string | null
  notes?:          string | null
}

// One mutation hook for every inline cell edit and single-row Mark Paid
// (payment_date is just another field) — reused by every grid cell so an
// edit behaves identically everywhere. Same onMutate/onError/onSettled
// optimistic shape as useUpdateSchedule in
// app/dashboard/maintenance-schedule/_hooks/use-pm-schedules.ts.
export function useUpdateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (patch: InvoicePatch) =>
      fetchJson<ApInvoice>(`/api/ap-invoices/${patch.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: invoicesQueryKey })
      const previous = queryClient.getQueryData<ApInvoice[]>(invoicesQueryKey)
      queryClient.setQueryData<ApInvoice[]>(invoicesQueryKey, old =>
        old?.map(inv => (inv.id === patch.id ? { ...inv, ...patch } : inv)))
      return { previous }
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(invoicesQueryKey, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: invoicesQueryKey })
    },
  })
}

// Bulk "Mark N as Paid" — one request via /api/ap-invoices/bulk-paid
// instead of N sequential PATCHes, same optimistic shape as the single-row
// mutation above.
export function useBulkMarkPaid() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ ids, payment_date }: { ids: string[]; payment_date: string }) =>
      fetchJson<ApInvoice[]>("/api/ap-invoices/bulk-paid", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ids, payment_date }),
      }),
    onMutate: async ({ ids, payment_date }) => {
      await queryClient.cancelQueries({ queryKey: invoicesQueryKey })
      const previous = queryClient.getQueryData<ApInvoice[]>(invoicesQueryKey)
      const idSet = new Set(ids)
      queryClient.setQueryData<ApInvoice[]>(invoicesQueryKey, old =>
        old?.map(inv => (idSet.has(inv.id) ? { ...inv, payment_date } : inv)))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(invoicesQueryKey, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: invoicesQueryKey })
    },
  })
}

export interface NewInvoice {
  vendor_id:       string
  po_date?:        string | null
  po_number?:      string | null
  project_name?:   string | null
  // Progressive Entry: only vendor_id is required — the rest can be filled
  // in later via the edit modal.
  invoice_date?:   string | null
  invoice_number?: string | null
  dpp_amount?:     number | null
  ppn_amount?:     number | null
  pph_amount?:     number | null
  total_amount?:   number | null
  due_date?:       string | null
  notes?:          string | null
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (row: NewInvoice) =>
      fetchJson<ApInvoice>("/api/ap-invoices", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(row),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoicesQueryKey })
    },
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => fetchJson<{ id: string }>(`/api/ap-invoices/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: invoicesQueryKey })
      const previous = queryClient.getQueryData<ApInvoice[]>(invoicesQueryKey)
      queryClient.setQueryData<ApInvoice[]>(invoicesQueryKey, old => old?.filter(inv => inv.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(invoicesQueryKey, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: invoicesQueryKey })
    },
  })
}

// Backs the inline "+ Add Vendor" flow in CreateInvoiceDialog.
export function useCreateVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) =>
      fetchJson<ApVendor>("/api/ap-vendors", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorsQueryKey })
    },
  })
}

// Backs the "Import Excel" button — bulk-creates/updates invoices (and any
// new vendors) in one request, then invalidates both caches.
export function useImportInvoices() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/ap-invoices/import", { method: "POST", body: formData })
      const body = await safeJson(res)
      if (!res.ok) throw new Error(body.error ?? "Import failed")
      return body as { data: ApInvoice[]; errors: string[]; summary: { inserted: number; updated: number; vendorsCreated: number } }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoicesQueryKey })
      queryClient.invalidateQueries({ queryKey: vendorsQueryKey })
    },
  })
}
