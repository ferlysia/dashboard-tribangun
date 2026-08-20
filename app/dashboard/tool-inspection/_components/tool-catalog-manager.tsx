"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { useSites, useCatalog, useCreateCatalogItems, usePatchCatalogItem, type NewCatalogItem } from "../_hooks/use-tool-inspection"

const inputCls = "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-background text-sm text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/40"

let tempIdCounter = 0
function nextTempId() {
  tempIdCounter += 1
  return `draft-${tempIdCounter}`
}

interface RowDraft extends NewCatalogItem {
  tempId: string
}

function emptyDraft(): RowDraft {
  return { tempId: nextTempId(), name: "", category: "", item_kind: "ASSET", unit: "Pcs", default_qty: 1, asset_no: "" }
}

export function ToolCatalogManager() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: sites, isLoading: sitesLoading } = useSites()

  const siteId = searchParams.get("site") || sites?.[0]?.id || null
  const setSiteId = (id: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("site", id)
    router.replace(`?${params.toString()}`, { scroll: false })
  }
  React.useEffect(() => {
    if (!searchParams.get("site") && sites && sites.length > 0) setSiteId(sites[0].id)
  }, [sites]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: catalog, isLoading: catalogLoading } = useCatalog(siteId)
  const createItems = useCreateCatalogItems(siteId)
  const patchItem = usePatchCatalogItem(siteId)

  const [drafts, setDrafts] = React.useState<RowDraft[]>([emptyDraft()])
  const updateDraft = (tempId: string, patch: Partial<RowDraft>) =>
    setDrafts(prev => prev.map(d => d.tempId === tempId ? { ...d, ...patch } : d))
  const removeDraft = (tempId: string) =>
    setDrafts(prev => prev.length > 1 ? prev.filter(d => d.tempId !== tempId) : prev)
  const addDraft = () => setDrafts(prev => [...prev, emptyDraft()])

  const handleSaveDrafts = () => {
    const valid = drafts.filter(d => d.name.trim() && d.unit.trim())
    if (valid.length === 0) {
      toast.error("Isi minimal satu tool (nama + satuan).")
      return
    }
    const items: NewCatalogItem[] = valid.map(d => ({
      name: d.name.trim(),
      category: d.category?.trim() || null,
      item_kind: d.item_kind,
      unit: d.unit.trim(),
      default_qty: Number(d.default_qty) || 0,
      asset_no: d.asset_no?.trim() || null,
    }))
    createItems.mutate(items, {
      onSuccess: () => {
        toast.success(`${items.length} tool ditambahkan ke katalog.`)
        setDrafts([emptyDraft()])
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menambahkan tool."),
    })
  }

  const toggleActive = (id: string, is_active: boolean) => {
    patchItem.mutate({ id, patch: { is_active } }, {
      onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal memperbarui tool."),
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center gap-2">
        <Select value={siteId ?? undefined} onValueChange={setSiteId}>
          <SelectTrigger className="h-9 w-[240px]">
            <SelectValue placeholder={sitesLoading ? "Memuat site…" : "Pilih site"} />
          </SelectTrigger>
          <SelectContent>
            {(sites ?? []).map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">No.</TableHead>
              <TableHead>Tool / Equipment</TableHead>
              <TableHead className="w-28">Kind</TableHead>
              <TableHead className="w-24">Qty</TableHead>
              <TableHead className="w-20">Unit</TableHead>
              <TableHead className="w-32">Asset No.</TableHead>
              <TableHead className="w-20 text-center">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {catalogLoading ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Memuat katalog…</TableCell></TableRow>
            ) : (catalog ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Belum ada tool di katalog site ini.</TableCell></TableRow>
            ) : (catalog ?? []).map(item => (
              <TableRow key={item.id} className={!item.is_active ? "opacity-50" : undefined}>
                <TableCell className="text-xs text-muted-foreground">{item.line_no}</TableCell>
                <TableCell className="text-sm font-medium">
                  {item.name}
                  {item.category && <span className="ml-2 text-xs text-muted-foreground">({item.category})</span>}
                </TableCell>
                <TableCell>
                  <Badge variant={item.item_kind === "ASSET" ? "default" : "secondary"}>{item.item_kind}</Badge>
                </TableCell>
                <TableCell className="text-sm">{item.default_qty}</TableCell>
                <TableCell className="text-sm">{item.unit}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.asset_no ?? "—"}</TableCell>
                <TableCell className="text-center">
                  <Checkbox checked={item.is_active} onCheckedChange={(v) => toggleActive(item.id, v === true)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Tambah Tool Baru</p>
          <p className="text-xs text-muted-foreground">Baris kosong (tanpa nama) diabaikan saat disimpan.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Tool</TableHead>
              <TableHead className="w-28">Kategori</TableHead>
              <TableHead className="w-32">Kind</TableHead>
              <TableHead className="w-24">Qty</TableHead>
              <TableHead className="w-20">Unit</TableHead>
              <TableHead className="w-32">Asset No.</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.map(d => (
              <TableRow key={d.tempId}>
                <TableCell>
                  <input className={inputCls} value={d.name} onChange={e => updateDraft(d.tempId, { name: e.target.value })} placeholder="Winch Manual" />
                </TableCell>
                <TableCell>
                  <input className={inputCls} value={d.category ?? ""} onChange={e => updateDraft(d.tempId, { category: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Select value={d.item_kind} onValueChange={(v) => updateDraft(d.tempId, { item_kind: v as NewCatalogItem["item_kind"] })}>
                    <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASSET">Asset</SelectItem>
                      <SelectItem value="CONSUMABLE">Consumable</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <input type="number" min={0} className={inputCls} value={d.default_qty ?? 0} onChange={e => updateDraft(d.tempId, { default_qty: Number(e.target.value) })} />
                </TableCell>
                <TableCell>
                  <input className={inputCls} value={d.unit} onChange={e => updateDraft(d.tempId, { unit: e.target.value })} />
                </TableCell>
                <TableCell>
                  <input className={inputCls} value={d.asset_no ?? ""} onChange={e => updateDraft(d.tempId, { asset_no: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeDraft(d.tempId)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between px-4 py-3">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addDraft}>
            <Plus className="h-3.5 w-3.5" /> Tambah Baris
          </Button>
          <Button type="button" size="sm" disabled={createItems.isPending || !siteId} onClick={handleSaveDrafts}>
            {createItems.isPending ? "Menyimpan…" : "Simpan ke Katalog"}
          </Button>
        </div>
      </div>
    </div>
  )
}
