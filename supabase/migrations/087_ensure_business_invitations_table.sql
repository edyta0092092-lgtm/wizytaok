-- Uruchom w SQL Editor projektu z NEXT_PUBLIC_SUPABASE_URL aplikacji.
-- Błąd 086 „relation business_invitations does not exist” = brak tabeli w tej bazie.
-- Błąd „business_members.staff_member_id does not exist” → uruchom też 088.
-- Ten plik tworzy tabelę (jeśli brakuje), potem normalizuje e-maile jak 086.

alter table public.business_members
  add column if not exists staff_member_id uuid references public.staff_members (id) on delete set null;

create index if not exists business_members_staff_member_id_idx
  on public.business_members (staff_member_id);

create table if not exists public.business_invitations (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  email text not null,
  role text not null default 'staff',
  token uuid not null unique default gen_random_uuid (),
  status text not null default 'pending',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now (),
  accepted_at timestamptz,
  unique (business_id, email),
  constraint business_invitations_role_chk check (role in ('admin', 'staff')),
  constraint business_invitations_status_chk check (status in ('pending', 'accepted', 'cancelled'))
);

alter table public.business_invitations
  add column if not exists staff_member_id uuid references public.staff_members (id) on delete set null;

create index if not exists business_invitations_business_id_idx
  on public.business_invitations (business_id);

create index if not exists business_invitations_token_idx
  on public.business_invitations (token);

create index if not exists business_invitations_staff_member_id_idx
  on public.business_invitations (staff_member_id);

alter table public.business_invitations enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_business_settings_admin'
  ) then
    drop policy if exists "business_invitations_select" on public.business_invitations;
    create policy "business_invitations_select" on public.business_invitations
      for select to authenticated
      using (public.is_business_settings_admin (business_id));

    drop policy if exists "business_invitations_insert" on public.business_invitations;
    create policy "business_invitations_insert" on public.business_invitations
      for insert to authenticated
      with check (public.is_business_settings_admin (business_id));

    drop policy if exists "business_invitations_update" on public.business_invitations;
    create policy "business_invitations_update" on public.business_invitations
      for update to authenticated
      using (public.is_business_settings_admin (business_id))
      with check (public.is_business_settings_admin (business_id));

    drop policy if exists "business_invitations_delete" on public.business_invitations;
    create policy "business_invitations_delete" on public.business_invitations
      for delete to authenticated
      using (public.is_business_settings_admin (business_id));
  end if;
end;
$$;

-- === poniżej: treść migracji 086 (bezpieczna po utworzeniu tabeli) ===

update public.business_invitations
set email = lower(trim(email))
where email is distinct from lower(trim(email));

with ranked as (
  select
    id,
    row_number() over (
      partition by business_id, lower(trim(email))
      order by
        case status when 'pending' then 0 when 'accepted' then 1 else 2 end,
        created_at desc
    ) as rn
  from public.business_invitations
)
update public.business_invitations i
set status = 'cancelled'
from ranked r
where i.id = r.id
  and r.rn > 1;

alter table public.business_invitations
  drop constraint if exists business_invitations_business_id_email_key;

create unique index if not exists business_invitations_business_id_email_lower_uniq
  on public.business_invitations (business_id, lower(trim(email)));
