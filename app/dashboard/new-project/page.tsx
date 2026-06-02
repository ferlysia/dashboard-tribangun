"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar }  from "@/components/app-sidebar"
import { SiteHeader }  from "@/components/site-header"
import {
  FolderOpen, BarChart3, Receipt, Wallet,
  CheckCheck, Lock, Camera, TrendingUp, TrendingDown,
  Minus, ExternalLink, CheckCircle2, X, ChevronRight,
} from "lucide-react"

// ─── Types ─────────────────────────────────────────────────────────────────────

type Phase = {
  id: string
  task_description: string
  week_number: number
  end_week: number
  progress_weight: number
  is_done: boolean
}

type WeekLog = {
  id: string
  phase_id: string
  week_number: number
  description: string
  progress_pct: number
  created_by: string
}

type TerminEntry = {
  id: string
  nama: string
  target_progres: number
  persen_tagihan: number
  status: "TERKUNCI" | "SIAP_TAGIH" | "PROSES_COLLECT" | "LUNAS"
}

type BudgetStream = {
  label: string
  main: number
  vo: number
}

type Project = {
  id: string
  display_name: string
  customer_name: string
  site_location: string
  pic_name: string
  po_number: string
  contract_value: number
  project_status: "BERJALAN" | "SELESAI" | "DITUNDA"
  physical_progress: number
  description: string
  due_date: string
  onedrive_url?: string
  phases: Phase[]
  logs: WeekLog[]
  termins: TerminEntry[]
  budget: BudgetStream[]
}

type DivTab = "doccon" | "cc" | "finance"

// ─── Constants ─────────────────────────────────────────────────────────────────

