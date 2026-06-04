"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar }  from "@/components/app-sidebar"
import { SiteHeader }  from "@/components/site-header"
import { Toaster }     from "@/components/ui/sonner"
import { toast }       from "sonner"
import { useCurrentUser } from "@/components/providers/current-user-provider"
import { Badge }       from "@/components/ui/badge"
import { Button }      from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Separator }   from "@/components/ui/separator"
import { Progress }    from "@/components/ui/progress"
import { Skeleton }    from "@/components/ui/skeleton"
import {
  Search, Plus, Upload, FileText, AlertTriangle, CheckCircle2,
  Clock, RefreshCw, ChevronRight, X, Building2, Layers,
  Cpu, Hash, Calendar, Package, Shield, Download, Wrench,
  UploadCloud, FilePlus, FileWarning, ClipboardList, BarChart3,
} from "lucide-react"

// ─── Types ─────────────────────────────────────────────────────────────────────

type MilestoneStatus = "PENDING" | "DONE" | "OVERDUE"
type ContractStatus  = "ACTIVE" | "COMPLETED" | "EXPIRED" | "CANCELLED"
type DocumentType    = "ATP_REPORT" | "PM_LOG" | "INCIDENT_REPORT" | "CONTRACT_COPY" | "OTHER"

interface Milestone {
  id:                    string
  visit_number:          number
  scheduled_date:        string
  execution_date:        string | null
  status:                MilestoneStatus
  pm_report_url:         string | null
  pm_report_filename:    string | null
  pm_report_size_bytes:  number | null
  uploaded_by:           string | null
  notes:                 string | null
}

interface MaintenanceContract {
  id:                   string
  po_number:            string
  contract_start_date:  string
  contract_end_date:    string
  total_planned_visits: number
  contract_value:       number | null
  status:               ContractStatus
  milestones:           Milestone[]
}

interface AssetDocument {
  id:               string
  document_type:    DocumentType
  document_name:    string
  file_url:         string
  file_size_bytes:  number | null
  uploaded_by:      string
  uploaded_at:      string
  notes:            string | null
}

interface Asset {
  id:                   string
  serial_number:        string
  ne_id:                string
  site_id:              string
  site_name:            string
  floor:                string
  type_pac:             string
  brand:                string
  model:                string | null
  capacity_kw:          number | null
  customer_name:        string
  installation_date:    string | null
  warranty_expiry_date: string | null
  notes:                string | null
  contracts:            MaintenanceContract[]
  documents:            AssetDocument[]
}

// ─── Mock Data (replace with API fetch) ────────────────────────────────────────

