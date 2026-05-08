-- Potwierdzenia Wizyt — szkic schematu pod Supabase (RLS do dopracowania po wdrożeniu auth)
-- Uruchom w SQL Editor lub przez supabase db push po podłączeniu projektu.

-- Rozszerzenia
create extension if not exists "pgcrypto";

-- Enumy domenowe
create type public.appointment_status as enum (
  'pending',
  'confirmed',
  'change_requested',
  'cancelled',
  'completed',
  'no_show'
);

create type public.message_template_type as enum (
  'reminder',
  'confirmation',
  'reschedule',
  'followup_noshow'
);

create type public.message_template_channel as enum ('sms', 'email');

create type public.message_template_status as enum ('active', 'draft');

create type public.business_reminder_channel as enum ('sms', 'email', 'both');

create type public.business_access_status as enum (
  'trial',
  'active',
  'suspended',
  'cancelled'
);

create type public.payment_type as enum ('deposit', 'full', 'adjustment');

create type public.payment_status as enum (
  'pending',
  'requires_action',
  'succeeded',
  'failed',
  'canceled'
);

-- Firmy / kontekst multi-tenant (1:1 z właścicielem z auth.users)
create table public.businesses (
  id uuid primary key default gen_random_uuid (),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  business_name text not null,
  owner_name text,
  phone text,
  reminder_channel public.business_reminder_channel not null default 'both',
  default_reminder_hours integer not null default 24 check (
    default_reminder_hours in (2, 6, 12, 24, 48)
  ),
  access_status public.business_access_status not null default 'trial',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_owner_unique unique (owner_user_id)
);

create index businesses_owner_user_id_idx on public.businesses (owner_user_id);

