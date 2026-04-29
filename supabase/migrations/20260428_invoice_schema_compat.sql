alter table public.invoices add column if not exists project_type text not null default '';
alter table public.invoices add column if not exists site_name text not null default '';
alter table public.invoices add column if not exists terms_of_payment integer;

update public.invoices
set site_name = trim(substring(customer from '\(([^)]+)\)'))
where customer like '%(%'
  and coalesce(site_name, '') = '';

create index if not exists invoices_site_idx on public.invoices (site_name);
create index if not exists invoices_project_type_idx on public.invoices (project_type);