const MOCK_ASSETS: Asset[] = [
  {
    id: "a1",
    serial_number:        "CLM-2024-00125",
    ne_id:                "TNG337/L02/CLM/052/03",
    site_id:              "TNG337",
    site_name:            "Graha Telkomsel Tangerang",
    floor:                "L02",
    type_pac:             "CLM",
    brand:                "Climaveneta",
    model:                "NECS-Q 0152",
    capacity_kw:          45.5,
    customer_name:        "PT Telkomsel",
    installation_date:    "2023-03-15",
    warranty_expiry_date: "2026-03-15",
    notes:                null,
    contracts: [
      {
        id: "c1", po_number: "PO-TSL-2024-0088",
        contract_start_date: "2024-01-01", contract_end_date: "2026-12-31",
        total_planned_visits: 6, contract_value: 85_000_000, status: "ACTIVE",
        milestones: [
          { id: "m1", visit_number: 1, scheduled_date: "2024-03-15", execution_date: "2024-03-16", status: "DONE",    pm_report_url: "maintenance-docs/pm-001.pdf", pm_report_filename: "PM-Report-Visit1.pdf", pm_report_size_bytes: 920_000, uploaded_by: "admin@tup.co.id", notes: null },
          { id: "m2", visit_number: 2, scheduled_date: "2024-07-15", execution_date: "2024-07-18", status: "DONE",    pm_report_url: "maintenance-docs/pm-002.pdf", pm_report_filename: "PM-Report-Visit2.pdf", pm_report_size_bytes: 870_000, uploaded_by: "admin@tup.co.id", notes: null },
          { id: "m3", visit_number: 3, scheduled_date: "2024-11-15", execution_date: null,          status: "OVERDUE", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
          { id: "m4", visit_number: 4, scheduled_date: "2025-03-15", execution_date: null,          status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
          { id: "m5", visit_number: 5, scheduled_date: "2025-07-15", execution_date: null,          status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
          { id: "m6", visit_number: 6, scheduled_date: "2025-11-15", execution_date: null,          status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
        ],
      },
    ],
    documents: [
      { id: "d1", document_type: "ATP_REPORT",  document_name: "Factory ATP Report — CLM-2024-00125", file_url: "#", file_size_bytes: 2_400_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2023-03-14T08:00:00Z", notes: "Pre-delivery factory acceptance report" },
      { id: "d2", document_type: "PM_LOG",       document_name: "PM Log Q1 2024",                       file_url: "#", file_size_bytes:   850_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2024-03-16T14:30:00Z", notes: null },
    ],
  },
  {
    id: "a2",
    serial_number:        "CLM-2024-00218",
    ne_id:                "JKT112/B3F/CLM/009/01",
    site_id:              "JKT112",
    site_name:            "Wisma Telkomsel Jakarta",
    floor:                "B3F",
    type_pac:             "CLM",
    brand:                "Climaveneta",
    model:                "NECS-Q 0202",
    capacity_kw:          62.0,
    customer_name:        "PT Telkomsel",
    installation_date:    "2024-01-10",
    warranty_expiry_date: "2027-01-10",
    notes:                null,
    contracts: [
      {
        id: "c2", po_number: "PO-TSL-2024-0099",
        contract_start_date: "2024-03-01", contract_end_date: "2025-02-28",
        total_planned_visits: 2, contract_value: 32_000_000, status: "ACTIVE",
        milestones: [
          { id: "m7", visit_number: 1, scheduled_date: "2024-06-01", execution_date: "2024-06-03", status: "DONE",    pm_report_url: "maintenance-docs/pm-003.pdf", pm_report_filename: "PM-Visit1-JKT112.pdf", pm_report_size_bytes: 760_000, uploaded_by: "admin@tup.co.id", notes: null },
          { id: "m8", visit_number: 2, scheduled_date: "2024-11-01", execution_date: null,          status: "OVERDUE", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
        ],
      },
    ],
    documents: [
      { id: "d3", document_type: "ATP_REPORT", document_name: "Factory ATP Report — CLM-2024-00218", file_url: "#", file_size_bytes: 2_100_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2024-01-09T09:00:00Z", notes: null },
    ],
  },
  {
    id: "a3",
    serial_number:        "CLM-2023-00087",
    ne_id:                "BDG041/L05/CLM/003/02",
    site_id:              "BDG041",
    site_name:            "GraPARI Bandung Asia Afrika",
    floor:                "L05",
    type_pac:             "CLM",
    brand:                "Climaveneta",
    model:                "NECS-M 0102",
    capacity_kw:          30.0,
    customer_name:        "PT Telkomsel",
    installation_date:    "2023-07-20",
    warranty_expiry_date: "2026-07-20",
    notes:                "Unit had refrigerant leak Feb 2024 — inspect valve condition on every PM visit.",
    contracts: [
      {
        id: "c3", po_number: "PO-TSL-2025-0011",
        contract_start_date: "2025-01-01", contract_end_date: "2025-12-31",
        total_planned_visits: 1, contract_value: 15_000_000, status: "ACTIVE",
        milestones: [
          { id: "m9", visit_number: 1, scheduled_date: "2025-06-15", execution_date: null, status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
        ],
      },
    ],
    documents: [
      { id: "d4", document_type: "ATP_REPORT",      document_name: "Factory ATP Report — CLM-2023-00087",           file_url: "#", file_size_bytes: 1_900_000, uploaded_by: "admin@tup.co.id",  uploaded_at: "2023-07-19T11:00:00Z", notes: null },
      { id: "d5", document_type: "INCIDENT_REPORT", document_name: "Incident Report — Refrigerant Leak Feb 2024", file_url: "#", file_size_bytes:   450_000, uploaded_by: "tech@tup.co.id",   uploaded_at: "2024-02-28T16:00:00Z", notes: "Leak at condenser outlet valve. Valve replaced." },
    ],
  },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fDate = (d: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

const fBytes = (n: number | null) => {
  if (!n) return ""
  if (n < 1_048_576) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1_048_576).toFixed(1)} MB`
}

const fIDR = (n: number | null) =>
  n ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n) : "—"

const getActiveContract  = (a: Asset) => a.contracts.find(c => c.status === "ACTIVE") ?? a.contracts[0] ?? null
const getNextMilestone   = (c: MaintenanceContract | null) => c?.milestones.find(m => m.status === "PENDING") ?? null
const getLastMilestone   = (c: MaintenanceContract | null) => { const done = c?.milestones.filter(m => m.status === "DONE") ?? []; return done[done.length - 1] ?? null }
const hasOverdue         = (a: Asset) => a.contracts.some(c => c.milestones.some(m => m.status === "OVERDUE"))
const contractProgress   = (c: MaintenanceContract) => Math.round((c.milestones.filter(m => m.status === "DONE").length / c.total_planned_visits) * 100)

const DOC_LABEL: Record<DocumentType, string> = {
  ATP_REPORT:      "ATP Report",
  PM_LOG:          "PM Log",
  INCIDENT_REPORT: "Incident Report",
  CONTRACT_COPY:   "Contract Copy",
  OTHER:           "Other",
}

const DOC_COLOR: Record<DocumentType, string> = {
  ATP_REPORT:      "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  PM_LOG:          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  INCIDENT_REPORT: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  CONTRACT_COPY:   "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  OTHER:           "bg-muted text-muted-foreground",
}

const MILESTONE_CFG: Record<MilestoneStatus, { label: string; ring: string; dot: string; badge: string }> = {
  DONE:    { label: "Done",    ring: "border-emerald-500 bg-emerald-500",                              dot: "",  badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  OVERDUE: { label: "Overdue", ring: "border-red-400 bg-red-50 dark:bg-red-950/30",                   dot: "",  badge: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400" },
  PENDING: { label: "Pending", ring: "border-border bg-card",                                          dot: "",  badge: "bg-muted text-muted-foreground" },
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string | number
  sub?: string; accent?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <div className={`mt-0.5 rounded-lg p-2 shrink-0 ${accent ?? "bg-muted"}`}>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground tracking-tight leading-none mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ─── MilestoneTimeline ────────────────────────────────────────────────────────

function MilestoneTimeline({ milestones, contractId, onUpload }: {
  milestones:  Milestone[]
  contractId:  string
  onUpload:    (milestoneId: string, contractId: string) => void
}) {
  return (
    <div className="space-y-0">
      {milestones.map((m, idx) => {
        const cfg    = MILESTONE_CFG[m.status]
        const isLast = idx === milestones.length - 1
        return (
          <div key={m.id} className="flex gap-3">
            {/* Spine */}
            <div className="flex flex-col items-center">
              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${cfg.ring}`}>
                {m.status === "DONE"
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  : m.status === "OVERDUE"
                  ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  : <span className="text-[9px] font-bold text-muted-foreground">{m.visit_number}</span>
                }
              </div>
              {!isLast && <div className="w-px flex-1 bg-border my-1 min-h-[8px]" />}
            </div>

            {/* Content */}
            <div className={`pb-5 flex-1 min-w-0 ${isLast ? "pb-0" : ""}`}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-foreground leading-none">Visit {m.visit_number}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Scheduled: {fDate(m.scheduled_date)}
                    {m.execution_date && <span className="text-emerald-600 dark:text-emerald-400"> · Executed: {fDate(m.execution_date)}</span>}
                  </p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>

              {m.pm_report_url ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground truncate flex-1">{m.pm_report_filename ?? "PM Report"}</span>
                  {m.pm_report_size_bytes && <span className="text-[10px] text-muted-foreground shrink-0">{fBytes(m.pm_report_size_bytes)}</span>}
                  <button
                    type="button"
                    aria-label="Download PM report"
                    onClick={() => toast.info("Download feature — connect to Supabase Storage signed URL.")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onUpload(m.id, contractId)}
                  className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-foreground/30 rounded-lg px-3 py-2 w-full transition-all group"
                >
                  <UploadCloud className="h-3.5 w-3.5 group-hover:scale-110 transition-transform shrink-0" />
                  <span>Upload PM Report</span>
                </button>
              )}

              {m.notes && (
                <p className="mt-1.5 text-xs text-muted-foreground italic">{m.notes}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── DocumentVault ────────────────────────────────────────────────────────────

function DocumentVault({ documents, onUpload }: {
  documents: AssetDocument[]
  onUpload:  () => void
}) {
  const [filter, setFilter] = React.useState<DocumentType | "ALL">("ALL")

  const docTypes: (DocumentType | "ALL")[] = ["ALL", "ATP_REPORT", "PM_LOG", "INCIDENT_REPORT"]
  const shown = filter === "ALL" ? documents : documents.filter(d => d.document_type === filter)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 flex-wrap">
          {docTypes.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                filter === t
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t === "ALL" ? "All" : DOC_LABEL[t]}
              {t !== "ALL" && (
                <span className="ml-1 opacity-60">
                  {documents.filter(d => d.document_type === t).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={onUpload} className="h-7 text-xs gap-1.5">
          <FilePlus className="h-3.5 w-3.5" />
          Add Document
        </Button>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <FileWarning className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No documents in this category.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map(doc => (
            <div
              key={doc.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors group"
            >
              <div className="mt-0.5 rounded-md bg-muted p-1.5 shrink-0">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate leading-snug">{doc.document_name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${DOC_COLOR[doc.document_type]}`}>
                    {DOC_LABEL[doc.document_type]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fDate(doc.uploaded_at)}
                  {" · "}{doc.uploaded_by}
                  {doc.file_size_bytes ? ` · ${fBytes(doc.file_size_bytes)}` : ""}
                </p>
                {doc.notes && <p className="text-xs text-muted-foreground mt-1 italic">{doc.notes}</p>}
              </div>
              <button
                type="button"
                aria-label="Download document"
                onClick={() => toast.info("Download — connect to Supabase Storage signed URL.")}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── AssetDrawer ──────────────────────────────────────────────────────────────

function AssetDrawer({ asset, open, onClose }: {
  asset:   Asset | null
  open:    boolean
  onClose: () => void
}) {
  const handleUploadMilestone = (_mId: string, _cId: string) => {
    toast.info("Connect to Supabase Storage — PATCH /api/maintenance-assets/milestones/:id")
  }
  const handleUploadDoc = () => {
    toast.info("Connect to Supabase Storage — POST /api/maintenance-assets/documents")
  }

  if (!asset) return null

  const contract  = getActiveContract(asset)
  const progress  = contract ? contractProgress(contract) : 0
  const overdue   = hasOverdue(asset)
  const doneCount = contract?.milestones.filter(m => m.status === "DONE").length ?? 0

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col">

        {/* ── Sticky Header ── */}
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-foreground">{asset.ne_id}</span>
                {overdue && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> OVERDUE
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{asset.serial_number}</p>
            </div>
            <button
              type="button"
              aria-label="Close panel"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Overdue Alert ── */}
          {overdue && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4 flex gap-3">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">⚠️ Overdue Maintenance</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                  One or more PM visits are past their scheduled date with no uploaded report. Upload the PM report
                  to auto-clear this alert.
                </p>
              </div>
            </div>
          )}

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-9">
              <TabsTrigger value="overview"   className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="milestones" className="text-xs relative">
                Milestones
                {overdue && (
                  <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                )}
              </TabsTrigger>
              <TabsTrigger value="vault" className="text-xs">Document Vault</TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW ── */}
            <TabsContent value="overview" className="mt-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Asset Details</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: Building2, label: "Site Name",       value: asset.site_name },
                    { icon: Hash,      label: "Site ID",         value: asset.site_id },
                    { icon: Layers,    label: "Floor",           value: asset.floor },
                    { icon: Cpu,       label: "Type PAC",        value: asset.type_pac },
                    { icon: Package,   label: "Brand / Model",   value: [asset.brand, asset.model].filter(Boolean).join(" · ") },
                    { icon: Wrench,    label: "Capacity",        value: asset.capacity_kw ? `${asset.capacity_kw} kW` : "—" },
                    { icon: Calendar,  label: "Installed",       value: fDate(asset.installation_date) },
                    { icon: Shield,    label: "Warranty Until",  value: fDate(asset.warranty_expiry_date) },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                      </div>
                      <p className="text-sm text-foreground font-medium truncate">{value}</p>
                    </div>
                  ))}
                </div>

                {asset.notes && (
                  <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
                    <p className="text-xs text-amber-800 dark:text-amber-300">📌 {asset.notes}</p>
                  </div>
                )}
              </div>

              {contract && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Contract</p>
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground font-mono">{contract.po_number}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fDate(contract.contract_start_date)} → {fDate(contract.contract_end_date)}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium">
                          {contract.status}
                        </span>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                          <span>{doneCount} of {contract.total_planned_visits} visits completed</span>
                          <span className="font-medium text-foreground">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>

                      {contract.contract_value && (
                        <p className="text-xs text-muted-foreground">
                          Contract Value:{" "}
                          <span className="text-foreground font-medium">{fIDR(contract.contract_value)}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── MILESTONES ── */}
            <TabsContent value="milestones" className="mt-5">
              {asset.contracts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <ClipboardList className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No maintenance contracts linked to this asset.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {asset.contracts.map(c => (
                    <div key={c.id}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs font-semibold text-foreground font-mono">{c.po_number}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {c.total_planned_visits} planned visit{c.total_planned_visits > 1 ? "s" : ""}
                            {" · "}{fDate(c.contract_start_date)} — {fDate(c.contract_end_date)}
                          </p>
                        </div>
                      </div>
                      <MilestoneTimeline
                        milestones={c.milestones}
                        contractId={c.id}
                        onUpload={handleUploadMilestone}
                      />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── DOCUMENT VAULT ── */}
            <TabsContent value="vault" className="mt-5">
              <DocumentVault documents={asset.documents} onUpload={handleUploadDoc} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MaintenanceAssetsPage() {
  const { user }  = useCurrentUser()
  const isAdmin   = user?.role === "ADMIN"

  const [assets, setAssets]     = React.useState<Asset[]>(MOCK_ASSETS)
  const [loading, setLoading]   = React.useState(false)
  const [searchQuery, setQ]     = React.useState("")
  const [searchMode, setMode]   = React.useState<"SN" | "NE_ID">("SN")
  const [selected, setSelected] = React.useState<Asset | null>(null)
  const [drawerOpen, setDrawer] = React.useState(false)

  // Derived stats
  const overdueAssets = React.useMemo(() => assets.filter(hasOverdue), [assets])

  const upcomingCount = React.useMemo(() => {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return assets.filter(a =>
      a.contracts.some(c =>
        c.milestones.some(m => {
          if (m.status !== "PENDING") return false
          const d = new Date(m.scheduled_date)
          return d >= now && d <= end
        })
      )
    ).length
  }, [assets])

  const activeContractCount = React.useMemo(
    () => assets.filter(a => a.contracts.some(c => c.status === "ACTIVE")).length,
    [assets]
  )

  const filtered = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return assets
    return assets.filter(a =>
      searchMode === "SN"
        ? a.serial_number.toLowerCase().includes(q)
        : a.ne_id.toLowerCase().includes(q)
    )
  }, [assets, searchQuery, searchMode])

  // Sort overdue assets to the top
  const sorted = React.useMemo(
    () => [...filtered].sort((a, b) => (hasOverdue(b) ? 1 : 0) - (hasOverdue(a) ? 1 : 0)),
    [filtered]
  )

  const openAsset = (asset: Asset) => {
    setSelected(asset)
    setDrawer(true)
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-col gap-6 p-6 min-h-0">

          {/* ── Page Header ── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">Maintenance Assets</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                PAC Climaveneta unit registry — search by Serial Number or NE ID
              </p>
            </div>
            {isAdmin && (
              <Button size="sm" className="gap-1.5 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add Asset
              </Button>
            )}
          </div>

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={Package}
              label="Total Assets"
              value={assets.length}
              sub="registered units"
            />
            <StatCard
              icon={FileText}
              label="Active Contracts"
              value={activeContractCount}
              sub="with open POs"
              accent="bg-blue-50 dark:bg-blue-950/40"
            />
            <StatCard
              icon={AlertTriangle}
              label="Overdue Visits"
              value={overdueAssets.length}
              sub={overdueAssets.length > 0 ? "needs attention" : "all clear"}
              accent={overdueAssets.length > 0
                ? "bg-red-50 dark:bg-red-950/40"
                : "bg-emerald-50 dark:bg-emerald-950/40"
              }
            />
            <StatCard
              icon={Clock}
              label="Due This Month"
              value={upcomingCount}
              sub="scheduled visits"
              accent="bg-amber-50 dark:bg-amber-950/40"
            />
          </div>

          {/* ── Overdue Alert Banner ── */}
          {overdueAssets.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                    ⚠️ {overdueAssets.length} asset{overdueAssets.length > 1 ? "s have" : " has"} overdue maintenance
                  </p>
                  <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                    These units have scheduled PM visits past due with no uploaded report.
                    Upload the PM report to auto-clear each alert.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {overdueAssets.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => openAsset(a)}
                        className="text-xs font-mono px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors border border-red-200 dark:border-red-800/50"
                      >
                        {a.ne_id}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Search Bar ── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
              {(["SN", "NE_ID"] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    searchMode === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode === "SN" ? "Serial Number" : "NE ID"}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setQ(e.target.value)}
                placeholder={
                  searchMode === "SN"
                    ? "e.g. CLM-2024-00125"
                    : "e.g. TNG337/L02/CLM/052/03"
                }
                className="w-full text-sm rounded-lg border border-border bg-background text-foreground pl-9 pr-9 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/50 transition-all placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}

            <p className="text-xs text-muted-foreground ml-auto">
              {sorted.length} of {assets.length} assets
            </p>
          </div>

          {/* ── Asset Table ── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["NE ID", "Site Name", "Floor", "Type PAC", "Serial Number", "Contract", "Last PM", "Next PM", ""].map((col, i) => (
                      <th
                        key={i}
                        className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No assets match your search.
                      </td>
                    </tr>
                  ) : (
                    sorted.map(asset => {
                      const contract = getActiveContract(asset)
                      const lastPM   = getLastMilestone(contract)
                      const nextPM   = getNextMilestone(contract)
                      const overdue  = hasOverdue(asset)
                      const nextDate = nextPM ? new Date(nextPM.scheduled_date) : null
                      const isPast   = nextDate ? nextDate < new Date() : false

                      return (
                        <tr
                          key={asset.id}
                          onClick={() => openAsset(asset)}
                          className={`hover:bg-muted/40 transition-colors cursor-pointer group ${
                            overdue ? "bg-red-50/30 dark:bg-red-950/10" : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-medium text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {overdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                              {asset.ne_id}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground max-w-[180px] truncate">{asset.site_name}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{asset.floor}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{asset.type_pac}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{asset.serial_number}</td>
                          <td className="px-4 py-3">
                            {contract ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium whitespace-nowrap">
                                {contract.po_number}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">No contract</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {fDate(lastPM?.execution_date ?? null)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {nextPM ? (
                              <span className={`text-xs font-medium ${isPast ? "text-red-500" : "text-muted-foreground"}`}>
                                {fDate(nextPM.scheduled_date)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <AssetDrawer
          asset={selected}
          open={drawerOpen}
          onClose={() => setDrawer(false)}
        />
        <Toaster richColors />
      </SidebarInset>
    </SidebarProvider>
  )
}
