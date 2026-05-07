-- Reguły dostępności (1 wiersz na business_id + weekday). RLS: właściciel edytuje; publiczny odczyt dla rezerwacji.

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  weekday integer not null,
  is_open boolean not null default true,
  start_time time not null default time '09:00',
  end_time time not null default time '17:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_rules_weekday_chk check (
    weekday >= 0
    and weekday <= 6
  )
);

create unique index if not exists availability_rules_business_weekday_uid on public.availability_rules (
  business_id,
  weekday
);

create index if not exists availability_rules_business_id_idx on public.availability_rules (business_id);

create trigger availability_rules_set_updated_at
before update on public.availability_rules for each row
execute function public.set_updated_at ();

alter table public.availability_rules enable row level security;

drop policy if exists "availability_rules_select_public" on public.availability_rules;

create policy "availability_rules_select_public" on public.availability_rules for select to anon, authenticated using (true);

drop policy if exists "availability_rules_insert_own" on public.availability_rules;

create policy "availability_rules_insert_own" on public.availability_rules for insert to authenticated with check (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

drop policy if exists "availability_rules_update_own" on public.availability_rules;

create policy "availability_rules_update_own" on public.availability_rules for update to authenticated using (
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

drop policy if exists "availability_rules_delete_own" on public.availability_rules;

create policy "availability_rules_delete_own" on public.availability_rules for delete to authenticated using (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);
