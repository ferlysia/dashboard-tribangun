"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar }  from "@/components/app-sidebar"
import { SiteHeader }  from "@/components/site-header"
import { Toaster }     from "@/components/ui/sonner"
import { toast }       from "sonner"
import { useCurrentUser } from "@/components/providers/current-user-provider"
import { Button }      from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Separator }   from "@/components/ui/separator"
import { Progress }    from "@/components/ui/progress"
import {
  Search, Plus, FileText, AlertTriangle, CheckCircle2,
  Clock, RefreshCw, ChevronRight, X, Building2, Layers,
  Cpu, Calendar, Package, Download, MapPin,
  UploadCloud, FilePlus, FileWarning, ClipboardList,
  Settings2, Hash, Zap,
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────

type OperationalStatus = "RUNNING" | "STANDBY" | "OFF"
type MilestoneStatus   = "PENDING" | "DONE" | "OVERDUE"
type ContractStatus    = "ACTIVE" | "COMPLETED" | "EXPIRED" | "CANCELLED"
type DocumentType      = "ATP_REPORT" | "PM_LOG" | "INCIDENT_REPORT" | "CONTRACT_COPY" | "OTHER"
type SiteFilterKey     = "ALL" | "TTC TBS" | "TTC BSD" | "TTC BUARA" | "TSO" | "TTC MERUYA"

interface Milestone {
  id:                   string
  site_contract_id:     string
  visit_number:         number
  scheduled_date:       string
  execution_date:       string | null
  status:               MilestoneStatus
  pm_report_url:        string | null
  pm_report_filename:   string | null
  pm_report_size_bytes: number | null
  uploaded_by:          string | null
  notes:                string | null
}

interface SiteContract {
  id:                      string
  site_name:               string
  po_number:               string
  contract_start_date:     string
  contract_duration_years: number
  total_planned_visits:    number
  status:                  ContractStatus
  notes:                   string | null
}

interface AssetDocument {
  id:              string
  document_type:   DocumentType
  document_name:   string
  file_url:        string
  file_size_bytes: number | null
  uploaded_by:     string
  uploaded_at:     string
  notes:           string | null
}

interface Asset {
  id:                 string
  ne_id:              string
  serial_number:      string
  maintenance_date:   string
  room:               string
  site_name:          string
  floor:              string
  type_pac:           string
  operational_status: OperationalStatus
  notes:              string | null
  milestones:         Milestone[]
  documents:          AssetDocument[]
}

interface ContractFormState {
  site_name:               string
  po_number:               string
  contract_start_date:     string
  contract_duration_years: number
  total_planned_visits:    number
  notes:                   string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SITE_FILTERS: SiteFilterKey[] = ["ALL", "TTC TBS", "TTC BSD", "TTC BUARA", "TSO", "TTC MERUYA"]

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

const MILESTONE_CFG: Record<MilestoneStatus, { label: string; ring: string; badge: string }> = {
  DONE:    { label: "Done",    ring: "border-emerald-500 bg-emerald-500",             badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  OVERDUE: { label: "Overdue", ring: "border-red-400 bg-red-50 dark:bg-red-950/30",   badge: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400" },
  PENDING: { label: "Pending", ring: "border-border bg-card",                         badge: "bg-muted text-muted-foreground" },
}

const OP_STATUS_CFG: Record<OperationalStatus, { label: string; dot: string; badge: string }> = {
  RUNNING: { label: "Running", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  STANDBY: { label: "Standby", dot: "bg-amber-400",   badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  OFF:     { label: "Off",     dot: "bg-neutral-400", badge: "bg-muted text-muted-foreground" },
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_SITE_CONTRACTS: SiteContract[] = [
  {
    id: "sc1", site_name: "TTC BSD", po_number: "PO-TI-2025-0043",
    contract_start_date: "2025-07-01", contract_duration_years: 2,
    total_planned_visits: 4, status: "ACTIVE", notes: null,
  },
  {
    id: "sc2", site_name: "TTC TBS", po_number: "PO-TI-2025-0057",
    contract_start_date: "2025-06-01", contract_duration_years: 1,
    total_planned_visits: 2, status: "ACTIVE", notes: null,
  },
  {
    id: "sc3", site_name: "TSO", po_number: "PO-TI-2025-0012",
    contract_start_date: "2025-07-01", contract_duration_years: 2,
    total_planned_visits: 4, status: "ACTIVE", notes: null,
  },
]

const MOCK_ASSETS: Asset[] = [
  // ── TTC BSD ──────────────────────────────────────────────────────────────
  {
    id: "a1", ne_id: "BSD101/L02/CLM/001/01", serial_number: "CLM-2025-00101",
    maintenance_date: "2025-07-10", room: "MMR", site_name: "TTC BSD",
    floor: "L02", type_pac: "CLM", operational_status: "RUNNING", notes: null,
    milestones: [
      { id: "m1",  site_contract_id: "sc1", visit_number: 1, scheduled_date: "2026-01-01", execution_date: "2026-01-03", status: "DONE",    pm_report_url: "pm-bsd-l02-v1.pdf", pm_report_filename: "PM-BSD-L02-V1.pdf", pm_report_size_bytes: 920_000, uploaded_by: "admin@tup.co.id", notes: null },
      { id: "m2",  site_contract_id: "sc1", visit_number: 2, scheduled_date: "2026-07-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
      { id: "m3",  site_contract_id: "sc1", visit_number: 3, scheduled_date: "2027-01-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
      { id: "m4",  site_contract_id: "sc1", visit_number: 4, scheduled_date: "2027-07-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
    ],
    documents: [
      { id: "d1", document_type: "ATP_REPORT", document_name: "Factory ATP — CLM-2025-00101", file_url: "#", file_size_bytes: 2_200_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2025-07-09T08:00:00Z", notes: null },
    ],
  },
  {
    id: "a2", ne_id: "BSD101/L03/CLM/002/01", serial_number: "CLM-2025-00102",
    maintenance_date: "2025-07-10", room: "Chiller Room", site_name: "TTC BSD",
    floor: "L03", type_pac: "CLM", operational_status: "RUNNING", notes: null,
    milestones: [
      { id: "m5",  site_contract_id: "sc1", visit_number: 1, scheduled_date: "2026-01-01", execution_date: "2026-01-04", status: "DONE",    pm_report_url: "pm-bsd-l03-v1.pdf", pm_report_filename: "PM-BSD-L03-V1.pdf", pm_report_size_bytes: 870_000, uploaded_by: "admin@tup.co.id", notes: null },
      { id: "m6",  site_contract_id: "sc1", visit_number: 2, scheduled_date: "2026-07-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
      { id: "m7",  site_contract_id: "sc1", visit_number: 3, scheduled_date: "2027-01-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
      { id: "m8",  site_contract_id: "sc1", visit_number: 4, scheduled_date: "2027-07-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
    ],
    documents: [
      { id: "d2", document_type: "ATP_REPORT", document_name: "Factory ATP — CLM-2025-00102", file_url: "#", file_size_bytes: 1_950_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2025-07-09T09:00:00Z", notes: null },
    ],
  },
  {
    id: "a3", ne_id: "BSD101/B01/CLM/003/01", serial_number: "CLM-2025-00103",
    maintenance_date: "2025-07-10", room: "MMR", site_name: "TTC BSD",
    floor: "B01", type_pac: "CLM", operational_status: "STANDBY",
    notes: "Unit on standby — redundancy backup for L02 primary. Inspect coils on each PM.",
    milestones: [
      { id: "m9",  site_contract_id: "sc1", visit_number: 1, scheduled_date: "2026-01-01", execution_date: null,         status: "OVERDUE", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
      { id: "m10", site_contract_id: "sc1", visit_number: 2, scheduled_date: "2026-07-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
      { id: "m11", site_contract_id: "sc1", visit_number: 3, scheduled_date: "2027-01-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
      { id: "m12", site_contract_id: "sc1", visit_number: 4, scheduled_date: "2027-07-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
    ],
    documents: [
      { id: "d3", document_type: "ATP_REPORT",      document_name: "Factory ATP — CLM-2025-00103",        file_url: "#", file_size_bytes: 2_100_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2025-07-09T10:00:00Z", notes: null },
      { id: "d4", document_type: "INCIDENT_REPORT", document_name: "Standby Switch Incident — Mar 2025", file_url: "#", file_size_bytes:   320_000, uploaded_by: "tech@tup.co.id",  uploaded_at: "2025-03-22T13:00:00Z", notes: "Control board reset. Unit back to standby mode." },
    ],
  },

  // ── TTC TBS ───────────────────────────────────────────────────────────────
  {
    id: "a4", ne_id: "TBS001/L01/CLM/001/01", serial_number: "CLM-2024-00041",
    maintenance_date: "2024-09-10", room: "MMR", site_name: "TTC TBS",
    floor: "L01", type_pac: "CLM", operational_status: "RUNNING", notes: null,
    milestones: [
      { id: "m13", site_contract_id: "sc2", visit_number: 1, scheduled_date: "2025-12-01", execution_date: "2025-12-03", status: "DONE", pm_report_url: "pm-tbs-l01-v1.pdf", pm_report_filename: "PM-TBS-L01-V1.pdf", pm_report_size_bytes: 810_000, uploaded_by: "admin@tup.co.id", notes: null },
      { id: "m14", site_contract_id: "sc2", visit_number: 2, scheduled_date: "2026-06-01", execution_date: "2026-06-02", status: "DONE", pm_report_url: "pm-tbs-l01-v2.pdf", pm_report_filename: "PM-TBS-L01-V2.pdf", pm_report_size_bytes: 780_000, uploaded_by: "admin@tup.co.id", notes: null },
    ],
    documents: [
      { id: "d5", document_type: "ATP_REPORT", document_name: "Factory ATP — CLM-2024-00041", file_url: "#", file_size_bytes: 2_050_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2024-09-09T08:00:00Z", notes: null },
      { id: "d6", document_type: "PM_LOG",     document_name: "PM Log — Dec 2025",            file_url: "#", file_size_bytes:   640_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2025-12-03T16:00:00Z", notes: null },
    ],
  },
  {
    id: "a5", ne_id: "TBS001/L01/CLM/002/01", serial_number: "CLM-2024-00042",
    maintenance_date: "2024-09-10", room: "Server Room", site_name: "TTC TBS",
    floor: "L01", type_pac: "CLM", operational_status: "RUNNING", notes: null,
    milestones: [
      { id: "m15", site_contract_id: "sc2", visit_number: 1, scheduled_date: "2025-12-01", execution_date: "2025-12-03", status: "DONE",    pm_report_url: "pm-tbs-sr-v1.pdf", pm_report_filename: "PM-TBS-SR-V1.pdf", pm_report_size_bytes: 795_000, uploaded_by: "admin@tup.co.id", notes: null },
      { id: "m16", site_contract_id: "sc2", visit_number: 2, scheduled_date: "2026-06-01", execution_date: null,         status: "OVERDUE", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
    ],
    documents: [
      { id: "d7", document_type: "ATP_REPORT", document_name: "Factory ATP — CLM-2024-00042", file_url: "#", file_size_bytes: 1_880_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2024-09-09T09:30:00Z", notes: null },
    ],
  },

  // ── TTC BUARA (no active contract) ───────────────────────────────────────
  {
    id: "a6", ne_id: "BUA001/L02/CLM/001/01", serial_number: "CLM-2025-00211",
    maintenance_date: "2025-06-01", room: "MMR", site_name: "TTC BUARA",
    floor: "L02", type_pac: "CLM", operational_status: "RUNNING", notes: null,
    milestones: [],
    documents: [
      { id: "d8", document_type: "ATP_REPORT", document_name: "Factory ATP — CLM-2025-00211", file_url: "#", file_size_bytes: 2_300_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2025-05-31T08:00:00Z", notes: null },
    ],
  },
  {
    id: "a7", ne_id: "BUA001/L03/CLM/002/01", serial_number: "CLM-2025-00212",
    maintenance_date: "2025-06-01", room: "Chiller Room", site_name: "TTC BUARA",
    floor: "L03", type_pac: "CLM", operational_status: "OFF",
    notes: "Unit decommissioned pending inspection. Do not power on without written approval.",
    milestones: [],
    documents: [
      { id: "d9", document_type: "ATP_REPORT", document_name: "Factory ATP — CLM-2025-00212", file_url: "#", file_size_bytes: 1_750_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2025-05-31T09:00:00Z", notes: null },
    ],
  },

  // ── TSO ───────────────────────────────────────────────────────────────────
  {
    id: "a8", ne_id: "TSO001/L04/CLM/001/01", serial_number: "CLM-2025-00301",
    maintenance_date: "2025-07-15", room: "Server Room", site_name: "TSO",
    floor: "L04", type_pac: "CLM", operational_status: "RUNNING", notes: null,
    milestones: [
      { id: "m17", site_contract_id: "sc3", visit_number: 1, scheduled_date: "2026-01-01", execution_date: "2026-01-02", status: "DONE",    pm_report_url: "pm-tso-l04-v1.pdf", pm_report_filename: "PM-TSO-L04-V1.pdf", pm_report_size_bytes: 955_000, uploaded_by: "admin@tup.co.id", notes: null },
      { id: "m18", site_contract_id: "sc3", visit_number: 2, scheduled_date: "2026-07-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
      { id: "m19", site_contract_id: "sc3", visit_number: 3, scheduled_date: "2027-01-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
      { id: "m20", site_contract_id: "sc3", visit_number: 4, scheduled_date: "2027-07-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
    ],
    documents: [
      { id: "d10", document_type: "ATP_REPORT", document_name: "Factory ATP — CLM-2025-00301", file_url: "#", file_size_bytes: 2_400_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2025-07-14T08:00:00Z", notes: null },
    ],
  },
  {
    id: "a9", ne_id: "TSO001/L05/CLM/002/01", serial_number: "CLM-2025-00302",
    maintenance_date: "2025-07-15", room: "MMR", site_name: "TSO",
    floor: "L05", type_pac: "CLM", operational_status: "RUNNING", notes: null,
    milestones: [
      { id: "m21", site_contract_id: "sc3", visit_number: 1, scheduled_date: "2026-01-01", execution_date: null,         status: "OVERDUE", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
      { id: "m22", site_contract_id: "sc3", visit_number: 2, scheduled_date: "2026-07-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
      { id: "m23", site_contract_id: "sc3", visit_number: 3, scheduled_date: "2027-01-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
      { id: "m24", site_contract_id: "sc3", visit_number: 4, scheduled_date: "2027-07-01", execution_date: null,         status: "PENDING", pm_report_url: null, pm_report_filename: null, pm_report_size_bytes: null, uploaded_by: null, notes: null },
    ],
    documents: [
      { id: "d11", document_type: "ATP_REPORT", document_name: "Factory ATP — CLM-2025-00302", file_url: "#", file_size_bytes: 2_100_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2025-07-14T09:00:00Z", notes: null },
    ],
  },

  // ── TTC MERUYA (no active contract) ──────────────────────────────────────
  {
    id: "a10", ne_id: "MRY001/L01/CLM/001/01", serial_number: "CLM-2025-00401",
    maintenance_date: "2025-03-01", room: "MMR", site_name: "TTC MERUYA",
    floor: "L01", type_pac: "CLM", operational_status: "RUNNING", notes: null,
    milestones: [],
    documents: [
      { id: "d12", document_type: "ATP_REPORT", document_name: "Factory ATP — CLM-2025-00401", file_url: "#", file_size_bytes: 2_050_000, uploaded_by: "admin@tup.co.id", uploaded_at: "2025-02-28T08:00:00Z", notes: null },
    ],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fDate = (d: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

const fBytes = (n: number | null) => {
  if (!n) return ""
  if (n < 1_048_576) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1_048_576).toFixed(1)} MB`
}

const hasOverdue       = (a: Asset) => a.milestones.some(m => m.status === "OVERDUE")
const getNextMilestone = (a: Asset) => a.milestones.find(m => m.status === "PENDING") ?? null
const getLastDone      = (a: Asset) => {
  const done = a.milestones.filter(m => m.status === "DONE")
  return done[done.length - 1] ?? null
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

// ─── SiteFilterChips ──────────────────────────────────────────────────────────

function SiteFilterChips({ active, onChange, counts }: {
  active:   SiteFilterKey
  onChange: (site: SiteFilterKey) => void
  counts:   Record<SiteFilterKey, number>
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {SITE_FILTERS.map(site => (
        <button
          key={site}
          type="button"
          onClick={() => onChange(site)}
          className={`h-7 px-3 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
            active === site
              ? "bg-foreground text-background shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          }`}
        >
          {site}
          {site !== "ALL" && (
            <span className={`ml-1.5 text-[10px] ${active === site ? "opacity-60" : "opacity-50"}`}>
              {counts[site]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── MilestoneTimeline ────────────────────────────────────────────────────────

function MilestoneTimeline({ milestones, onUpload }: {
  milestones: Milestone[]
  onUpload:   (milestoneId: string) => void
}) {
  if (milestones.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <ClipboardList className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No milestone schedule yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Admin must configure a site contract first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {milestones.map((m, idx) => {
        const cfg    = MILESTONE_CFG[m.status]
        const isLast = idx === milestones.length - 1
        return (
          <div key={m.id} className="flex gap-3">
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

            <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-5"}`}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-foreground leading-none">Visit {m.visit_number}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Scheduled: {fDate(m.scheduled_date)}
                    {m.execution_date && (
                      <span className="text-emerald-600 dark:text-emerald-400"> · Executed: {fDate(m.execution_date)}</span>
                    )}
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
                  {m.pm_report_size_bytes && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{fBytes(m.pm_report_size_bytes)}</span>
                  )}
                  <button
                    type="button"
                    aria-label="Download PM report"
                    onClick={() => toast.info("Connect to Supabase Storage signed URL.")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onUpload(m.id)}
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
                <span className="ml-1 opacity-60">{documents.filter(d => d.document_type === t).length}</span>
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
                  {fDate(doc.uploaded_at)} · {doc.uploaded_by}
                  {doc.file_size_bytes ? ` · ${fBytes(doc.file_size_bytes)}` : ""}
                </p>
                {doc.notes && <p className="text-xs text-muted-foreground mt-1 italic">{doc.notes}</p>}
              </div>
              <button
                type="button"
                aria-label="Download"
                onClick={() => toast.info("Connect to Supabase Storage signed URL.")}
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

function AssetDrawer({ asset, siteContract, open, onClose }: {
  asset:        Asset | null
  siteContract: SiteContract | null
  open:         boolean
  onClose:      () => void
}) {
  if (!asset) return null

  const overdue    = hasOverdue(asset)
  const doneCount  = asset.milestones.filter(m => m.status === "DONE").length
  const totalVisits = siteContract?.total_planned_visits ?? asset.milestones.length
  const progress   = totalVisits > 0 ? Math.round((doneCount / totalVisits) * 100) : 0
  const opCfg      = OP_STATUS_CFG[asset.operational_status]

  const handleUploadMilestone = (_mId: string) => {
    toast.info("Connect to Supabase Storage — PATCH /api/maintenance-assets/milestones/:id")
  }
  const handleUploadDoc = () => {
    toast.info("Connect to Supabase Storage — POST /api/maintenance-assets/documents")
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col">

        {/* Sticky Header */}
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
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${opCfg.badge}`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${opCfg.dot}`} />
                  {opCfg.label}
                </span>
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

          {/* Overdue Alert */}
          {overdue && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4 flex gap-3">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">⚠️ Overdue Maintenance</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                  One or more PM visits are past their scheduled date with no uploaded report.
                  Upload the PM report to auto-clear this alert.
                </p>
              </div>
            </div>
          )}

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-9">
              <TabsTrigger value="overview"   className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="milestones" className="text-xs relative">
                Milestones
                {overdue && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />}
              </TabsTrigger>
              <TabsTrigger value="vault" className="text-xs">Document Vault</TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW ── */}
            <TabsContent value="overview" className="mt-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Asset Details</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: Building2, label: "Site",             value: asset.site_name },
                    { icon: Layers,    label: "Floor",            value: asset.floor },
                    { icon: MapPin,    label: "Room",             value: asset.room },
                    { icon: Cpu,       label: "Type PAC",         value: asset.type_pac },
                    { icon: Calendar,  label: "Maintenance Date", value: fDate(asset.maintenance_date) },
                    { icon: Hash,      label: "NE ID",            value: asset.ne_id },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                      </div>
                      <p className="text-sm text-foreground font-medium truncate font-mono">{value}</p>
                    </div>
                  ))}
                </div>

                {asset.notes && (
                  <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
                    <p className="text-xs text-amber-800 dark:text-amber-300">📌 {asset.notes}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Site Contract */}
              {siteContract ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Site Contract</p>
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground font-mono">{siteContract.po_number}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fDate(siteContract.contract_start_date)} · {siteContract.contract_duration_years}yr · {siteContract.total_planned_visits} visits
                        </p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium">
                        {siteContract.status}
                      </span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>{doneCount} of {totalVisits} visits completed</span>
                        <span className="font-medium text-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-4 text-center">
                  <Settings2 className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No active contract for {asset.site_name}.</p>
                  <p className="text-xs text-muted-foreground mt-1">Admin must set up a site contract to enable milestone scheduling.</p>
                </div>
              )}
            </TabsContent>

            {/* ── MILESTONES ── */}
            <TabsContent value="milestones" className="mt-5">
              {siteContract && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-foreground font-mono">{siteContract.po_number}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {siteContract.total_planned_visits} planned visit{siteContract.total_planned_visits > 1 ? "s" : ""}
                    {" · "}{fDate(siteContract.contract_start_date)}
                  </p>
                </div>
              )}
              <MilestoneTimeline milestones={asset.milestones} onUpload={handleUploadMilestone} />
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

// ─── SiteContractSheet ────────────────────────────────────────────────────────

const BLANK_FORM: ContractFormState = {
  site_name: "", po_number: "", contract_start_date: "",
  contract_duration_years: 2, total_planned_visits: 4, notes: "",
}

function SiteContractSheet({ open, onClose, assets, siteContracts, setSiteContracts }: {
  open:             boolean
  onClose:          () => void
  assets:           Asset[]
  siteContracts:    SiteContract[]
  setSiteContracts: React.Dispatch<React.SetStateAction<SiteContract[]>>
}) {
  const MANAGED_SITES = SITE_FILTERS.filter(s => s !== "ALL") as Exclude<SiteFilterKey, "ALL">[]
  const [selectedSite, setSelectedSite] = React.useState<string>("")
  const [form, setForm]                 = React.useState<ContractFormState>(BLANK_FORM)
  const [editingId, setEditingId]       = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!selectedSite) return
    const existing = siteContracts.find(sc => sc.site_name === selectedSite && sc.status === "ACTIVE")
    if (existing) {
      setForm({
        site_name:               existing.site_name,
        po_number:               existing.po_number,
        contract_start_date:     existing.contract_start_date,
        contract_duration_years: existing.contract_duration_years,
        total_planned_visits:    existing.total_planned_visits,
        notes:                   existing.notes ?? "",
      })
      setEditingId(existing.id)
    } else {
      setForm({ ...BLANK_FORM, site_name: selectedSite })
      setEditingId(null)
    }
  }, [selectedSite, siteContracts])

  const assetCount   = assets.filter(a => a.site_name === selectedSite).length
  const slotPreview  = assetCount * form.total_planned_visits

  const handleSave = () => {
    if (!form.site_name || !form.po_number || !form.contract_start_date) {
      toast.error("Fill in Site, PO Number, and Start Date.")
      return
    }
    if (editingId) {
      setSiteContracts(prev =>
        prev.map(sc => sc.id === editingId ? { ...sc, ...form, updated_at: new Date().toISOString() } : sc)
      )
      toast.success(`Contract updated for ${form.site_name}. Call fn_generate_site_milestones() to regenerate ${slotPreview} milestone slots.`)
    } else {
      const newContract: SiteContract = {
        id:                      crypto.randomUUID(),
        site_name:               form.site_name,
        po_number:               form.po_number,
        contract_start_date:     form.contract_start_date,
        contract_duration_years: form.contract_duration_years,
        total_planned_visits:    form.total_planned_visits,
        status:                  "ACTIVE",
        notes:                   form.notes || null,
      }
      setSiteContracts(prev => [...prev, newContract])
      toast.success(`Contract created for ${form.site_name}. ${slotPreview} milestone slots will be generated for ${assetCount} assets.`)
    }
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Manage Site Contracts</p>
              <p className="text-xs text-muted-foreground mt-0.5">Set PO parameters for an entire site at once</p>
            </div>
            <button type="button" aria-label="Close panel" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">
          {/* Site Selector */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Select Site</p>
            <div className="flex flex-wrap gap-1.5">
              {MANAGED_SITES.map(site => {
                const hasContract = siteContracts.some(sc => sc.site_name === site && sc.status === "ACTIVE")
                return (
                  <button
                    key={site}
                    type="button"
                    onClick={() => setSelectedSite(site)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      selectedSite === site
                        ? "bg-foreground text-background shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}
                  >
                    {site}
                    {hasContract && (
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedSite === site ? "bg-emerald-400" : "bg-emerald-500"}`} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {!selectedSite ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Building2 className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Select a site above to configure its contract.</p>
            </div>
          ) : (
            <>
              {/* Current contract status badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {assetCount} asset{assetCount !== 1 ? "s" : ""} registered at {selectedSite}
                </span>
                {editingId && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium">
                    Editing active contract
                  </span>
                )}
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground">PO Number</label>
                  <input
                    type="text"
                    value={form.po_number}
                    onChange={e => setForm(f => ({ ...f, po_number: e.target.value }))}
                    placeholder="e.g. PO-TI-2026-0088"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all placeholder:text-muted-foreground font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Contract Start Date</label>
                  <input
                    type="date"
                    title="Contract Start Date"
                    value={form.contract_start_date}
                    onChange={e => setForm(f => ({ ...f, contract_start_date: e.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-border bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-foreground">Duration (years)</label>
                    <div className="mt-1.5 relative">
                      <input
                        type="number"
                        title="Contract duration in years"
                        min={0.5}
                        max={10}
                        step={0.5}
                        value={form.contract_duration_years}
                        onChange={e => setForm(f => ({ ...f, contract_duration_years: parseFloat(e.target.value) || 1 }))}
                        className="w-full rounded-lg border border-border bg-background text-sm text-foreground px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">yr</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground">Total Visits (N)</label>
                    <div className="mt-1.5 relative">
                      <input
                        type="number"
                        title="Total planned visits (N)"
                        min={1}
                        max={24}
                        value={form.total_planned_visits}
                        onChange={e => setForm(f => ({ ...f, total_planned_visits: parseInt(e.target.value) || 1 }))}
                        className="w-full rounded-lg border border-border bg-background text-sm text-foreground px-3 py-2 pr-14 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">visits</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Notes (optional)</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    placeholder="Internal remarks about this contract..."
                    className="mt-1.5 w-full rounded-lg border border-border bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all resize-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Preview */}
              {assetCount > 0 && form.total_planned_visits > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-start gap-2.5">
                  <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Saving will call <span className="font-mono text-foreground">fn_generate_site_milestones()</span> and generate{" "}
                    <span className="font-semibold text-foreground">{assetCount} × {form.total_planned_visits} = {slotPreview} milestone slots</span>{" "}
                    for all assets at {selectedSite}, evenly spaced over {form.contract_duration_years}yr.
                  </p>
                </div>
              )}

              <Button onClick={handleSave} className="w-full h-9 text-sm gap-2">
                <Settings2 className="h-3.5 w-3.5" />
                {editingId ? `Update Contract — ${selectedSite}` : `Create Contract & Generate Milestones`}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MaintenanceAssetsPage() {
  const { user } = useCurrentUser()
  const isAdmin  = user?.role === "ADMIN"

  const [assets, setAssets]               = React.useState<Asset[]>([])
  const [siteContracts, setSiteContracts] = React.useState<SiteContract[]>([])
  const [loading, setLoading]             = React.useState(true)
  const [searchQuery, setQ]               = React.useState("")
  const [searchMode, setMode]             = React.useState<"SN" | "NE_ID">("SN")
  const [activeSiteFilter, setSiteFilter] = React.useState<SiteFilterKey>("ALL")
  const [selected, setSelected]           = React.useState<Asset | null>(null)
  const [drawerOpen, setDrawer]           = React.useState(false)
  const [contractSheetOpen, setContractSheet] = React.useState(false)
  const importRef = React.useRef<HTMLInputElement>(null)

  // ── Live data fetch ───────────────────────────────────────────────────────
  const loadAssets = React.useCallback(() => {
    setLoading(true)
    fetch("/api/maintenance-assets")
      .then(r => r.json())
      .then(({ assets, siteContracts }) => {
        setAssets(assets ?? [])
        setSiteContracts(siteContracts ?? [])
      })
      .catch(() => toast.error("Gagal memuat data aset dari Supabase."))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { loadAssets() }, [loadAssets])

  // ── Excel import handler ──────────────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    const formData = new FormData()
    formData.append("file", file)
    const tid = toast.loading(`Mengimpor ${file.name}…`)
    try {
      const res  = await fetch("/api/maintenance-assets/import", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(
        `${data.imported} aset berhasil diimpor${data.skipped > 0 ? `, ${data.skipped} baris dilewati` : ""}.`,
        { id: tid }
      )
      loadAssets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import gagal.", { id: tid })
    }
  }

  const getActiveSiteContract = React.useCallback((siteName: string) =>
    siteContracts.find(sc => sc.site_name === siteName && sc.status === "ACTIVE") ?? null,
  [siteContracts])

  // Stats
  const overdueAssets = React.useMemo(() => assets.filter(hasOverdue), [assets])

  const activeSiteContractCount = React.useMemo(
    () => new Set(siteContracts.filter(sc => sc.status === "ACTIVE").map(sc => sc.site_name)).size,
    [siteContracts]
  )

  const dueIn30Count = React.useMemo(() => {
    const today = new Date()
    const in30  = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    return new Set(
      assets.flatMap(a =>
        a.milestones
          .filter(m => m.status === "PENDING")
          .filter(m => { const d = new Date(m.scheduled_date); return d >= today && d <= in30 })
          .map(() => a.id)
      )
    ).size
  }, [assets])

  // Per-site counts for chips
  const siteCounts = React.useMemo(() => {
    const counts = {} as Record<SiteFilterKey, number>
    SITE_FILTERS.forEach(s => {
      counts[s] = s === "ALL" ? assets.length : assets.filter(a => a.site_name === s).length
    })
    return counts
  }, [assets])

  // Filtered + sorted
  const filtered = React.useMemo(() => {
    let result = assets
    if (activeSiteFilter !== "ALL") {
      result = result.filter(a => a.site_name === activeSiteFilter)
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(a =>
        searchMode === "SN"
          ? a.serial_number.toLowerCase().includes(q)
          : a.ne_id.toLowerCase().includes(q)
      )
    }
    return result
  }, [assets, activeSiteFilter, searchQuery, searchMode])

  const sorted = React.useMemo(
    () => [...filtered].sort((a, b) => (hasOverdue(b) ? 1 : 0) - (hasOverdue(a) ? 1 : 0)),
    [filtered]
  )

  const openAsset = (asset: Asset) => { setSelected(asset); setDrawer(true) }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-col gap-6 p-6 min-h-0">

          {/* Page Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">Maintenance Assets</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                PAC Climaveneta unit registry — Telkom Infra 5 sites
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-xs"
                  onClick={() => setContractSheet(true)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Manage Contracts
                </Button>
              )}
              {isAdmin && (
                <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => importRef.current?.click()}>
                  <Plus className="h-3.5 w-3.5" />
                  Import Assets
                </Button>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={Package}
              label="Total Assets"
              value={assets.length}
              sub="registered units"
            />
            <StatCard
              icon={FileText}
              label="Active Site Contracts"
              value={activeSiteContractCount}
              sub="sites under PO"
              accent="bg-blue-50 dark:bg-blue-950/40"
            />
            <StatCard
              icon={AlertTriangle}
              label="Overdue Units"
              value={overdueAssets.length}
              sub={overdueAssets.length > 0 ? "needs attention" : "all clear"}
              accent={overdueAssets.length > 0
                ? "bg-red-50 dark:bg-red-950/40"
                : "bg-emerald-50 dark:bg-emerald-950/40"
              }
            />
            <StatCard
              icon={Clock}
              label="Due Within 30 Days"
              value={dueIn30Count}
              sub="upcoming visits"
              accent="bg-amber-50 dark:bg-amber-950/40"
            />
          </div>

          {/* Overdue Alert Banner */}
          {overdueAssets.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                    ⚠️ {overdueAssets.length} asset{overdueAssets.length > 1 ? "s have" : " has"} overdue maintenance
                  </p>
                  <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                    Scheduled PM visits past due with no uploaded report. Upload the PM report to auto-clear each alert.
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

          {/* Site Filter Chips */}
          <SiteFilterChips
            active={activeSiteFilter}
            onChange={setSiteFilter}
            counts={siteCounts}
          />

          {/* Search Bar */}
          <div className="flex items-center gap-2 flex-wrap">
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

            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setQ(e.target.value)}
                placeholder={searchMode === "SN" ? "e.g. CLM-2025-00101" : "e.g. BSD101/L02/CLM/001/01"}
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

          {/* Asset Table — 6 columns */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["NE ID", "Site Name", "Room", "Floor", "Type PAC", "Serial Number", ""].map((col, i) => (
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
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No assets match your search.
                      </td>
                    </tr>
                  ) : (
                    sorted.map(asset => {
                      const overdue = hasOverdue(asset)
                      const opCfg  = OP_STATUS_CFG[asset.operational_status]
                      return (
                        <tr
                          key={asset.id}
                          onClick={() => openAsset(asset)}
                          className={`hover:bg-muted/40 transition-colors cursor-pointer group ${
                            overdue ? "bg-red-50/30 dark:bg-red-950/10" : ""
                          }`}
                        >
                          {/* NE ID + status dot + overdue flag */}
                          <td className="px-4 py-3 font-mono text-xs font-medium text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${opCfg.dot}`} />
                              {overdue && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                              {asset.ne_id}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground max-w-[160px] truncate">
                            {asset.site_name}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {asset.room}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {asset.floor}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {asset.type_pac}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {asset.serial_number}
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
          siteContract={selected ? getActiveSiteContract(selected.site_name) : null}
          open={drawerOpen}
          onClose={() => setDrawer(false)}
        />

        <SiteContractSheet
          open={contractSheetOpen}
          onClose={() => setContractSheet(false)}
          assets={assets}
          siteContracts={siteContracts}
          setSiteContracts={setSiteContracts}
        />

        <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" title="Import Excel assets" className="hidden" onChange={handleImport} />
        <Toaster richColors />
      </SidebarInset>
    </SidebarProvider>
  )
}
