"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useProjects, useCreateProject } from "../_hooks/use-tool-inspection"

const NEW_PROJECT_VALUE = "__new_project__"
const inputCls = "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40"

// The Construction/Project division has no fixed registry the way
// Maintenance's `sites` does — a new project (e.g. "GAIA Data Center") can
// show up any week, so typing a brand-new one has to work inline here
// rather than requiring a separate admin screen first.
export function ProjectPicker({ value, onChange, triggerClassName }: {
  value:              string | null
  onChange:           (projectId: string) => void
  triggerClassName?:  string
}) {
  const { data: projects, isLoading } = useProjects()
  const createProject = useCreateProject()

  const [adding, setAdding] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newLocation, setNewLocation] = React.useState("")

  const handleSelect = (v: string) => {
    if (v === NEW_PROJECT_VALUE) {
      setAdding(true)
      return
    }
    onChange(v)
  }

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) {
      toast.error("Nama project tidak boleh kosong.")
      return
    }
    createProject.mutate({ name, location: newLocation.trim() || undefined }, {
      onSuccess: (project) => {
        onChange(project.id)
        setAdding(false)
        setNewName(""); setNewLocation("")
        toast.success(`Project "${project.name}" ditambahkan.`)
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menambahkan project."),
    })
  }

  if (adding) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          autoFocus
          className={inputCls}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleCreate() }}
          placeholder="Nama project baru (mis. GAIA Data Center)"
        />
        <input
          className={inputCls}
          value={newLocation}
          onChange={e => setNewLocation(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleCreate() }}
          placeholder="Lokasi (opsional)"
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={handleCreate} disabled={createProject.isPending}>Simpan</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => { setAdding(false); setNewName(""); setNewLocation("") }}>Batal</Button>
        </div>
      </div>
    )
  }

  const selectedName = projects?.find(p => p.id === value)?.name

  return (
    <Select value={value ?? undefined} onValueChange={handleSelect}>
      <SelectTrigger className={triggerClassName ?? "h-9 w-[240px]"}>
        <SelectValue placeholder={isLoading ? "Memuat project…" : "Pilih project"}>{selectedName}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NEW_PROJECT_VALUE} className="font-medium text-primary">
          <Plus className="h-3.5 w-3.5" /> Tambah Project Baru
        </SelectItem>
        {(projects ?? []).length > 0 && <SelectSeparator />}
        {(projects ?? []).map(p => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
