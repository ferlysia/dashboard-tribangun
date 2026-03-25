create extension if not exists "pgcrypto";

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  no integer,
  invoice_no text not null,
  customer text not null default '',
  description text not null default '',
  date date,
  year integer not null,
  month integer not null default 0,
  po_number text not null default '',
  po_date date,
  po_value numeric(18,2) not null default 0,
  sheet_name text not null default '',
  workbook_year integer not null,
  source_file text not null default '',
  tax_type text not null default 'PPN',
  dpp numeric(18,2) not null default 0,
  ppn numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  invoice_sent_date text not null default '',
  payment_date text not null default '',
  payment_value numeric(18,2) not null default 0,
  selisih numeric(18,2) not null default 0,
  keterangan text not null default '',
  status text not null default 'UNPAID',
  is_placeholder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists invoices_source_unique
  on public.invoices (workbook_year, sheet_name, invoice_no);

create index if not exists invoices_year_idx on public.invoices (year);
create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_customer_idx on public.invoices (customer);

create table if not exists public.app_user_profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role text not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null default '',
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

alter table public.invoices enable row level security;
alter table public.app_user_profiles enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "invoices_select_public" on public.invoices;
create policy "invoices_select_public"
on public.invoices
for select
to anon, authenticated
using (true);

drop policy if exists "profiles_select_authenticated" on public.app_user_profiles;
create policy "profiles_select_authenticated"
on public.app_user_profiles
for select
to authenticated
using (true);

drop policy if exists "activity_logs_select_authenticated" on public.activity_logs;
create policy "activity_logs_select_authenticated"
on public.activity_logs
for select
to authenticated
using (true);
