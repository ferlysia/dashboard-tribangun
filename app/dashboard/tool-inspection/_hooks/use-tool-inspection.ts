"use client"

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  ToolCatalogItem, ToolInspection, ToolInspectionItem, ToolInspectionPhoto, ToolInspectionProject,
} from "@/lib/tool-inspection/types"

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Request failed")
  return body
}

// ── Projects (Construction/Project division — separate from Maintenance's
// `sites`, see 20260821_tool_inspection_projects.sql) ───────

export function useProjects() {
  return useQuery({
    queryKey: ["tool-inspection", "projects"],
    queryFn: () => fetchJson<{ data: ToolInspectionProject[] }>("/api/tool-inspection-projects").then(r => r.data),
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; location?: string }) =>
      fetchJson<{ data: ToolInspectionProject }>("/api/tool-inspection-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-inspection", "projects"] })
    },
  })
}

// ── Catalog ──────────────────────────────────────────────────

export function useCatalog(projectId: string | null) {
  return useQuery({
    queryKey: ["tool-inspection", "catalog", projectId],
    queryFn: () => fetchJson<{ data: ToolCatalogItem[] }>(
      `/api/tool-catalog?project_id=${projectId}&include_inactive=true`
    ).then(r => r.data),
    enabled: !!projectId,
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

export function useCreateCatalogItems(projectId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: NewCatalogItem[]) =>
      fetchJson<{ data: ToolCatalogItem[] }>("/api/tool-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, items }),
      }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-inspection", "catalog", projectId] })
    },
  })
}

export function usePatchCatalogItem(projectId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ToolCatalogItem> }) =>
      fetchJson<{ data: ToolCatalogItem }>(`/api/tool-catalog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-inspection", "catalog", projectId] })
    },
  })
}

// ── Inspections (list) ──────────────────────────────────────

interface InspectionListRow extends ToolInspection { item_count: number }
interface InspectionsPage { data: InspectionListRow[]; nextCursor: string | null }

export function useInspectionsInfinite(projectId: string | null) {
  return useInfiniteQuery({
    queryKey: ["tool-inspection", "inspections", projectId],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ project_id: projectId || "", limit: "20" })
      if (pageParam) params.set("cursor", pageParam)
      return fetchJson<InspectionsPage>(`/api/tool-inspections?${params}`)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!projectId,
  })
}

export interface NewInspection {
  project_id:          string
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
      queryClient.invalidateQueries({ queryKey: ["tool-inspection", "inspections", data.project_id] })
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
