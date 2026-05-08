-- Kanoniczne pola subskrypcji (prefiks subscription_) + istniejące stripe_* z wcześniejszych migracji.
-- Webhook zapisuje oba zestawy dla zgodności z UI i starymi zapytaniami.

alter table public.business_profiles
  add column if not exists subscription_status text;

alter table public.business_profiles
  add column if not exists subscription_trial_ends_at timestamptz;

alter table public.business_profiles
  add column if not exists subscription_current_period_end timestamptz;

alter table public.business_profiles
  add column if not exists subscription_cancel_at_period_end boolean default false;

alter table public.business_profiles
  add column if not exists subscription_updated_at timestamptz;

comment on column public.business_profiles.subscription_status is 'Status subskrypcji Stripe (trialing, active, …); lustrzane do stripe_subscription_status.';
comment on column public.business_profiles.subscription_updated_at is 'Ostatnia aktualizacja danych subskrypcji z webhooka Stripe (UTC).';
