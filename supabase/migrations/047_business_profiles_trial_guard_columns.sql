alter table public.business_profiles
add column if not exists trial_started_at timestamptz null;

alter table public.business_profiles
add column if not exists trial_used_at timestamptz null;
