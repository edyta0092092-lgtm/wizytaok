-- Role w firmie (admin/staff), zaproszenia oraz RLS oparte o business_members.
-- Funkcje SECURITY DEFINER omijają RLS i unikają rekursji w politykach.

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff',
  display_name text,
  email text,
  is_active boolean not null default true,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  unique (business_id, user_id),
  constraint business_members_role_chk check (role in ('admin', 'staff'))
);

create index if not exists business_members_user_id_idx on public.business_members (user_id);

create index if not exists business_members_business_id_idx on public.business_members (business_id);

create trigger business_members_set_updated_at
before update on public.business_members for each row
execute function public.set_updated_at ();

alter table public.business_members enable row level security;

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

create index if not exists business_invitations_business_id_idx on public.business_invitations (business_id);

create index if not exists business_invitations_token_idx on public.business_invitations (token);

alter table public.business_invitations enable row level security;

-- Helpery (SECURITY DEFINER, STABLE)
create or replace function public.is_business_owner (p_business_id uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_profiles bp
    where bp.id = p_business_id
      and bp.owner_id = auth.uid ()
  );
$$;

create or replace function public.is_business_member_active (p_business_id uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_business_owner (p_business_id)
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid ()
      and bm.is_active = true
  );
$$;

create or replace function public.is_business_settings_admin (p_business_id uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_business_owner (p_business_id)
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid ()
      and bm.role = 'admin'
      and bm.is_active = true
  );
$$;

revoke all on function public.is_business_owner (uuid) from public;

grant execute on function public.is_business_owner (uuid) to authenticated;

revoke all on function public.is_business_member_active (uuid) from public;

grant execute on function public.is_business_member_active (uuid) to authenticated;

revoke all on function public.is_business_settings_admin (uuid) from public;

grant execute on function public.is_business_settings_admin (uuid) to authenticated;

-- Właściciel firmy dostaje rekord admin w business_members (idempotentnie).
create or replace function public.ensure_owner_membership () returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid ();
  v_bid uuid;
  v_email text;
  v_display text;
begin
  if v_uid is null then
    return;
  end if;
  select bp.id, u.email, coalesce(nullif(trim(bp.owner_name), ''), bp.business_name)
    into v_bid, v_email, v_display
  from public.business_profiles bp
  join auth.users u on u.id = bp.owner_id
  where bp.owner_id = v_uid
  limit 1;
  if v_bid is null then
    return;
  end if;
  insert into public.business_members (
    business_id,
    user_id,
    role,
    display_name,
    email,
    is_active
  )
  values (
    v_bid,
    v_uid,
    'admin',
    v_display,
    v_email,
    true
  )
  on conflict (business_id, user_id) do update
  set
    role = 'admin',
    is_active = true,
    email = excluded.email,
    display_name = coalesce(public.business_members.display_name, excluded.display_name),
    updated_at = now ();
end;
$$;

revoke all on function public.ensure_owner_membership () from public;

grant execute on function public.ensure_owner_membership () to authenticated;

