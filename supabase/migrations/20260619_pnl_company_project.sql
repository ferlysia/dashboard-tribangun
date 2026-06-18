-- Perusahaan / NPWP / Project Name form a single unified package identity
-- for a P&L period. The header search resolves any of the three fields to
-- the same (perusahaan, project_name) package and loads its history.
alter table public.pnl_reconciliations add column if not exists perusahaan    text not null default '';
alter table public.pnl_reconciliations add column if not exists npwp         text not null default '';
alter table public.pnl_reconciliations add column if not exists project_name text not null default '';

drop index if exists public.pnl_reconciliations_period_idx;

create unique index if not exists pnl_reconciliations_period_company_idx
  on public.pnl_reconciliations (period_type, period_year, period_month, perusahaan, project_name);

create index if not exists pnl_reconciliations_perusahaan_idx   on public.pnl_reconciliations (perusahaan);
create index if not exists pnl_reconciliations_project_name_idx on public.pnl_reconciliations (project_name);
