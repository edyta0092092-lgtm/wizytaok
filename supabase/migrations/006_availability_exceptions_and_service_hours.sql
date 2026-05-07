-- Wyjątki kalendarza (dzień wolny / specjalne godziny) oraz reguły godzin per usługa.
-- Uwaga: plik 004 jest zajęty przez bookings; numeracja 006.

alter table public.services
add column if not exists uses_default_availability boolean not null default true;

create table if not exists public.availability_exceptions (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  exception_date date not null,
  is_closed boolean not null default true,
  start_time time null,
  end_time time null,
  reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_exceptions_times_chk check (
    (
      is_closed = true
      and start_time is null
      and end_time is null
    )
    or (
      is_closed = false
      and start_time is not null
      and end_time is not null
      and end_time > start_time
    )
  )
);

create unique index if not exists availability_exceptions_business_date_uid on public.availability_exceptions (
  business_id,
  exception_date
);

create index if not exists availability_exceptions_business_id_idx on public.availability_exceptions (business_id);

create trigger availability_exceptions_set_updated_at
before update on public.availability_exceptions for each row
execute function public.set_updated_at ();

alter table public.availability_exceptions enable row level security;

drop policy if exists "availability_exceptions_select_public" on public.availability_exceptions;

create policy "availability_exceptions_select_public" on public.availability_exceptions for select to anon, authenticated using (true);

drop policy if exists "availability_exceptions_insert_own" on public.availability_exceptions;

create policy "availability_exceptions_insert_own" on public.availability_exceptions for insert to authenticated with check (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

drop policy if exists "availability_exceptions_update_own" on public.availability_exceptions;

create policy "availability_exceptions_update_own" on public.availability_exceptions for update to authenticated using (
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

drop policy if exists "availability_exceptions_delete_own" on public.availability_exceptions;

create policy "availability_exceptions_delete_own" on public.availability_exceptions for delete to authenticated using (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

create table if not exists public.service_availability_rules (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  weekday integer not null,
  is_available boolean not null default true,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_availability_rules_weekday_chk check (
    weekday >= 0
    and weekday <= 6
  ),
  constraint service_availability_rules_time_order_chk check (end_time > start_time)
);

create unique index if not exists service_availability_rules_business_service_weekday_uid on public.service_availability_rules (
  business_id,
  service_id,
  weekday
);

create index if not exists service_availability_rules_service_id_idx on public.service_availability_rules (service_id);

create trigger service_availability_rules_set_updated_at
before update on public.service_availability_rules for each row
execute function public.set_updated_at ();

alter table public.service_availability_rules enable row level security;

drop policy if exists "service_availability_rules_select_public" on public.service_availability_rules;

create policy "service_availability_rules_select_public" on public.service_availability_rules for select to anon, authenticated using (true);

drop policy if exists "service_availability_rules_insert_own" on public.service_availability_rules;

create policy "service_availability_rules_insert_own" on public.service_availability_rules for insert to authenticated with check (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

drop policy if exists "service_availability_rules_update_own" on public.service_availability_rules;

create policy "service_availability_rules_update_own" on public.service_availability_rules for update to authenticated using (
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

drop policy if exists "service_availability_rules_delete_own" on public.service_availability_rules;

create policy "service_availability_rules_delete_own" on public.service_availability_rules for delete to authenticated using (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

-- Publiczny katalog usług: pole uses_default_availability dla bookingu.
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
  inner join public.business_profiles bp on bp.id = s.business_id
  where bp.slug = lower(trim(p_slug))
    and s.is_active = true
  order by s.sort_order asc, s.created_at asc;
$$;

revoke all on function public.get_active_services_by_business_slug (text) from public;

grant execute on function public.get_active_services_by_business_slug (text) to anon, authenticated;
