-- Program poleceń: kody, atrybucja rejestracji, przygotowane nagrody (ręczne naliczenie).

create table if not exists public.business_referral_codes (
  business_id uuid primary key references public.business_profiles (id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  constraint business_referral_codes_code_format check (code ~ '^[A-Z0-9]{6,12}$'),
  constraint business_referral_codes_code_unique unique (code)
);

create index if not exists business_referral_codes_code_lower_idx
  on public.business_referral_codes (lower(code));

comment on table public.business_referral_codes is
  'Unikalny kod polecający przypisany do firmy polecającej.';

create table if not exists public.business_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_business_id uuid not null references public.business_profiles (id) on delete cascade,
  referred_business_id uuid not null references public.business_profiles (id) on delete cascade,
  referred_user_id uuid not null references auth.users (id) on delete cascade,
  referral_code text not null,
  stage text not null default 'registered'
    check (stage in ('registered', 'trial_activated', 'paying')),
  registered_at timestamptz not null default now(),
  trial_activated_at timestamptz null,
  paying_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_referrals_referred_business_unique unique (referred_business_id),
  constraint business_referrals_no_self_referral check (referrer_business_id <> referred_business_id)
);

create index if not exists business_referrals_referrer_idx
  on public.business_referrals (referrer_business_id, registered_at desc);

create index if not exists business_referrals_referred_user_idx
  on public.business_referrals (referred_user_id);

comment on table public.business_referrals is
  'Pojedyncza atrybucja: która firma poleciła nową rejestrację.';

create table if not exists public.business_referral_reward_grants (
  id uuid primary key default gen_random_uuid(),
  referrer_business_id uuid not null references public.business_profiles (id) on delete cascade,
  tier_code text not null,
  required_referrals int not null check (required_referrals > 0),
  free_months int not null check (free_months > 0),
  status text not null default 'eligible'
    check (status in ('eligible', 'granted', 'void')),
  eligible_at timestamptz not null default now(),
  granted_at timestamptz null,
  granted_by_user_id uuid null references auth.users (id) on delete set null,
  notes text null,
  created_at timestamptz not null default now(),
  constraint business_referral_reward_grants_tier_unique unique (referrer_business_id, tier_code)
);

create index if not exists business_referral_reward_grants_referrer_idx
  on public.business_referral_reward_grants (referrer_business_id, created_at desc);

comment on table public.business_referral_reward_grants is
  'Przygotowane nagrody za polecenia — status granted ustawia się ręcznie (bez Stripe w MVP).';

alter table public.business_referral_codes enable row level security;
alter table public.business_referrals enable row level security;
alter table public.business_referral_reward_grants enable row level security;

drop policy if exists business_referral_codes_select_member on public.business_referral_codes;

create policy business_referral_codes_select_member
  on public.business_referral_codes
  for select
  to authenticated
  using (public.is_business_member_active (business_id));

drop policy if exists business_referrals_select_referrer on public.business_referrals;

create policy business_referrals_select_referrer
  on public.business_referrals
  for select
  to authenticated
  using (public.is_business_member_active (referrer_business_id));

drop policy if exists business_referral_reward_grants_select_referrer on public.business_referral_reward_grants;

create policy business_referral_reward_grants_select_referrer
  on public.business_referral_reward_grants
  for select
  to authenticated
  using (public.is_business_settings_admin (referrer_business_id));

-- INSERT/UPDATE/DELETE przez service role (API aplikacji).

grant select on public.business_referral_codes to authenticated;
grant select on public.business_referrals to authenticated;
grant select on public.business_referral_reward_grants to authenticated;