const GANTT_YEAR  = 2026
const MONTHS_ID   = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]
const COL_W       = 52
const PILL = [
  { bg: "#dbeafe", text: "#1e40af", done: "#3b82f6", border: "#bfdbfe" },
  { bg: "#d1fae5", text: "#065f46", done: "#10b981", border: "#a7f3d0" },
  { bg: "#fce7f3", text: "#831843", done: "#ec4899", border: "#fbcfe8" },
  { bg: "#ede9fe", text: "#4c1d95", done: "#8b5cf6", border: "#ddd6fe" },
  { bg: "#fef3c7", text: "#78350f", done: "#f59e0b", border: "#fde68a" },
  { bg: "#fee2e2", text: "#7f1d1d", done: "#ef4444", border: "#fecaca" },
]

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_PROJECTS: Project[] = [
  {
    id: "p1",
    display_name: "BANJARMASIN CENTRUM 30kW",
    customer_name: "PT. Sinar Matahari Nusantara",
    site_location: "Banjarmasin, Kalimantan Selatan",
    pic_name: "Budi Santoso",
    po_number: "12345/TB-BJM-2026",
    contract_value: 850_000_000,
    project_status: "BERJALAN",
    physical_progress: 65,
    description: "Instalasi sistem PLTS atap kapasitas 30kW untuk gedung komersial Centrum Plaza. Lingkup meliputi pengadaan material, instalasi panel surya, wiring system, dan commissioning grid-tie inverter.",
    due_date: "2026-09-30",
    phases: [
      { id: "ph1-1", task_description: "Survey & Perencanaan",  week_number: 1,  end_week: 4,  progress_weight: 10, is_done: true  },
      { id: "ph1-2", task_description: "Pengadaan Material",    week_number: 5,  end_week: 8,  progress_weight: 20, is_done: true  },
      { id: "ph1-3", task_description: "Instalasi Panel Surya", week_number: 9,  end_week: 16, progress_weight: 35, is_done: true  },
      { id: "ph1-4", task_description: "Wiring & Koneksi",      week_number: 17, end_week: 20, progress_weight: 25, is_done: false },
      { id: "ph1-5", task_description: "Commissioning & Test",  week_number: 21, end_week: 24, progress_weight: 10, is_done: false },
    ],
    logs: [
      { id: "l1-1", phase_id: "ph1-1", week_number: 2,  description: "Survei lokasi selesai. Denah final dan titik mounting disetujui klien.", progress_pct: 10, created_by: "Budi S." },
      { id: "l1-2", phase_id: "ph1-2", week_number: 6,  description: "Material panel 30 unit dan inverter 3-phase tiba di gudang logistik.", progress_pct: 30, created_by: "Rizky P." },
      { id: "l1-3", phase_id: "ph1-3", week_number: 11, description: "Instalasi 15 panel baris pertama selesai. Struktur rangka terpasang kokoh.", progress_pct: 50, created_by: "Budi S." },
      { id: "l1-4", phase_id: "ph1-3", week_number: 15, description: "Semua 30 panel terpasang. Output test awal 28.4kW peak — hampir target.", progress_pct: 65, created_by: "Hendra W." },
    ],
    termins: [
      { id: "t1-1", nama: "DP Kontrak 30%",        target_progres: 0,  persen_tagihan: 30, status: "LUNAS"          },
      { id: "t1-2", nama: "Progress 50% Lapangan",  target_progres: 50, persen_tagihan: 40, status: "PROSES_COLLECT" },
      { id: "t1-3", nama: "Pelunasan Serah Terima", target_progres: 95, persen_tagihan: 30, status: "TERKUNCI"       },
    ],
    budget: [
      { label: "Gaji & Tunjangan",     main: 80_000_000,  vo: 0 },
      { label: "Material / Bahan",     main: 420_000_000, vo: 0 },
      { label: "Transport & Logistik", main: 30_000_000,  vo: 0 },
      { label: "Biaya Operasional",    main: 25_000_000,  vo: 0 },
      { label: "Sewa & Utilitas",      main: 20_000_000,  vo: 0 },
      { label: "Biaya Lainnya",        main: 15_000_000,  vo: 0 },
    ],
  },
  {
    id: "p2",
    display_name: "SURABAYA INDUSTRIAL SOLAR 75kW",
    customer_name: "CV. Industri Mandiri Sejahtera",
    site_location: "Rungkut Industrial Estate, Surabaya",
    pic_name: "Rizky Pratama",
    po_number: "78901/TB-SBY-2026",
    contract_value: 1_250_000_000,
    project_status: "BERJALAN",
    physical_progress: 38,
    description: "PLTS skala industri 75kW untuk kawasan pabrik. Sistem terdiri dari 250 panel monokristallin, 3 unit string inverter, dan panel monitoring berbasis IoT real-time.",
    due_date: "2026-10-15",
    phases: [
      { id: "ph2-1", task_description: "Mobilisasi & Persiapan Site", week_number: 9,  end_week: 12, progress_weight: 15, is_done: true  },
      { id: "ph2-2", task_description: "Pondasi & Struktur Mounting", week_number: 13, end_week: 16, progress_weight: 23, is_done: true  },
      { id: "ph2-3", task_description: "Instalasi Panel 250 Unit",    week_number: 17, end_week: 24, progress_weight: 35, is_done: false },
      { id: "ph2-4", task_description: "Wiring, IoT & Commissioning", week_number: 25, end_week: 32, progress_weight: 27, is_done: false },
    ],
    logs: [
      { id: "l2-1", phase_id: "ph2-1", week_number: 10, description: "Mobilisasi tim 8 orang ke site Surabaya. Gudang material dan peralatan sudah siap.", progress_pct: 15, created_by: "Rizky P." },
      { id: "l2-2", phase_id: "ph2-2", week_number: 14, description: "Pondasi beton 60 titik selesai. Struktur galvanis terpasang 80% dari rencana awal.", progress_pct: 38, created_by: "Rizky P." },
    ],
    termins: [
      { id: "t2-1", nama: "DP Awal 25%",  target_progres: 0,  persen_tagihan: 25, status: "SIAP_TAGIH" },
      { id: "t2-2", nama: "Progress 60%", target_progres: 60, persen_tagihan: 75, status: "TERKUNCI"   },
    ],
    budget: [
      { label: "Gaji & Tunjangan",     main: 120_000_000, vo: 0 },
      { label: "Material / Bahan",     main: 850_000_000, vo: 0 },
      { label: "Transport & Logistik", main: 55_000_000,  vo: 0 },
      { label: "Biaya Operasional",    main: 75_000_000,  vo: 0 },
      { label: "Sewa & Utilitas",      main: 50_000_000,  vo: 0 },
      { label: "Biaya Lainnya",        main: 40_000_000,  vo: 0 },
    ],
  },
  {
    id: "p3",
    display_name: "JAKARTA TOWER RETROFIT 120kW",
    customer_name: "PT. Tower Abadi Gemilang",
    site_location: "SCBD, Jakarta Selatan",
    pic_name: "Hendra Wijaya",
    po_number: "56789/TB-JKT-2025",
    contract_value: 2_100_000_000,
    project_status: "SELESAI",
    physical_progress: 100,
    description: "Retrofit sistem PLTS existing 120kW pada rooftop gedung perkantoran 20 lantai. Termasuk penggantian inverter lama, penambahan 80 panel tier-1, dan upgrade sistem monitoring SCADA.",
    due_date: "2026-05-31",
    onedrive_url: "https://onedrive.live.com/",
    phases: [
      { id: "ph3-1", task_description: "Audit & Desain Sistem",          week_number: 1,  end_week: 4,  progress_weight: 8,  is_done: true },
      { id: "ph3-2", task_description: "Pengadaan Material & Logistik",  week_number: 5,  end_week: 8,  progress_weight: 15, is_done: true },
      { id: "ph3-3", task_description: "Pembongkaran Sistem Lama",       week_number: 9,  end_week: 10, progress_weight: 10, is_done: true },
      { id: "ph3-4", task_description: "Instalasi Panel Baru 80 Unit",   week_number: 11, end_week: 18, progress_weight: 32, is_done: true },
      { id: "ph3-5", task_description: "Inverter & SCADA Integration",   week_number: 19, end_week: 22, progress_weight: 25, is_done: true },
      { id: "ph3-6", task_description: "Commissioning & Hand-Over",      week_number: 23, end_week: 24, progress_weight: 10, is_done: true },
    ],
    logs: [
      { id: "l3-1", phase_id: "ph3-1", week_number: 2,  description: "Audit kondisi panel lama — 40% dalam kondisi degraded, keputusan ganti semua.",      progress_pct: 8,   created_by: "Hendra W." },
      { id: "l3-2", phase_id: "ph3-3", week_number: 9,  description: "Pembongkaran 40 panel lama selesai 1 hari lebih cepat dari jadwal baseline.",          progress_pct: 33,  created_by: "Hendra W." },
      { id: "l3-3", phase_id: "ph3-4", week_number: 14, description: "80 panel baru terpasang penuh. Output test awal: 105kW peak — target 120kW hampir.",   progress_pct: 65,  created_by: "Budi S."   },
      { id: "l3-4", phase_id: "ph3-5", week_number: 20, description: "SCADA online. Dashboard monitoring real-time aktif, data logger terintegrasi sempurna.", progress_pct: 90,  created_by: "Hendra W." },
      { id: "l3-5", phase_id: "ph3-6", week_number: 24, description: "Serah terima ke klien selesai. Semua dokumen as-built dan garansi telah diserahkan. ✓",  progress_pct: 100, created_by: "Hendra W." },
    ],
    termins: [
      { id: "t3-1", nama: "DP Mobilisasi 30%",     target_progres: 0,   persen_tagihan: 30, status: "LUNAS" },
      { id: "t3-2", nama: "Progress 60% Lapangan", target_progres: 60,  persen_tagihan: 40, status: "LUNAS" },
      { id: "t3-3", nama: "Serah Terima Akhir",    target_progres: 100, persen_tagihan: 30, status: "LUNAS" },
    ],
    budget: [
      { label: "Gaji & Tunjangan",     main: 180_000_000,   vo: 0 },
      { label: "Material / Bahan",     main: 1_150_000_000, vo: 0 },
      { label: "Transport & Logistik", main: 80_000_000,    vo: 0 },
      { label: "Biaya Operasional",    main: 65_000_000,    vo: 0 },
      { label: "Sewa & Utilitas",      main: 50_000_000,    vo: 0 },
      { label: "Biaya Lainnya",        main: 30_000_000,    vo: 0 },
    ],
  },
  {
    id: "p4",
    display_name: "BALIKPAPAN SOLAR FARM 250kW",
    customer_name: "Dinas ESDM Kota Balikpapan",
    site_location: "Kawasan Industri Kariangau, Balikpapan",
    pic_name: "Agus Priyanto",
    po_number: "34567/TB-BPP-2026",
    contract_value: 3_500_000_000,
    project_status: "DITUNDA",
    physical_progress: 15,
    description: "Pembangunan solar farm skala 250kW untuk mensuplai kebutuhan listrik kawasan industri. Proyek ditunda karena proses revisi perizinan lahan yang sedang berjalan di Pemda setempat.",
    due_date: "2026-12-31",
    phases: [
      { id: "ph4-1", task_description: "Perizinan & Land Clearing",    week_number: 21, end_week: 24, progress_weight: 15, is_done: true  },
      { id: "ph4-2", task_description: "Pondasi & Civil Works",        week_number: 25, end_week: 36, progress_weight: 40, is_done: false },
      { id: "ph4-3", task_description: "Instalasi Panel & Elektrikal", week_number: 37, end_week: 48, progress_weight: 45, is_done: false },
    ],
    logs: [
      { id: "l4-1", phase_id: "ph4-1", week_number: 22, description: "Land clearing 60% area selesai. IMB dalam proses revisi — proyek hold sementara per instruksi klien.", progress_pct: 15, created_by: "Agus P." },
    ],
    termins: [
      { id: "t4-1", nama: "DP Mobilisasi 15%", target_progres: 10, persen_tagihan: 15, status: "SIAP_TAGIH" },
      { id: "t4-2", nama: "Progress 50%",       target_progres: 50, persen_tagihan: 55, status: "TERKUNCI"   },
      { id: "t4-3", nama: "Serah Terima 100%",  target_progres: 95, persen_tagihan: 30, status: "TERKUNCI"   },
    ],
    budget: [
      { label: "Gaji & Tunjangan",     main: 320_000_000,   vo: 0 },
      { label: "Material / Bahan",     main: 2_200_000_000, vo: 0 },
      { label: "Transport & Logistik", main: 200_000_000,   vo: 0 },
      { label: "Biaya Operasional",    main: 200_000_000,   vo: 0 },
      { label: "Sewa & Utilitas",      main: 150_000_000,   vo: 0 },
      { label: "Biaya Lainnya",        main: 100_000_000,   vo: 0 },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekToMonthIdx(w: number): number { return Math.floor((w - 1) / 4) }

function weekToLabel(w: number): string {
  const totalMo = Math.floor((w - 1) / 4)
  const wInMo   = ((w - 1) % 4) + 1
  const year    = GANTT_YEAR + Math.floor(totalMo / 12)
  return `${MONTHS_ID[totalMo % 12]} '${String(year).slice(2)} W${wInMo}`
}

function fmtRp(n: number): string {
  if (!n) return "—"
  return "Rp " + n.toLocaleString("id-ID")
}

function fShort(n: number): string {
  const abs  = Math.abs(n)
  const sign = n < 0 ? "−" : ""
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000)     return `${sign}Rp ${(abs / 1_000_000).toFixed(0)}Jt`
  if (abs >= 1_000)         return `${sign}Rp ${(abs / 1_000).toFixed(0)}Rb`
  return `${sign}Rp ${Math.round(abs)}`
}

function marginTier(m: number) {
  if (m >= 15) return {
    label: "AMAN",
    dot: "bg-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
  }
  if (m >= 5) return {
    label: "WASPADA",
    dot: "bg-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  }
  if (m >= 0) return {
    label: "KRITIS",
    dot: "bg-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-700 dark:text-orange-400",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
  }
  return {
    label: "RUGI",
    dot: "bg-red-500",
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-400",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
  }
}

// ─── Gantt Chart (read-only) ──────────────────────────────────────────────────

function GanttView({ phases }: { phases: Phase[] }) {
  if (phases.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 rounded-xl border border-dashed border-border">
        <p className="text-xs text-muted-foreground">Belum ada fase dijadwalkan</p>
      </div>
    )
  }

  const minWeek        = Math.min(...phases.map(p => p.week_number))
  const maxWeek        = Math.max(...phases.map(p => Math.max(p.week_number, p.end_week)))
  const gridStartMo    = Math.floor((minWeek - 1) / 4)
  const gridStartWeek  = gridStartMo * 4 + 1
  const rawSpan        = maxWeek - gridStartWeek + 1
  const totalGridWeeks = Math.max(Math.ceil(rawSpan / 4) * 4, 8)
  const weekArr        = Array.from({ length: totalGridWeeks }, (_, k) => gridStartWeek + k)

  const monthGrps: { label: string; count: number }[] = []
  let wIdx = 0, mOff = gridStartMo
  while (wIdx < totalGridWeeks) {
    monthGrps.push({ label: MONTHS_ID[mOff % 12], count: Math.min(4, totalGridWeeks - wIdx) })
    wIdx += 4; mOff++
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
      <div className="flex">
        {/* Phase label column */}
        <div className="w-48 flex-shrink-0 border-r border-border">
          <div className="px-3 bg-muted border-b border-border" style={{ height: 52 }}>
            <div className="flex items-center h-full">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Fase</span>
            </div>
          </div>
          {phases.map((ph, i) => {
            const c = PILL[i % PILL.length]
            return (
              <div key={ph.id}
                className="flex items-center gap-2 px-3 border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                style={{ minHeight: 44 }}>
                <div className="flex-shrink-0 h-4 w-4 rounded flex items-center justify-center"
                  style={{
                    background: ph.is_done ? c.done : "transparent",
                    border: `1.5px solid ${ph.is_done ? c.done : "#d1d5db"}`,
                  }}>
                  {ph.is_done && <CheckCheck className="h-2.5 w-2.5 text-white" />}
                </div>
                <div className="flex-shrink-0 h-2 w-2 rounded-full" style={{ background: c.done }} />
                <span className="text-[11px] min-w-0 flex-1 truncate font-medium"
                  title={ph.task_description}
                  style={{
                    color: ph.is_done ? "#9ca3af" : undefined,
                    textDecoration: ph.is_done ? "line-through" : "none",
                  }}>
                  {ph.task_description}
                </span>
              </div>
            )
          })}
        </div>

        {/* Gantt grid */}
        <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
          <div style={{ minWidth: totalGridWeeks * COL_W }}>
            {/* Month headers */}
            <div className="flex border-b border-border bg-muted">
              {monthGrps.map((mg, mi) => (
                <div key={mi}
                  className="flex-shrink-0 flex items-center justify-center border-r border-border/50 py-1.5"
                  style={{ width: COL_W * mg.count }}>
                  <span className="text-[9px] font-black text-muted-foreground tracking-widest uppercase">{mg.label}</span>
                </div>
              ))}
            </div>
            {/* Week headers */}
            <div className="flex border-b border-border bg-muted">
              {weekArr.map(w => (
                <div key={w}
                  className="flex-shrink-0 flex items-center justify-center py-1.5 border-r border-border/30"
                  style={{ width: COL_W }}>
                  <span className="text-[9px] font-bold text-muted-foreground">W{((w - 1) % 4) + 1}</span>
                </div>
              ))}
            </div>
            {/* Phase bars */}
            {phases.map((ph, i) => {
              const c        = PILL[i % PILL.length]
              const startW   = Math.max(1, ph.week_number)
              const endW     = Math.max(startW, ph.end_week)
              const barLeft  = (startW - gridStartWeek) * COL_W + 4
              const barWidth = (endW - startW + 1) * COL_W - 8
              const lblLeft  = barLeft + barWidth + 6
              return (
                <div key={ph.id}
                  className="relative border-b border-border last:border-0"
                  style={{ minHeight: 44, width: totalGridWeeks * COL_W }}>
                  {/* Column grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {weekArr.map(w => (
                      <div key={w} className="flex-shrink-0 h-full border-r border-border/20" style={{ width: COL_W }} />
                    ))}
                  </div>
                  {/* Bar */}
                  <div
                    className="absolute flex items-center gap-1.5 rounded-full px-3 shadow-sm transition-all"
                    style={{
                      left: barLeft, width: barWidth, height: 26,
                      top: "50%", transform: "translateY(-50%)",
                      background: ph.is_done ? c.done : c.bg,
                      border: `1px solid ${ph.is_done ? "transparent" : c.border}`,
                      zIndex: 1,
                    }}>
                    {ph.is_done && <CheckCheck className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "#fff" }} />}
                    <span className="text-[10px] font-bold tabular-nums whitespace-nowrap"
                      style={{ color: ph.is_done ? "#fff" : c.text }}>
                      {ph.progress_weight}%
                    </span>
                  </div>
                  {/* Label outside bar */}
                  {lblLeft < totalGridWeeks * COL_W - 24 && (
                    <div
                      className="absolute text-[10px] font-medium text-muted-foreground whitespace-nowrap overflow-hidden"
                      style={{
                        left: lblLeft, top: "50%", transform: "translateY(-50%)",
                        maxWidth: totalGridWeeks * COL_W - lblLeft - 4,
                      }}>
                      {ph.task_description}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Log Mingguan Stream (read-only) ─────────────────────────────────────────

function LogStream({ phases, logs }: { phases: Phase[]; logs: WeekLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-border bg-muted/30">
        <Camera className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">Belum ada log mingguan tercatat</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {phases.map((ph, i) => {
        const c         = PILL[i % PILL.length]
        const phaseLogs = logs
          .filter(l => l.phase_id === ph.id)
          .sort((a, b) => a.week_number - b.week_number)
        if (phaseLogs.length === 0) return null
        return (
          <div key={ph.id}>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
              <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: c.done }} />
              <span className="text-xs font-bold text-foreground">{ph.task_description}</span>
              <span className="text-[10px] text-muted-foreground">
                {weekToLabel(ph.week_number)} → {weekToLabel(ph.end_week)}
              </span>
              <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full ${
                ph.is_done
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                  : "bg-muted text-muted-foreground border border-border"
              }`}>
                {ph.is_done ? "✓ Selesai" : `${ph.progress_weight}% bobot`}
              </span>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              {phaseLogs.map((log, li) => (
                <div key={log.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors ${
                    li < phaseLogs.length - 1 ? "border-b border-border/50" : ""
                  }`}>
                  <span
                    className="text-[9px] font-black px-2 py-1 rounded-md mt-0.5 whitespace-nowrap flex-shrink-0"
                    style={{ background: c.bg, color: c.text }}>
                    {weekToLabel(log.week_number)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-relaxed">{log.description}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[9px] text-muted-foreground tabular-nums">{log.progress_pct}% progres</span>
                      <span className="text-[9px] text-muted-foreground">oleh {log.created_by}</span>
                    </div>
                  </div>
                  <div className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: c.bg }}>
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: c.done }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Doc Con Tab ──────────────────────────────────────────────────────────────

function DocConTab({ project }: { project: Project }) {
  const progress   = project.physical_progress
  const progColor  = progress >= 80 ? "#10b981" : progress >= 40 ? "#6366f1" : "#f59e0b"
  const donePhases = project.phases.filter(p => p.is_done).length

  return (
    <div className="flex flex-col gap-6">

      {/* Scope of work block */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Deskripsi Pekerjaan</p>
        <p className="text-sm text-foreground leading-relaxed">{project.description}</p>
      </div>

      {/* Meta chips */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "📍 Lokasi",   value: project.site_location     },
          { label: "🧑‍💼 PIC",    value: project.pic_name          },
          { label: "📜 No. PO",   value: project.po_number         },
          { label: "💰 Kontrak",  value: fmtRp(project.contract_value) },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">{m.label}</p>
            <p className="text-xs font-semibold text-foreground truncate">{m.value}</p>
          </div>
        ))}
      </div>

      {/* OneDrive link */}
      {project.onedrive_url && (
        <a href={project.onedrive_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 hover:underline transition-colors">
          <ExternalLink className="h-3 w-3" /> OneDrive Project Folder →
        </a>
      )}

      {/* Physical progress */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Progres Fisik Lapangan</p>
          <span className="text-3xl font-black tabular-nums leading-none" style={{ color: progColor }}>
            {progress}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, background: progColor }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] text-muted-foreground">
            {donePhases} dari {project.phases.length} fase selesai
          </p>
          {project.due_date && (() => {
            const days = Math.ceil((new Date(project.due_date).getTime() - Date.now()) / 86_400_000)
            return (
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border ${
                days < 0
                  ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
                  : days <= 30
                  ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
                  : "bg-muted text-muted-foreground border-border"
              }`}>
                📅 {days < 0 ? `Terlambat ${Math.abs(days)}h` : `Due ${days}h`}
              </span>
            )
          })()}
        </div>
      </div>

      {/* Gantt Chart */}
      <div>
        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">
          Jadwal &amp; Rencana — {GANTT_YEAR}
        </p>
        <GanttView phases={project.phases} />
      </div>

      {/* Log Mingguan */}
      <div>
        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">
          Log Mingguan Aktual
        </p>
        <LogStream phases={project.phases} logs={project.logs} />
      </div>

    </div>
  )
}

// ─── Cost Control Tab ─────────────────────────────────────────────────────────

function CostControlTab({ project }: { project: Project }) {
  const totalBudget  = project.budget.reduce((s, b) => s + b.main + b.vo, 0)
  const netProfit    = project.contract_value - totalBudget
  const netMarginPct = project.contract_value > 0 ? (netProfit / project.contract_value) * 100 : 0
  const mt           = marginTier(netMarginPct)
  const ProfitIcon   = netProfit > 0 ? TrendingUp : netProfit < 0 ? TrendingDown : Minus

  return (
    <div className="flex flex-col gap-6">

      {/* Hero margin + profit banner */}
      <div className={`rounded-2xl border ${mt.border} ${mt.bg} p-5`}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className={`text-[9px] font-black uppercase tracking-widest ${mt.text} opacity-70 mb-1`}>
              Net Margin
            </p>
            <p className={`text-5xl font-black tabular-nums leading-none ${mt.text}`}>
              {netMarginPct >= 0 ? "+" : ""}{netMarginPct.toFixed(1)}%
            </p>
            <span className={`inline-block mt-3 text-[10px] font-bold px-2.5 py-1 rounded-full ${mt.badge}`}>
              {mt.label}
            </span>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-[9px] font-black uppercase tracking-widest ${mt.text} opacity-70 mb-1`}>
              Net Profit
            </p>
            <p className={`text-xl font-black tabular-nums leading-tight flex items-center justify-end gap-1.5 ${
              netProfit >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              <ProfitIcon className="h-5 w-5" />
              {fmtRp(Math.abs(netProfit))}
            </p>
            <div className="mt-3 flex flex-col gap-0.5">
              <p className={`text-[10px] ${mt.text} opacity-70`}>Kontrak: {fmtRp(project.contract_value)}</p>
              <p className={`text-[10px] ${mt.text} opacity-70`}>Budget:  {fmtRp(totalBudget)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Budget stream breakdown */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted border-b border-border">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
            Alokasi Budget per Stream
          </p>
        </div>
        <div className="divide-y divide-border">
          {project.budget.map((b, idx) => {
            const subtotal = b.main + b.vo
            const pct      = totalBudget > 0 ? (subtotal / totalBudget) * 100 : 0
            return (
              <div key={idx} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{b.label}</p>
                  {b.vo > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Main: {fmtRp(b.main)} + VO: {fmtRp(b.vo)}
                    </p>
                  )}
                </div>
                <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                  <div className="h-full rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-bold text-foreground tabular-nums flex-shrink-0 w-36 text-right">
                  {fmtRp(subtotal)}
                </span>
              </div>
            )
          })}
        </div>
        <div className="px-4 py-3 border-t border-border bg-muted flex items-center justify-between">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Budget</span>
          <span className="text-sm font-black text-foreground tabular-nums">{fmtRp(totalBudget)}</span>
        </div>
      </div>

    </div>
  )
}

// ─── Finance Tab ──────────────────────────────────────────────────────────────

function FinanceTab({ project }: { project: Project }) {
  const cv       = project.contract_value
  const paidAmt  = project.termins
    .filter(t => t.status === "LUNAS")
    .reduce((s, t) => s + Math.round(cv * t.persen_tagihan / 100), 0)
  const billedAmt = project.termins
    .filter(t => t.status === "PROSES_COLLECT" || t.status === "SIAP_TAGIH")
    .reduce((s, t) => s + Math.round(cv * t.persen_tagihan / 100), 0)
  const lockedAmt = project.termins
    .filter(t => t.status === "TERKUNCI")
    .reduce((s, t) => s + Math.round(cv * t.persen_tagihan / 100), 0)

  return (
    <div className="flex flex-col gap-6">

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Sudah Lunas",    value: fmtRp(paidAmt),   cls: "text-emerald-600 dark:text-emerald-400" },
          { label: "Sedang Ditagih", value: fmtRp(billedAmt), cls: "text-amber-600 dark:text-amber-400"     },
          { label: "Terkunci",       value: fmtRp(lockedAmt), cls: "text-muted-foreground"                  },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">{item.label}</p>
            <p className={`text-sm font-black tabular-nums ${item.cls}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Termin milestone list */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted border-b border-border">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
            Milestone Pembayaran — Terms of Payment
          </p>
        </div>
        <div className="divide-y divide-border">
          {project.termins.map((t, i) => {
            const amt      = cv > 0 ? Math.round(cv * t.persen_tagihan / 100) : 0
            const isLunas  = t.status === "LUNAS"
            const isBilled = t.status === "PROSES_COLLECT"
            const isReady  = t.status === "SIAP_TAGIH"
            const isLocked = t.status === "TERKUNCI"
            return (
              <div key={t.id}
                className={`flex items-center gap-4 px-4 py-4 transition-colors ${
                  isLunas  ? "bg-emerald-50/50 dark:bg-emerald-950/20" :
                  isBilled ? "bg-blue-50/50 dark:bg-blue-950/20"       :
                  isReady  ? "bg-amber-50/50 dark:bg-amber-950/20"     :
                  "hover:bg-muted/40"
                }`}>
                {/* Index circle */}
                <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-black ${
                  isLunas  ? "bg-emerald-500 text-white" :
                  isBilled ? "bg-blue-500 text-white"    :
                  isReady  ? "bg-amber-400 text-white"   :
                  "bg-muted text-muted-foreground"
                }`}>{i + 1}</div>
                {/* Termin name + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t.nama}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">Trigger: ≥{t.target_progres}% progres</span>
                    <span className="text-[10px] text-muted-foreground">Porsi: {t.persen_tagihan}%</span>
                    {amt > 0 && (
                      <span className="text-[10px] font-semibold text-foreground">≈ {fmtRp(amt)}</span>
                    )}
                  </div>
                </div>
                {/* Status badge */}
                <div className="flex-shrink-0">
                  {isLunas  && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800">
                      <CheckCircle2 className="h-3 w-3" /> LUNAS
                    </span>
                  )}
                  {isBilled && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800">
                      ⏳ DITAGIH
                    </span>
                  )}
                  {isReady  && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800">
                      ⚡ SIAP TAGIH
                    </span>
                  )}
                  {isLocked && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground border border-border">
                      <Lock className="h-3 w-3" /> TERKUNCI
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

// ─── Project Summary Card ─────────────────────────────────────────────────────

function ProjectSummaryCard({
  project, isActive, onClick,
}: {
  project: Project
  isActive: boolean
  onClick: () => void
}) {
  const totalBudget = project.budget.reduce((s, b) => s + b.main + b.vo, 0)
  const netMargin   = project.contract_value > 0
    ? ((project.contract_value - totalBudget) / project.contract_value) * 100
    : 0
  const mt          = marginTier(netMargin)
  const progress    = project.physical_progress
  const progColor   = progress >= 80 ? "#10b981" : progress >= 40 ? "#6366f1" : "#f59e0b"

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left relative flex flex-col rounded-2xl bg-card border
        cursor-pointer transition-all duration-200 overflow-hidden hover:shadow-md
        ${isActive
          ? "border-indigo-400 shadow-lg shadow-indigo-100/60 dark:shadow-indigo-900/40 ring-1 ring-indigo-400/20"
          : "border-border hover:border-neutral-300 dark:hover:border-neutral-600"
        }
      `}
    >
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500" />
      )}
      {/* Left margin health dot */}
      <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${mt.dot}`} />

      {/* Header */}
      <div className="pl-5 pr-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0 ${
            project.project_status === "SELESAI"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
              : project.project_status === "DITUNDA"
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
              : "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
          }`}>
            {project.project_status}
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${mt.badge}`}>
            {mt.label}
          </span>
        </div>
        <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2">{project.display_name}</h3>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{project.customer_name}</p>
      </div>

      {/* Body */}
      <div className="pl-5 pr-4 pt-3 pb-4 flex flex-col gap-3 flex-1">
        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Progres Fisik</span>
            <span className="text-xs font-black tabular-nums" style={{ color: progColor }}>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, background: progColor }} />
          </div>
        </div>

        {/* Net margin chip */}
        <div className={`rounded-lg px-3 py-2 ${mt.bg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[9px] font-black uppercase tracking-widest ${mt.text} opacity-70`}>Net Margin</span>
            <span className={`text-sm font-black tabular-nums ${mt.text}`}>
              {netMargin >= 0 ? "+" : ""}{netMargin.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Finance billing dots */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Billing</span>
          <div className="flex gap-1.5">
            {project.termins.map((t, i) => (
              <div key={t.id}
                title={`T${i + 1}: ${t.nama} — ${t.status}`}
                className={`h-2 w-5 rounded-full ${
                  t.status === "LUNAS"           ? "bg-emerald-500" :
                  t.status === "PROSES_COLLECT"  ? "bg-blue-500"    :
                  t.status === "SIAP_TAGIH"      ? "bg-amber-400"   :
                  "bg-muted-foreground/25"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pl-5 pr-4 pb-3 pt-2 border-t border-border flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground font-mono truncate">{project.po_number}</span>
        <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 flex-shrink-0 ${
          isActive ? "text-indigo-500 rotate-90" : "text-muted-foreground/50"
        }`} />
      </div>
    </button>
  )
}

// ─── Project Detail Panel ─────────────────────────────────────────────────────

function ProjectDetailPanel({
  project, onClose,
}: {
  project: Project
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = React.useState<DivTab>("doccon")

  const tabs: { id: DivTab; label: string; icon: React.ReactNode; active: string }[] = [
    {
      id: "doccon",
      label: "Doc Con",
      icon: <BarChart3 className="h-3.5 w-3.5" />,
      active: "text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400",
    },
    {
      id: "cc",
      label: "Cost Control",
      icon: <Receipt className="h-3.5 w-3.5" />,
      active: "text-violet-600 dark:text-violet-400 border-violet-600 dark:border-violet-400",
    },
    {
      id: "finance",
      label: "Finance",
      icon: <Wallet className="h-3.5 w-3.5" />,
      active: "text-amber-600 dark:text-amber-400 border-amber-600 dark:border-amber-400",
    },
  ]

  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{project.display_name}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {project.customer_name} · {project.site_location}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup panel"
          title="Tutup panel"
          className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Division tab bar */}
      <div className="flex items-center px-6 border-b border-border bg-card overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.id
                ? tab.active
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-6 py-6 overflow-y-auto" style={{ maxHeight: "72vh" }}>
        {activeTab === "doccon"  && <DocConTab      project={project} />}
        {activeTab === "cc"      && <CostControlTab project={project} />}
        {activeTab === "finance" && <FinanceTab     project={project} />}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const activeProject = MOCK_PROJECTS.find(p => p.id === activeId) ?? null

  const totalContract = MOCK_PROJECTS.reduce((s, p) => s + p.contract_value, 0)
  const activeCount   = MOCK_PROJECTS.filter(p => p.project_status === "BERJALAN").length
  const doneCount     = MOCK_PROJECTS.filter(p => p.project_status === "SELESAI").length
  const heldCount     = MOCK_PROJECTS.filter(p => p.project_status === "DITUNDA").length

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full px-6 py-8 flex flex-col gap-8">

            {/* Page header */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                Master Directory
              </p>
              <h1 className="text-2xl font-black text-foreground tracking-tight">Project Portfolio</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {MOCK_PROJECTS.length} proyek — review operasional terpadu Doc Con · Cost Control · Finance
              </p>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Proyek",    value: String(MOCK_PROJECTS.length), sub: "dalam direktori"    },
                { label: "Sedang Berjalan", value: String(activeCount),          sub: "proyek aktif"       },
                { label: "Nilai Portfolio", value: fShort(totalContract),        sub: "total kontrak"      },
                { label: "Selesai / Ditunda", value: `${doneCount} / ${heldCount}`, sub: "serah terima · hold" },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">{s.label}</p>
                  <p className="text-2xl font-black text-foreground tabular-nums">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Project grid */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-4">
                Direktori Proyek — klik kartu untuk buka review terpadu
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {MOCK_PROJECTS.map(p => (
                  <ProjectSummaryCard
                    key={p.id}
                    project={p}
                    isActive={activeId === p.id}
                    onClick={() => setActiveId(prev => prev === p.id ? null : p.id)}
                  />
                ))}
              </div>
            </div>

            {/* Expanded detail panel */}
            {activeProject && (
              <ProjectDetailPanel
                project={activeProject}
                onClose={() => setActiveId(null)}
              />
            )}

          </div>
        </div>

      </SidebarInset>
    </SidebarProvider>
  )
}