-- Aktualizacja wyświetlanej nazwy członka (tylko własny rekord).
create or replace function public.set_business_member_display_name (p_business_id uuid, p_display_name text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid () is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_business_member_active (p_business_id) then
    raise exception 'forbidden';
  end if;
  update public.business_members bm
  set
    display_name = nullif(trim(p_display_name), ''),
    updated_at = now ()
  where bm.business_id = p_business_id
    and bm.user_id = auth.uid ();
end;
$$;

revoke all on function public.set_business_member_display_name (uuid, text) from public;

grant execute on function public.set_business_member_display_name (uuid, text) to authenticated;

-- Publiczny podgląd zaproszenia (tylko pending).
create or replace function public.get_business_invitation_public (p_token uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inv public.business_invitations%rowtype;
  v_name text;
begin
  select * into v_inv
  from public.business_invitations i
  where i.token = p_token
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_inv.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_pending', 'status', v_inv.status);
  end if;
  select bp.business_name into v_name
  from public.business_profiles bp
  where bp.id = v_inv.business_id
  limit 1;
  return jsonb_build_object(
    'ok',
    true,
    'business_id',
    v_inv.business_id,
    'email',
    v_inv.email,
    'role',
    v_inv.role,
    'business_name',
    coalesce(v_name, ''),
    'status',
    v_inv.status
  );
end;
$$;

revoke all on function public.get_business_invitation_public (uuid) from public;

grant execute on function public.get_business_invitation_public (uuid) to anon, authenticated;

-- Akceptacja zaproszenia przez zalogowanego użytkownika.
create or replace function public.accept_business_invitation (p_token uuid) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_inv public.business_invitations%rowtype;
  v_uid uuid := auth.uid ();
  v_email text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select * into v_inv
  from public.business_invitations i
  where i.token = p_token
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_inv.status = 'accepted' then
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;
  if v_inv.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'cancelled');
  end if;
  if v_inv.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;
  select u.email into v_email
  from auth.users u
  where u.id = v_uid;
  if lower(trim(coalesce(v_email, ''))) <> lower(trim(coalesce(v_inv.email, ''))) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;
  insert into public.business_members (
    business_id,
    user_id,
    role,
    display_name,
    email,
    is_active,
    invited_by
  )
  values (
    v_inv.business_id,
    v_uid,
    v_inv.role,
    null,
    v_inv.email,
    true,
    v_inv.invited_by
  )
  on conflict (business_id, user_id) do update
  set
    role = excluded.role,
    is_active = true,
    email = excluded.email,
    invited_by = coalesce(public.business_members.invited_by, excluded.invited_by),
    updated_at = now ();
  update public.business_invitations i
  set
    status = 'accepted',
    accepted_at = now ()
  where i.id = v_inv.id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.accept_business_invitation (uuid) from public;

grant execute on function public.accept_business_invitation (uuid) to authenticated;

-- business_members RLS
drop policy if exists "business_members_select" on public.business_members;

create policy "business_members_select" on public.business_members for select to authenticated using (
  user_id = auth.uid ()
  or public.is_business_settings_admin (business_id)
);

drop policy if exists "business_members_insert" on public.business_members;

create policy "business_members_insert" on public.business_members for insert to authenticated with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "business_members_update" on public.business_members;

create policy "business_members_update" on public.business_members for update to authenticated using (
  public.is_business_settings_admin (business_id)
)
with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "business_members_delete" on public.business_members;

create policy "business_members_delete" on public.business_members for delete to authenticated using (
  public.is_business_settings_admin (business_id)
);

-- business_invitations RLS
drop policy if exists "business_invitations_select" on public.business_invitations;

create policy "business_invitations_select" on public.business_invitations for select to authenticated using (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "business_invitations_insert" on public.business_invitations;

create policy "business_invitations_insert" on public.business_invitations for insert to authenticated with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "business_invitations_update" on public.business_invitations;

create policy "business_invitations_update" on public.business_invitations for update to authenticated using (
  public.is_business_settings_admin (business_id)
)
with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "business_invitations_delete" on public.business_invitations;

create policy "business_invitations_delete" on public.business_invitations for delete to authenticated using (
  public.is_business_settings_admin (business_id)
);

-- business_profiles: odczyt dla członków firmy
drop policy if exists "business_profiles_select_own" on public.business_profiles;

create policy "business_profiles_select_own" on public.business_profiles for select to authenticated using (
  auth.uid () = owner_id
  or public.is_business_member_active (id)
);

-- bookings
drop policy if exists "bookings_select_own" on public.bookings;

create policy "bookings_select_own" on public.bookings for select to authenticated using (
  public.is_business_member_active (business_id)
);

drop policy if exists "bookings_insert_own" on public.bookings;

create policy "bookings_insert_own" on public.bookings for insert to authenticated with check (
  public.is_business_member_active (business_id)
);

drop policy if exists "bookings_update_own" on public.bookings;

create policy "bookings_update_own" on public.bookings for update to authenticated using (
  public.is_business_member_active (business_id)
)
with check (
  public.is_business_member_active (business_id)
);

drop policy if exists "bookings_delete_own" on public.bookings;

create policy "bookings_delete_own" on public.bookings for delete to authenticated using (
  public.is_business_member_active (business_id)
);

-- services
drop policy if exists "services_select_own" on public.services;

create policy "services_select_own" on public.services for select to authenticated using (
  public.is_business_member_active (business_id)
);

drop policy if exists "services_insert_own" on public.services;

create policy "services_insert_own" on public.services for insert to authenticated with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "services_update_own" on public.services;

create policy "services_update_own" on public.services for update to authenticated using (
  public.is_business_settings_admin (business_id)
)
with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "services_delete_own" on public.services;

create policy "services_delete_own" on public.services for delete to authenticated using (
  public.is_business_settings_admin (business_id)
);

-- availability_rules (mutacje tylko admin)
drop policy if exists "availability_rules_insert_own" on public.availability_rules;

create policy "availability_rules_insert_own" on public.availability_rules for insert to authenticated with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "availability_rules_update_own" on public.availability_rules;

create policy "availability_rules_update_own" on public.availability_rules for update to authenticated using (
  public.is_business_settings_admin (business_id)
)
with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "availability_rules_delete_own" on public.availability_rules;

create policy "availability_rules_delete_own" on public.availability_rules for delete to authenticated using (
  public.is_business_settings_admin (business_id)
);

-- availability_exceptions
drop policy if exists "availability_exceptions_insert_own" on public.availability_exceptions;

create policy "availability_exceptions_insert_own" on public.availability_exceptions for insert to authenticated with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "availability_exceptions_update_own" on public.availability_exceptions;

create policy "availability_exceptions_update_own" on public.availability_exceptions for update to authenticated using (
  public.is_business_settings_admin (business_id)
)
with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "availability_exceptions_delete_own" on public.availability_exceptions;

create policy "availability_exceptions_delete_own" on public.availability_exceptions for delete to authenticated using (
  public.is_business_settings_admin (business_id)
);

-- service_availability_rules
drop policy if exists "service_availability_rules_insert_own" on public.service_availability_rules;

create policy "service_availability_rules_insert_own" on public.service_availability_rules for insert to authenticated with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "service_availability_rules_update_own" on public.service_availability_rules;

create policy "service_availability_rules_update_own" on public.service_availability_rules for update to authenticated using (
  public.is_business_settings_admin (business_id)
)
with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "service_availability_rules_delete_own" on public.service_availability_rules;

create policy "service_availability_rules_delete_own" on public.service_availability_rules for delete to authenticated using (
  public.is_business_settings_admin (business_id)
);

-- staff_members
drop policy if exists "staff_members_insert_own" on public.staff_members;

create policy "staff_members_insert_own" on public.staff_members for insert to authenticated with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "staff_members_update_own" on public.staff_members;

create policy "staff_members_update_own" on public.staff_members for update to authenticated using (
  public.is_business_settings_admin (business_id)
)
with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "staff_members_delete_own" on public.staff_members;

create policy "staff_members_delete_own" on public.staff_members for delete to authenticated using (
  public.is_business_settings_admin (business_id)
);

-- staff_services
drop policy if exists "staff_services_insert_own" on public.staff_services;

create policy "staff_services_insert_own" on public.staff_services for insert to authenticated with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "staff_services_update_own" on public.staff_services;

create policy "staff_services_update_own" on public.staff_services for update to authenticated using (
  public.is_business_settings_admin (business_id)
)
with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "staff_services_delete_own" on public.staff_services;

create policy "staff_services_delete_own" on public.staff_services for delete to authenticated using (
  public.is_business_settings_admin (business_id)
);

-- staff_availability_rules
drop policy if exists "staff_availability_rules_insert_own" on public.staff_availability_rules;

create policy "staff_availability_rules_insert_own" on public.staff_availability_rules for insert to authenticated with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "staff_availability_rules_update_own" on public.staff_availability_rules;

create policy "staff_availability_rules_update_own" on public.staff_availability_rules for update to authenticated using (
  public.is_business_settings_admin (business_id)
)
with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "staff_availability_rules_delete_own" on public.staff_availability_rules;

create policy "staff_availability_rules_delete_own" on public.staff_availability_rules for delete to authenticated using (
  public.is_business_settings_admin (business_id)
);

-- staff_availability_exceptions
drop policy if exists "staff_availability_exceptions_insert_own" on public.staff_availability_exceptions;

create policy "staff_availability_exceptions_insert_own" on public.staff_availability_exceptions for insert to authenticated with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "staff_availability_exceptions_update_own" on public.staff_availability_exceptions;

create policy "staff_availability_exceptions_update_own" on public.staff_availability_exceptions for update to authenticated using (
  public.is_business_settings_admin (business_id)
)
with check (
  public.is_business_settings_admin (business_id)
);

drop policy if exists "staff_availability_exceptions_delete_own" on public.staff_availability_exceptions;

create policy "staff_availability_exceptions_delete_own" on public.staff_availability_exceptions for delete to authenticated using (
  public.is_business_settings_admin (business_id)
);
