-- Pola subskrypcji Stripe (test / produkcja — aktualizowane przez webhook, bez usuwania danych).
alter table public.business_profiles
  add column if not exists stripe_customer_id text;

alter table public.business_profiles
  add column if not exists stripe_subscription_id text;

alter table public.business_profiles
  add column if not exists stripe_subscription_status text;

alter table public.business_profiles
  add column if not exists stripe_subscription_current_period_end timestamptz;

create index if not exists business_profiles_stripe_customer_id_idx on public.business_profiles (stripe_customer_id)
where stripe_customer_id is not null;

create index if not exists business_profiles_stripe_subscription_id_idx on public.business_profiles (stripe_subscription_id)
where stripe_subscription_id is not null;

comment on column public.business_profiles.stripe_customer_id is 'Stripe Customer id (cus_...); uzupełniane przy Checkout / webhook.';
comment on column public.business_profiles.stripe_subscription_id is 'Stripe Subscription id (sub_...).';
comment on column public.business_profiles.stripe_subscription_status is 'Surowy status Stripe (trialing, active, past_due, canceled, ...).';
comment on column public.business_profiles.stripe_subscription_current_period_end is 'Koniec bieżącego okresu rozliczeniowego (UTC).';
