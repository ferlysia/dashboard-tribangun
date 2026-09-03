-- Adds the FINANCE role to the RBAC role set (lib/rbac/access-control.ts).

alter table public.app_user_profiles
  drop constraint if exists app_user_profiles_role_check;

alter table public.app_user_profiles
  add constraint app_user_profiles_role_check
  check (role in ('ADMIN', 'BOSS', 'PR', 'PROJECT', 'HR', 'FINANCE'))
  not valid;

alter table public.app_user_profiles
  validate constraint app_user_profiles_role_check;
