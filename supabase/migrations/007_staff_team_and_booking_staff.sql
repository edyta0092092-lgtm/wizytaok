-- Zespol (staff) + rozszerzenie rezerwacji o staff_id/staff_name.
-- Numeracja: 005 jest juz zajete, dlatego kolejny numer.

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_members_business_id_idx on public.staff_members (business_id);
create index if not exists staff_members_business_active_idx on public.staff_members (business_id, is_active);

alter table public.staff_members enable row level security;

drop policy if exists "staff_members_select_public_active" on public.staff_members;
create policy "staff_members_select_public_active" on public.staff_members
for select to anon, authenticated
using (is_active = true);

drop policy if exists "staff_members_insert_own" on public.staff_members;
create policy "staff_members_insert_own" on public.staff_members
for insert to authenticated
with check (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

drop policy if exists "staff_members_update_own" on public.staff_members;
create policy "staff_members_update_own" on public.staff_members
for update to authenticated
using (
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

drop policy if exists "staff_members_delete_own" on public.staff_members;
create policy "staff_members_delete_own" on public.staff_members
for delete to authenticated
using (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

create table if not exists public.staff_services (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (business_id, staff_id, service_id)
);

create index if not exists staff_services_business_id_idx on public.staff_services (business_id);
create index if not exists staff_services_service_id_idx on public.staff_services (service_id);
create index if not exists staff_services_staff_id_idx on public.staff_services (staff_id);

alter table public.staff_services enable row level security;

drop policy if exists "staff_services_select_public" on public.staff_services;
create policy "staff_services_select_public" on public.staff_services
for select to anon, authenticated
using (true);

drop policy if exists "staff_services_insert_own" on public.staff_services;
create policy "staff_services_insert_own" on public.staff_services
for insert to authenticated
with check (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

drop policy if exists "staff_services_update_own" on public.staff_services;
create policy "staff_services_update_own" on public.staff_services
for update to authenticated
using (
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

drop policy if exists "staff_services_delete_own" on public.staff_services;
create policy "staff_services_delete_own" on public.staff_services
for delete to authenticated
using (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

create table if not exists public.staff_availability_rules (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  weekday integer not null,
  is_available boolean not null default true,
  start_time time not null default '09:00',
  end_time time not null default '17:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_availability_rules_weekday_chk check (weekday between 0 and 6),
  constraint staff_availability_rules_time_chk check (end_time > start_time),
  unique (business_id, staff_id, weekday)
);

create index if not exists staff_availability_rules_business_id_idx on public.staff_availability_rules (business_id);
create index if not exists staff_availability_rules_staff_id_idx on public.staff_availability_rules (staff_id);

alter table public.staff_availability_rules enable row level security;

drop policy if exists "staff_availability_rules_select_public" on public.staff_availability_rules;
create policy "staff_availability_rules_select_public" on public.staff_availability_rules
for select to anon, authenticated
using (true);

drop policy if exists "staff_availability_rules_insert_own" on public.staff_availability_rules;
create policy "staff_availability_rules_insert_own" on public.staff_availability_rules
for insert to authenticated
with check (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

drop policy if exists "staff_availability_rules_update_own" on public.staff_availability_rules;
create policy "staff_availability_rules_update_own" on public.staff_availability_rules
for update to authenticated
using (
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

drop policy if exists "staff_availability_rules_delete_own" on public.staff_availability_rules;
create policy "staff_availability_rules_delete_own" on public.staff_availability_rules
for delete to authenticated
using (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

create table if not exists public.staff_availability_exceptions (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  exception_date date not null,
  is_unavailable boolean not null default true,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_availability_exceptions_time_chk check (
    (
      is_unavailable = true
      and start_time is null
      and end_time is null
    )
    or (
      is_unavailable = false
      and start_time is not null
      and end_time is not null
      and end_time > start_time
    )
  ),
  unique (business_id, staff_id, exception_date)
);

create index if not exists staff_availability_exceptions_business_id_idx on public.staff_availability_exceptions (business_id);
create index if not exists staff_availability_exceptions_staff_id_idx on public.staff_availability_exceptions (staff_id);

alter table public.staff_availability_exceptions enable row level security;

drop policy if exists "staff_availability_exceptions_select_public" on public.staff_availability_exceptions;
create policy "staff_availability_exceptions_select_public" on public.staff_availability_exceptions
for select to anon, authenticated
using (true);

drop policy if exists "staff_availability_exceptions_insert_own" on public.staff_availability_exceptions;
create policy "staff_availability_exceptions_insert_own" on public.staff_availability_exceptions
for insert to authenticated
with check (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

drop policy if exists "staff_availability_exceptions_update_own" on public.staff_availability_exceptions;
create policy "staff_availability_exceptions_update_own" on public.staff_availability_exceptions
for update to authenticated
using (
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

drop policy if exists "staff_availability_exceptions_delete_own" on public.staff_availability_exceptions;
create policy "staff_availability_exceptions_delete_own" on public.staff_availability_exceptions
for delete to authenticated
using (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

alter table public.bookings
add column if not exists staff_id uuid references public.staff_members (id) on delete set null,
add column if not exists staff_name text;

create index if not exists bookings_staff_id_idx on public.bookings (staff_id);
create unique index if not exists bookings_unique_active_staff_slot
on public.bookings (business_id, staff_id, appointment_date, appointment_time)
where staff_id is not null
and status in (
  'booked',
  'pending',
  'confirmed',
  'reschedule_requested',
  'business_reschedule_proposed'
);
