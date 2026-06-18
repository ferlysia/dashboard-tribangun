-- Detail breakdown tables feeding BEBAN GAJI / BEBAN KEPERLUAN PROYEK /
-- BEBAN KEPERLUAN KANTOR on pnl_reconciliations. Each child row belongs to
-- exactly one period (pnl_id), and the sum of its `jumlah` column is what
-- the main P&L grid displays for that row's Komersial value.

-- ─── BEBAN GAJI ──────────────────────────────────────────────────────────────
create table if not exists public.pnl_gaji_details (
  id          uuid          primary key default gen_random_uuid(),
  pnl_id      uuid          not null references public.pnl_reconciliations(id) on delete cascade,
  nama        text          not null default '',
  nik         text          not null default '',
  tahun       integer,
  ptkp        text          not null default '',
  upah        numeric(18,2) not null default 0,
  hari        numeric(10,2) not null default 0,
  calc_mode   text          not null default 'multiply' check (calc_mode in ('multiply', 'add')),
  jumlah      numeric(18,2) not null default 0,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create index if not exists pnl_gaji_details_pnl_idx on public.pnl_gaji_details (pnl_id);

drop trigger if exists trg_pnl_gaji_details_updated_at on public.pnl_gaji_details;
create trigger trg_pnl_gaji_details_updated_at
before update on public.pnl_gaji_details
for each row execute function public.set_updated_at();

alter table public.pnl_gaji_details enable row level security;
drop policy if exists "pnl_gaji_details_all" on public.pnl_gaji_details;
create policy "pnl_gaji_details_all"
on public.pnl_gaji_details for all to anon, authenticated using (true) with check (true);

-- ─── BEBAN KEPERLUAN PROYEK ──────────────────────────────────────────────────
-- category: operational | transport | material | pph_sewa | aset | jasa_instalasi
create table if not exists public.pnl_proyek_details (
  id          uuid          primary key default gen_random_uuid(),
  pnl_id      uuid          not null references public.pnl_reconciliations(id) on delete cascade,
  category    text          not null check (category in ('operational', 'transport', 'material', 'pph_sewa', 'aset', 'jasa_instalasi')),
  tanggal     date,
  deskripsi   text          not null default '',
  jumlah      numeric(18,2) not null default 0,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create index if not exists pnl_proyek_details_pnl_idx on public.pnl_proyek_details (pnl_id);

drop trigger if exists trg_pnl_proyek_details_updated_at on public.pnl_proyek_details;
create trigger trg_pnl_proyek_details_updated_at
before update on public.pnl_proyek_details
for each row execute function public.set_updated_at();

alter table public.pnl_proyek_details enable row level security;
drop policy if exists "pnl_proyek_details_all" on public.pnl_proyek_details;
create policy "pnl_proyek_details_all"
on public.pnl_proyek_details for all to anon, authenticated using (true) with check (true);

-- ─── BEBAN KEPERLUAN KANTOR ──────────────────────────────────────────────────
-- category: transport | utilitas | operational_kantor
create table if not exists public.pnl_kantor_details (
  id          uuid          primary key default gen_random_uuid(),
  pnl_id      uuid          not null references public.pnl_reconciliations(id) on delete cascade,
  category    text          not null check (category in ('transport', 'utilitas', 'operational_kantor')),
  tanggal     date,
  deskripsi   text          not null default '',
  jumlah      numeric(18,2) not null default 0,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create index if not exists pnl_kantor_details_pnl_idx on public.pnl_kantor_details (pnl_id);

drop trigger if exists trg_pnl_kantor_details_updated_at on public.pnl_kantor_details;
create trigger trg_pnl_kantor_details_updated_at
before update on public.pnl_kantor_details
for each row execute function public.set_updated_at();

alter table public.pnl_kantor_details enable row level security;
drop policy if exists "pnl_kantor_details_all" on public.pnl_kantor_details;
create policy "pnl_kantor_details_all"
on public.pnl_kantor_details for all to anon, authenticated using (true) with check (true);
