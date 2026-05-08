-- Uzupełnienie pól subskrypcji Stripe (webhook); bez usuwania danych.
alter table public.business_profiles
  add column if not exists stripe_subscription_trial_ends_at timestamptz;

alter table public.business_profiles
  add column if not exists stripe_subscription_cancel_at_period_end boolean default false;

alter table public.business_profiles
  add column if not exists stripe_subscription_synced_at timestamptz;

comment on column public.business_profiles.stripe_subscription_trial_ends_at is 'Koniec triala Stripe (UTC), z trial_end subskrypcji.';
comment on column public.business_profiles.stripe_subscription_cancel_at_period_end is 'cancel_at_period_end z obiektu Stripe Subscription.';
comment on column public.business_profiles.stripe_subscription_synced_at is 'Ostatnia synchronizacja z webhooka Stripe (UTC).';
