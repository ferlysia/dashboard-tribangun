create extension if not exists "pgcrypto";

-- ─── invoices ───────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id                  uuid          primary key default gen_random_uuid(),
  no                  integer,
  invoice_no          text          not null,
  project_type        text          not null default '',
  customer            text          not null default '',
  site_name           text          not null default '',
  description         text          not null default '',
  date                date,
  year                integer       not null,
  month               integer       not null default 0,
  po_number           text          not null default '',
  po_date             date,
  po_value            numeric(18,2) not null default 0,
  sheet_name          text          not null default '',
  workbook_year       integer       not null,
  source_file         text          not null default '',
  tax_type            text          not null default 'PPN',
  dpp                 numeric(18,2) not null default 0,
  ppn                 numeric(18,2) not null default 0,
  total               numeric(18,2) not null default 0,
  invoice_sent_date   text          not null default '',
  terms_of_payment    integer,
  payment_date        text          not null default '',
  payment_value       numeric(18,2) not null default 0,
  selisih             numeric(18,2) not null default 0,
  keterangan          text          not null default '',
  status              text          not null default 'UNPAID',
  is_placeholder      boolean       not null default false,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);

-- ─── Migration: add new columns if table already exists ─────────────────────
-- Run these ALTER statements when upgrading an existing database:
--
--   alter table public.invoices add column if not exists project_type      text          not null default '';
--   alter table public.invoices add column if not exists site_name         text          not null default '';
--   alter table public.invoices add column if not exists terms_of_payment  integer;
--
-- After running, backfill site_name from existing customer column:
--   update public.invoices
--     set site_name = trim(substring(customer from '\(([^)]+)\)'))
--   where customer like '%(%'
--     and (site_name is null or site_name = '');
-- ────────────────────────────────────────────────────────────────────────────

create unique index if not exists invoices_source_unique
  on public.invoices (workbook_year, sheet_name, invoice_no);

create index if not exists invoices_year_idx      on public.invoices (year);
create index if not exists invoices_status_idx    on public.invoices (status);
create index if not exists invoices_customer_idx  on public.invoices (customer);
create index if not exists invoices_site_idx      on public.invoices (site_name);
create index if not exists invoices_project_type_idx on public.invoices (project_type);

-- ─── app_user_profiles ───────────────────────────────────────────────────────
create table if not exists public.app_user_profiles (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null unique,
  full_name   text        not null,
  role        text        not null default 'viewer',
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── activity_logs ───────────────────────────────────────────────────────────
create table if not exists public.activity_logs (
  id          uuid        primary key default gen_random_uuid(),
  actor_email text        not null default '',
  action      text        not null,
  entity_type text        not null,
  entity_id   text        not null,
  summary     text        not null default '',
  payload     jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ─── updated_at trigger ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

drop trigger if exists trg_app_user_profiles_updated_at on public.app_user_profiles;
create trigger trg_app_user_profiles_updated_at
before update on public.app_user_profiles
for each row
execute function public.set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.invoices          enable row level security;
alter table public.app_user_profiles enable row level security;
alter table public.activity_logs     enable row level security;

drop policy if exists "invoices_select_public" on public.invoices;
create policy "invoices_select_public"
on public.invoices for select to anon, authenticated using (true);

drop policy if exists "profiles_select_authenticated" on public.app_user_profiles;
create policy "profiles_select_authenticated"
on public.app_user_profiles for select to authenticated using (true);

drop policy if exists "activity_logs_select_authenticated" on public.activity_logs;
create policy "activity_logs_select_authenticated"
on public.activity_logs for select to authenticated using (true);

-- ─── project_details ─────────────────────────────────────────────────────────
create table if not exists public.project_details (
  project_key       text          primary key,
  display_name      text          not null default '',
  physical_progress integer       not null default 0,
  notes             text          not null default '',
  -- Document Control fields
  site_location     text          not null default '',
  description       text          not null default '',
  po_value_manual   numeric(18,2) not null default 0,
  -- Cost Control (Finance) - biaya operasional bulanan rata-rata
  op_gaji           numeric(18,2) not null default 0,
  op_material       numeric(18,2) not null default 0,
  op_transport      numeric(18,2) not null default 0,
  op_operasional    numeric(18,2) not null default 0,
  op_sewa           numeric(18,2) not null default 0,
  op_lainnya        numeric(18,2) not null default 0,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

-- Migration: run these on existing DB
-- alter table public.project_details add column if not exists site_location   text          not null default '';
-- alter table public.project_details add column if not exists description      text          not null default '';
-- alter table public.project_details add column if not exists po_value_manual  numeric(18,2) not null default 0;
-- alter table public.project_details add column if not exists op_gaji          numeric(18,2) not null default 0;
-- alter table public.project_details add column if not exists op_material      numeric(18,2) not null default 0;
-- alter table public.project_details add column if not exists op_transport     numeric(18,2) not null default 0;
-- alter table public.project_details add column if not exists op_operasional   numeric(18,2) not null default 0;
-- alter table public.project_details add column if not exists op_sewa          numeric(18,2) not null default 0;
-- alter table public.project_details add column if not exists op_lainnya       numeric(18,2) not null default 0;

drop trigger if exists trg_project_details_updated_at on public.project_details;
create trigger trg_project_details_updated_at
before update on public.project_details
for each row execute function public.set_updated_at();

-- ─── project_costs ───────────────────────────────────────────────────────────
create table if not exists public.project_costs (
  id           uuid          primary key default gen_random_uuid(),
  project_key  text          not null,
  category     text          not null default 'lainnya',
  description  text          not null default '',
  amount       numeric(18,2) not null default 0,
  cost_date    date,
  input_by     text          not null default '',
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);

create index if not exists project_costs_key_idx on public.project_costs (project_key);

drop trigger if exists trg_project_costs_updated_at on public.project_costs;
create trigger trg_project_costs_updated_at
before update on public.project_costs
for each row execute function public.set_updated_at();

alter table public.project_details enable row level security;
alter table public.project_costs   enable row level security;

drop policy if exists "project_details_all" on public.project_details;
create policy "project_details_all"
on public.project_details for all to anon, authenticated using (true) with check (true);

drop policy if exists "project_costs_all" on public.project_costs;
create policy "project_costs_all"
on public.project_costs for all to anon, authenticated using (true) with check (true);
