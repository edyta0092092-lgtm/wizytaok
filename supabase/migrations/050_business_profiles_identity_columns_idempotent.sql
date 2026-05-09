-- Idempotent: kolumny tożsamości / trial (na wypadek bazy bez wcześniejszych migracji).
-- Bez DROP/TRUNCATE/DELETE.

alter table public.business_profiles
add column if not exists account_type text;

alter table public.business_profiles
add column if not exists company_tax_id text;

alter table public.business_profiles
add column if not exists company_tax_id_normalized text;

alter table public.business_profiles
add column if not exists contact_phone text;

alter table public.business_profiles
add column if not exists contact_phone_normalized text;

alter table public.business_profiles
add column if not exists trial_started_at timestamptz;

alter table public.business_profiles
add column if not exists trial_used_at timestamptz;

alter table public.business_profiles
add column if not exists stripe_payment_method_fingerprint text;

create index if not exists business_profiles_company_tax_id_normalized_idx
on public.business_profiles (company_tax_id_normalized);

create index if not exists business_profiles_contact_phone_normalized_idx
on public.business_profiles (contact_phone_normalized);

create index if not exists business_profiles_stripe_payment_method_fingerprint_idx
on public.business_profiles (stripe_payment_method_fingerprint);
