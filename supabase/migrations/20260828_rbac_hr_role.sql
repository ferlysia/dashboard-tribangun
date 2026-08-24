-- Adds the HR role to the RBAC role set.
--
-- Schema note: app_user_profiles.role has always been a plain `text` column
-- with no enum type or CHECK constraint in the tracked migration history —
-- so no column-type change is required to start assigning 'HR' to a user.
-- This migration only (a) assigns HR to any accounts you list below and
-- (b) adds an integrity constraint so the column can't silently drift from
-- the app's role set (lib/rbac/access-control.ts) going forward.
--
-- Prerequisite: run 20260827_rbac_role_relabel.sql first (or otherwise make
-- sure every row already has role IN ('ADMIN','BOSS','PR','PROJECT','HR')),
-- since the constraint below is added NOT VALID and only checked for new/
-- updated rows until you explicitly VALIDATE it.

-- 1) Assign the HR role — edit this email list to your actual HR accounts.
-- update app_user_profiles
-- set role = 'HR'
-- where email in ('hr.person@yourcompany.com');

-- 2) Guard the column against typos/future drift. Added NOT VALID so it
--    doesn't fail on existing rows immediately; new writes are checked from
--    here on.
alter table public.app_user_profiles
  add constraint app_user_profiles_role_check
  check (role in ('ADMIN', 'BOSS', 'PR', 'PROJECT', 'HR'))
  not valid;

-- 3) Once you've confirmed every existing row is one of the five roles
--    above (see the review query in 20260827), lock it in:
-- alter table public.app_user_profiles validate constraint app_user_profiles_role_check;
