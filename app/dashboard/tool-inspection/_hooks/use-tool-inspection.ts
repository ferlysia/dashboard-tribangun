"use client"

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  ToolCatalogItem, ToolInspection, ToolInspectionItem, ToolInspectionPhoto,
} from "@/lib/tool-inspection/types"

export interface SiteOption { id: string; name: string }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Request failed")
  return body
}

// ── Sites ────────────────────────────────────────────────────

export function useSites() {
  return useQuery({
    queryKey: ["tool-inspection", "sites"],
    queryFn: () => fetchJson<{ data: SiteOption[] }>("/api/sites").then(r => r.data),
  })
}

// ── Catalog ──────────────────────────────────────────────────

export function useCatalog(siteId: string | null) {
  return useQuery({
    queryKey: ["tool-inspection", "catalog", siteId],
    queryFn: () => fetchJson<{ data: ToolCatalogItem[] }>(
      `/api/tool-catalog?site_id=${siteId}&include_inactive=true`
    ).then(r => r.data),
    enabled: !!siteId,
  })
}

export interface NewCatalogItem {
  line_no?:     number
  name:         string
  category?:    string | null
  item_kind:    "ASSET" | "CONSUMABLE"
  unit:         string
  default_qty?: number
  asset_no?:    string | null
}

export function useCreateCatalogItems(siteId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: NewCatalogItem[]) =>
      fetchJson<{ data: ToolCatalogItem[] }>("/api/tool-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId, items }),
      }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-inspection", "catalog", siteId] })
    },
  })
}

export function usePatchCatalogItem(siteId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ToolCatalogItem> }) =>
      fetchJson<{ data: ToolCatalogItem }>(`/api/tool-catalog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-inspection", "catalog", siteId] })
    },
  })
}

// ── Inspections (list) ──────────────────────────────────────

interface InspectionListRow extends ToolInspection { item_count: number }
interface InspectionsPage { data: InspectionListRow[]; nextCursor: string | null }

export function useInspectionsInfinite(siteId: string | null) {
  return useInfiniteQuery({
    queryKey: ["tool-inspection", "inspections", siteId],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ site_id: siteId || "", limit: "20" })
      if (pageParam) params.set("cursor", pageParam)
      return fetchJson<InspectionsPage>(`/api/tool-inspections?${params}`)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!siteId,
  })
}

export interface NewInspection {
  site_id:             string
  project_name:        string
  project_location?:   string
  inspection_date:     string
  week_label:          string
  responsible_person:  string
  inspector:           string
}

export function useCreateInspection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewInspection) =>
      fetchJson<{ data: ToolInspection }>("/api/tool-inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tool-inspection", "inspections", data.site_id] })
    },
  })
}

// ── Single inspection (fill-out form) ───────────────────────

export function useInspection(id: string | null) {
  return useQuery({
    queryKey: ["tool-inspection", "inspection", id],
    queryFn: () => fetchJson<{ data: ToolInspection }>(`/api/tool-inspections/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function usePatchInspectionHeader(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<ToolInspection> & { submit?: boolean }) =>
      fetchJson<{ data: ToolInspection }>(`/api/tool-inspections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-inspection", "inspection", id] })
    },
  })
}

// Row-level autosave — deliberately does NOT invalidate the parent query on
// every keystroke (that would refetch all 30-190 rows and re-render the
// whole virtualized list). The caller already holds the authoritative local
// draft; this just persists it in the background.
export function usePatchInspectionItem(inspectionId: string) {
  return useMutation({
    mutationFn: ({ itemId, patch }: { itemId: string; patch: Partial<ToolInspectionItem> }) =>
      fetchJson<{ data: ToolInspectionItem }>(
        `/api/tool-inspections/${inspectionId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      ).then(r => r.data),
  })
}

export function useUploadInspectionPhoto(inspectionId: string) {
  return useMutation({
    mutationFn: ({ itemId, file }: { itemId: string; file: File }) => {
      const formData = new FormData()
      formData.append("file", file)
      return fetchJson<{ data: ToolInspectionPhoto }>(
        `/api/tool-inspections/${inspectionId}/items/${itemId}/photo`,
        { method: "POST", body: formData }
      ).then(r => r.data)
    },
  })
}

export function useDeleteInspectionPhoto(inspectionId: string) {
  return useMutation({
    mutationFn: ({ itemId, photoId }: { itemId: string; photoId: string }) =>
      fetchJson<{ data: { id: string } }>(
        `/api/tool-inspections/${inspectionId}/items/${itemId}/photo?photo_id=${photoId}`,
        { method: "DELETE" }
      ),
  })
}
