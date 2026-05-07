-- Usługi firmy (1:N z business_profiles). RLS: właściciel zarządza swoimi rekordami.
-- Publiczny odczyt aktywnych usług po slug przez funkcję security definer (anon).

create table if not exists public.services (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  name text not null,
  description text not null default '',
  duration_minutes integer not null default 0,
  price numeric not null default 0,
  currency text not null default 'PLN',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists services_business_id_idx on public.services (business_id);

create index if not exists services_business_active_idx on public.services (business_id, is_active);

create trigger services_set_updated_at
before update on public.services for each row
execute function public.set_updated_at ();

alter table public.services enable row level security;

drop policy if exists "services_select_own" on public.services;

create policy "services_select_own" on public.services for select to authenticated using (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

drop policy if exists "services_insert_own" on public.services;

create policy "services_insert_own" on public.services for insert to authenticated with check (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

drop policy if exists "services_update_own" on public.services;

create policy "services_update_own" on public.services for update to authenticated using (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
)
with check (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

drop policy if exists "services_delete_own" on public.services;

create policy "services_delete_own" on public.services for delete to authenticated using (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

-- Publiczna lista aktywnych usług dla rezerwacji po slug firmy (bez SELECT anon na całej tabeli).
create or replace function public.get_active_services_by_business_slug (p_slug text)
returns table (
  id uuid,
  business_id uuid,
  name text,
  description text,
  duration_minutes integer,
  price numeric,
  currency text,
  is_active boolean,
  sort_order integer
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
    s.sort_order
  from public.services s
  inner join public.business_profiles bp on bp.id = s.business_id
  where bp.slug = lower(trim(p_slug))
    and s.is_active = true
  order by s.sort_order asc, s.created_at asc;
$$;

revoke all on function public.get_active_services_by_business_slug (text) from public;

grant execute on function public.get_active_services_by_business_slug (text) to anon, authenticated;
