-- RBAC relabel: old department roles -> new enterprise role set.
--
-- The app now recognises exactly: ADMIN, BOSS, PR, PROJECT.
-- Any other value (including the retired DOC_CON / COST_CONTROL / FINANCE /
-- STAFF) is treated by the app as "no page access" (safe default-deny) until
-- relabelled here.
--
-- Mapping applied:
--   ADMIN         -> ADMIN     (unchanged, full access)
--   FINANCE       -> BOSS      (Finance/P&L pages now live under Boss)
--   COST_CONTROL  -> BOSS      (Cost Control page now lives under Boss)
--   DOC_CON       -> PROJECT   (Doc Con page now lives under Project)
--   STAFF / NULL / anything else -> left AS-IS, review manually below.
--
-- Run the SELECT first to see who's affected, then the UPDATE, then the
-- final SELECT to confirm every account has a valid role before shipping.

-- 1) Preview affected rows
select id, email, role
from app_user_profiles
where role in ('FINANCE', 'COST_CONTROL', 'DOC_CON');

-- 2) Relabel
update app_user_profiles
set role = 'BOSS'
where role in ('FINANCE', 'COST_CONTROL');

update app_user_profiles
set role = 'PROJECT'
where role = 'DOC_CON';

-- 3) Anyone left outside the new role set needs a manual decision
--    (assign ADMIN / BOSS / PR / PROJECT by hand) — they currently have
--    zero page access under the new RBAC matrix.
select id, email, role
from app_user_profiles
where role not in ('ADMIN', 'BOSS', 'PR', 'PROJECT');
