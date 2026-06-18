export type PnlColumn = "komersial" | "koreksi" | "fiskal"

export type PnlRowDef =
  | { kind: "section"; label: string }
  | { kind: "input"; key: string; label: string; indent?: boolean; bold?: boolean }
  | { kind: "calc"; key: string; label: string; indent?: boolean; bold?: boolean; formula: (v: Record<string, number>) => number }

export const PNL_ROWS: PnlRowDef[] = [
  { kind: "input", key: "penjualan", label: "PENJUALAN" },
  { kind: "input", key: "hpp", label: "HARGA POKOK PENJUALAN" },
  { kind: "calc", key: "laba_kotor", label: "LABA KOTOR", bold: true, formula: (v) => v.penjualan - v.hpp },

  { kind: "section", label: "BEBAN ADMINISTRASI DAN UMUM" },
  { kind: "input", key: "beban_gaji", label: "BEBAN GAJI", indent: true },
  { kind: "input", key: "beban_keperluan_proyek", label: "BEBAN KEPERLUAN PROYEK", indent: true },
  { kind: "input", key: "beban_keperluan_kantor", label: "BEBAN KEPERLUAN KANTOR", indent: true },
  { kind: "input", key: "beban_pph", label: "BEBAN PPH", indent: true },
  { kind: "input", key: "beban_penyusutan", label: "BEBAN PENYUSUTAN", indent: true },
  { kind: "input", key: "beban_bunga", label: "BEBAN BUNGA", indent: true },
  {
    kind: "calc",
    key: "total_beban_adm_umum",
    label: "TOTAL BEBAN ADMINISTRASI DAN UMUM",
    indent: true,
    formula: (v) =>
      v.beban_gaji + v.beban_keperluan_proyek + v.beban_keperluan_kantor + v.beban_pph + v.beban_penyusutan + v.beban_bunga,
  },

  { kind: "calc", key: "laba_usaha", label: "LABA USAHA", bold: true, formula: (v) => v.laba_kotor - v.total_beban_adm_umum },

  { kind: "section", label: "PENDAPATAN & (BIAYA) DILUAR USAHA" },
  { kind: "input", key: "pendapatan_bunga_jasa_giro", label: "PENDAPATAN BUNGA / JASA GIRO", indent: true },
  { kind: "input", key: "pendapatan_lainnya", label: "PENDAPATAN LAINNYA", indent: true },
  { kind: "input", key: "beban_pajak_bunga", label: "BEBAN PAJAK BUNGA", indent: true },
  { kind: "input", key: "beban_administrasi_bank", label: "BEBAN ADMINISTRASI BANK", indent: true },
  {
    kind: "calc",
    key: "total_pendapatan_diluar_usaha",
    label: "TOTAL PENDAPATAN & (BIAYA) DILUAR USAHA",
    indent: true,
    formula: (v) => v.pendapatan_bunga_jasa_giro + v.pendapatan_lainnya + v.beban_pajak_bunga + v.beban_administrasi_bank,
  },

  { kind: "calc", key: "laba_sebelum_pajak", label: "LABA SEBELUM PAJAK", bold: true, formula: (v) => v.laba_usaha },
  { kind: "input", key: "pph_badan", label: "PPH BADAN" },
  { kind: "input", key: "pph_final_konstruksi", label: "PPH FINAL KONSTRUKSI" },
  {
    kind: "calc",
    key: "laba_bersih",
    label: "LABA BERSIH",
    bold: true,
    formula: (v) => v.laba_usaha - v.pph_badan - v.pph_final_konstruksi,
  },
]

export const PNL_ROW_KEYS = PNL_ROWS.filter((r) => r.kind !== "section").map((r) => (r as { key: string }).key)

export const PNL_COLUMNS: PnlColumn[] = ["komersial", "koreksi", "fiskal"]

export function dbColumn(rowKey: string, column: PnlColumn) {
  return `${rowKey}_${column}`
}

export type PnlMatrixValues = Record<string, { komersial: number; koreksi: number; fiskal: number }>

export function emptyMatrix(): PnlMatrixValues {
  const out: PnlMatrixValues = {}
  for (const key of PNL_ROW_KEYS) out[key] = { komersial: 0, koreksi: 0, fiskal: 0 }
  return out
}

export function recomputeMatrix(matrix: PnlMatrixValues): PnlMatrixValues {
  const next: PnlMatrixValues = {}
  const komersialByKey: Record<string, number> = {}
  const koreksiByKey: Record<string, number> = {}

  for (const row of PNL_ROWS) {
    if (row.kind === "section") continue
    const komersial = row.kind === "input" ? matrix[row.key]?.komersial ?? 0 : row.formula(komersialByKey)
    const koreksi = row.kind === "input" ? matrix[row.key]?.koreksi ?? 0 : row.formula(koreksiByKey)
    komersialByKey[row.key] = komersial
    koreksiByKey[row.key] = koreksi
    next[row.key] = { komersial, koreksi, fiskal: komersial - koreksi }
  }

  return next
}

export function matrixToDbPayload(matrix: PnlMatrixValues): Record<string, number> {
  const payload: Record<string, number> = {}
  for (const key of PNL_ROW_KEYS) {
    const row = matrix[key] ?? { komersial: 0, koreksi: 0, fiskal: 0 }
    payload[dbColumn(key, "komersial")] = row.komersial
    payload[dbColumn(key, "koreksi")] = row.koreksi
    payload[dbColumn(key, "fiskal")] = row.fiskal
  }
  return payload
}

export function dbRecordToMatrix(record: Record<string, unknown> | null): PnlMatrixValues {
  const matrix = emptyMatrix()
  if (!record) return matrix
  for (const key of PNL_ROW_KEYS) {
    matrix[key] = {
      komersial: Number(record[dbColumn(key, "komersial")] ?? 0),
      koreksi: Number(record[dbColumn(key, "koreksi")] ?? 0),
      fiskal: Number(record[dbColumn(key, "fiskal")] ?? 0),
    }
  }
  return matrix
}
