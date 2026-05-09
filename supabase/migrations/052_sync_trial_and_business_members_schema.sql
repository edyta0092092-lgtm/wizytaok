-- Idempotent sync dla trial/business_members po ręcznych poprawkach w Supabase.
-- Bez DROP/TRUNCATE/DELETE.

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff',
  display_name text,
  email text,
  phone text,
  is_active boolean not null default true,
  invited_by uuid references auth.users (id) on delete set null,
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  unique (business_id, user_id),
  constraint business_members_role_chk check (role in ('admin', 'staff'))
);

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

alter table public.business_profiles
add column if not exists owner_first_name text;

alter table public.business_profiles
add column if not exists owner_last_name text;

alter table public.business_members
add column if not exists display_name text;

alter table public.business_members
add column if not exists email text;

alter table public.business_members
add column if not exists phone text;

alter table public.business_members
add column if not exists invited_at timestamptz;

alter table public.business_members
add column if not exists joined_at timestamptz;

create index if not exists business_profiles_company_tax_id_normalized_idx
on public.business_profiles (company_tax_id_normalized);

create index if not exists business_profiles_contact_phone_normalized_idx
on public.business_profiles (contact_phone_normalized);

create index if not exists business_profiles_stripe_payment_method_fingerprint_idx
on public.business_profiles (stripe_payment_method_fingerprint);

create index if not exists business_members_business_id_idx
on public.business_members (business_id);

create index if not exists business_members_user_id_idx
on public.business_members (user_id);
