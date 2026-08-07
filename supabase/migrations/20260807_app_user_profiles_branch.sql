alter table public.app_user_profiles add column if not exists branch text;
update public.app_user_profiles set branch = 'cikarang' where email = 'lidya.ivory@tribangun-up.com';
