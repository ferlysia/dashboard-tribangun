-- P&L (Laba Rugi) komersial/koreksi/fiskal reconciliation matrix.
-- One row per period (monthly or yearly). period_month = 0 for yearly periods
-- so the unique constraint below works without NULL-comparison surprises.
create table if not exists public.pnl_reconciliations (
  id                 uuid          primary key default gen_random_uuid(),
  period_type        text          not null check (period_type in ('monthly', 'yearly')),
  period_year        integer       not null,
  period_month       integer       not null default 0 check (period_month between 0 and 12),

  penjualan_komersial                        numeric(18,2) not null default 0,
  penjualan_koreksi                          numeric(18,2) not null default 0,
  penjualan_fiskal                           numeric(18,2) not null default 0,

  hpp_komersial                              numeric(18,2) not null default 0,
  hpp_koreksi                                numeric(18,2) not null default 0,
  hpp_fiskal                                 numeric(18,2) not null default 0,

  laba_kotor_komersial                       numeric(18,2) not null default 0,
  laba_kotor_koreksi                         numeric(18,2) not null default 0,
  laba_kotor_fiskal                          numeric(18,2) not null default 0,

  beban_gaji_komersial                       numeric(18,2) not null default 0,
  beban_gaji_koreksi                         numeric(18,2) not null default 0,
  beban_gaji_fiskal                          numeric(18,2) not null default 0,

  beban_keperluan_proyek_komersial           numeric(18,2) not null default 0,
  beban_keperluan_proyek_koreksi             numeric(18,2) not null default 0,
  beban_keperluan_proyek_fiskal              numeric(18,2) not null default 0,

  beban_keperluan_kantor_komersial           numeric(18,2) not null default 0,
  beban_keperluan_kantor_koreksi             numeric(18,2) not null default 0,
  beban_keperluan_kantor_fiskal              numeric(18,2) not null default 0,

  beban_pph_komersial                        numeric(18,2) not null default 0,
  beban_pph_koreksi                          numeric(18,2) not null default 0,
  beban_pph_fiskal                           numeric(18,2) not null default 0,

  beban_penyusutan_komersial                 numeric(18,2) not null default 0,
  beban_penyusutan_koreksi                   numeric(18,2) not null default 0,
  beban_penyusutan_fiskal                    numeric(18,2) not null default 0,

  beban_bunga_komersial                      numeric(18,2) not null default 0,
  beban_bunga_koreksi                        numeric(18,2) not null default 0,
  beban_bunga_fiskal                         numeric(18,2) not null default 0,

  total_beban_adm_umum_komersial             numeric(18,2) not null default 0,
  total_beban_adm_umum_koreksi               numeric(18,2) not null default 0,
  total_beban_adm_umum_fiskal                numeric(18,2) not null default 0,

  laba_usaha_komersial                       numeric(18,2) not null default 0,
  laba_usaha_koreksi                         numeric(18,2) not null default 0,
  laba_usaha_fiskal                          numeric(18,2) not null default 0,

  pendapatan_bunga_jasa_giro_komersial       numeric(18,2) not null default 0,
  pendapatan_bunga_jasa_giro_koreksi         numeric(18,2) not null default 0,
  pendapatan_bunga_jasa_giro_fiskal          numeric(18,2) not null default 0,

  pendapatan_lainnya_komersial               numeric(18,2) not null default 0,
  pendapatan_lainnya_koreksi                 numeric(18,2) not null default 0,
  pendapatan_lainnya_fiskal                  numeric(18,2) not null default 0,

  beban_pajak_bunga_komersial                numeric(18,2) not null default 0,
  beban_pajak_bunga_koreksi                  numeric(18,2) not null default 0,
  beban_pajak_bunga_fiskal                   numeric(18,2) not null default 0,

  beban_administrasi_bank_komersial          numeric(18,2) not null default 0,
  beban_administrasi_bank_koreksi            numeric(18,2) not null default 0,
  beban_administrasi_bank_fiskal             numeric(18,2) not null default 0,

  total_pendapatan_diluar_usaha_komersial    numeric(18,2) not null default 0,
  total_pendapatan_diluar_usaha_koreksi      numeric(18,2) not null default 0,
  total_pendapatan_diluar_usaha_fiskal       numeric(18,2) not null default 0,

  laba_sebelum_pajak_komersial               numeric(18,2) not null default 0,
  laba_sebelum_pajak_koreksi                 numeric(18,2) not null default 0,
  laba_sebelum_pajak_fiskal                  numeric(18,2) not null default 0,

  pph_badan_komersial                        numeric(18,2) not null default 0,
  pph_badan_koreksi                          numeric(18,2) not null default 0,
  pph_badan_fiskal                           numeric(18,2) not null default 0,

  pph_final_konstruksi_komersial             numeric(18,2) not null default 0,
  pph_final_konstruksi_koreksi               numeric(18,2) not null default 0,
  pph_final_konstruksi_fiskal                numeric(18,2) not null default 0,

  laba_bersih_komersial                      numeric(18,2) not null default 0,
  laba_bersih_koreksi                        numeric(18,2) not null default 0,
  laba_bersih_fiskal                         numeric(18,2) not null default 0,

  created_at         timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);

create unique index if not exists pnl_reconciliations_period_idx
  on public.pnl_reconciliations (period_type, period_year, period_month);

drop trigger if exists trg_pnl_reconciliations_updated_at on public.pnl_reconciliations;
create trigger trg_pnl_reconciliations_updated_at
before update on public.pnl_reconciliations
for each row execute function public.set_updated_at();

alter table public.pnl_reconciliations enable row level security;

drop policy if exists "pnl_reconciliations_all" on public.pnl_reconciliations;
create policy "pnl_reconciliations_all"
on public.pnl_reconciliations for all to anon, authenticated using (true) with check (true);