-- Klienci
create table public.clients (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null default '',
  notes text,
  no_show_count integer not null default 0 check (no_show_count >= 0),
  confirmed_count integer not null default 0 check (confirmed_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_business_id_idx on public.clients (business_id);

-- Wizyty
create table public.appointments (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  service_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.appointment_status not null default 'pending',
  notes text,
  reminder_sent_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_business_id_idx on public.appointments (business_id);
create index appointments_client_id_idx on public.appointments (client_id);
create index appointments_starts_at_idx on public.appointments (starts_at);

-- Szablony wiadomości
create table public.message_templates (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  type public.message_template_type not null,
  channel public.message_template_channel not null,
  title text not null,
  content text not null,
  status public.message_template_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index message_templates_business_id_idx on public.message_templates (business_id);

-- Płatności / depozyty (placeholder pod Stripe)
create table public.payments (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  type public.payment_type not null default 'deposit',
  amount numeric(12, 2) not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_business_id_idx on public.payments (business_id);
create index payments_appointment_id_idx on public.payments (appointment_id);

-- updated_at trigger (prosty)
create or replace function public.set_updated_at () returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger businesses_set_updated_at before update on public.businesses
for each row execute procedure public.set_updated_at ();

create trigger clients_set_updated_at before update on public.clients
for each row execute procedure public.set_updated_at ();

create trigger appointments_set_updated_at before update on public.appointments
for each row execute procedure public.set_updated_at ();

create trigger message_templates_set_updated_at before update on public.message_templates
for each row execute procedure public.set_updated_at ();

create trigger payments_set_updated_at before update on public.payments
for each row execute procedure public.set_updated_at ();

-- RLS (szkielet — włącz polityki po testach auth)
alter table public.businesses enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.message_templates enable row level security;
alter table public.payments enable row level security;

-- Przykładowe polityki: właściciel widzi tylko swoją firmę i powiązane rekordy
create policy "businesses_select_own" on public.businesses for select using (auth.uid () = owner_user_id);

create policy "businesses_update_own" on public.businesses for update using (auth.uid () = owner_user_id);

create policy "businesses_insert_own" on public.businesses for insert with check (auth.uid () = owner_user_id);

create policy "clients_rw_own_business" on public.clients for all to authenticated using (
  business_id in (select id from public.businesses where owner_user_id = auth.uid ())
)
with check (
  business_id in (select id from public.businesses where owner_user_id = auth.uid ())
);

create policy "appointments_rw_own_business" on public.appointments for all to authenticated using (
  business_id in (select id from public.businesses where owner_user_id = auth.uid ())
)
with check (
  business_id in (select id from public.businesses where owner_user_id = auth.uid ())
);

create policy "templates_rw_own_business" on public.message_templates for all to authenticated using (
  business_id in (select id from public.businesses where owner_user_id = auth.uid ())
)
with check (
  business_id in (select id from public.businesses where owner_user_id = auth.uid ())
);

create policy "payments_rw_own_business" on public.payments for all to authenticated using (
  business_id in (select id from public.businesses where owner_user_id = auth.uid ())
)
with check (
  business_id in (select id from public.businesses where owner_user_id = auth.uid ())
);

-- ---------------------------------------------------------------------------
-- Profil firmy SaaS (Supabase Auth) + publiczny slug /book/[slug]
-- ---------------------------------------------------------------------------
create table public.business_profiles (
  id uuid primary key default gen_random_uuid (),
  owner_id uuid not null references auth.users (id) on delete cascade,
  business_name text not null,
  slug text not null,
  owner_name text,
  owner_last_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_profiles_slug_lower_chk check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint business_profiles_owner_unique unique (owner_id)
);

create unique index business_profiles_slug_unique_idx on public.business_profiles (slug);

create index business_profiles_owner_id_idx on public.business_profiles (owner_id);

create trigger business_profiles_set_updated_at before update on public.business_profiles
for each row execute procedure public.set_updated_at ();

alter table public.business_profiles enable row level security;

create policy "business_profiles_select_own" on public.business_profiles for select to authenticated using (auth.uid () = owner_id);

create policy "business_profiles_insert_own" on public.business_profiles for insert to authenticated with check (auth.uid () = owner_id);

create policy "business_profiles_update_own" on public.business_profiles for update to authenticated using (auth.uid () = owner_id)
with check (auth.uid () = owner_id);

create policy "business_profiles_delete_own" on public.business_profiles for delete to authenticated using (auth.uid () = owner_id);

create or replace function public.get_business_profile_by_slug (p_slug text)
returns table (
  id uuid,
  business_name text,
  slug text,
  phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select bp.id, bp.business_name, bp.slug, bp.phone
  from public.business_profiles bp
  where bp.slug = lower(trim(p_slug))
  limit 1;
$$;

revoke all on function public.get_business_profile_by_slug (text) from public;
grant execute on function public.get_business_profile_by_slug (text) to anon, authenticated;

create or replace function public.is_business_slug_available (p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.business_profiles bp
    where bp.slug = lower(trim(p_slug))
  );
$$;

revoke all on function public.is_business_slug_available (text) from public;
grant execute on function public.is_business_slug_available (text) to anon, authenticated;

-- Fallback publicznego katalogu usług po business_id (np. gdy funkcja po slugu jest niedostępna).
-- Szczegóły: migrations/018_fix_public_booking_profile_rpc_slug_only.sql
create or replace function public.get_active_services_by_business_id (p_business_id uuid)
returns table (
  id uuid,
  business_id uuid,
  name text,
  description text,
  duration_minutes integer,
  price numeric,
  currency text,
  is_active boolean,
  sort_order integer,
  uses_default_availability boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.business_id,
    s.name,
    s.description,
    s.duration_minutes,
    s.price,
    s.currency,
    s.is_active,
    s.sort_order,
    s.uses_default_availability
  from public.services s
  where s.business_id = p_business_id
    and s.is_active = true
  order by s.sort_order asc, s.created_at asc;
$$;

revoke all on function public.get_active_services_by_business_id (uuid) from public;
grant execute on function public.get_active_services_by_business_id (uuid) to anon, authenticated;
