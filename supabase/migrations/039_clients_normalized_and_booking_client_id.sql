-- Klienci: normalizacja email/telefon, bookings.client_id, find_or_create_client,
-- podpięcie create_online_booking, backfill, RLS jak bookings.

-- ---------------------------------------------------------------------------
-- Tabela clients (zgodnie z aplikacją: business_profiles)
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  full_name text,
  email text not null default '',
  phone text not null default '',
  normalized_email text,
  normalized_phone text,
  notes text,
  no_show_count integer not null default 0 check (no_show_count >= 0),
  confirmed_count integer not null default 0 check (confirmed_count >= 0),
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now ()
);

alter table public.clients
  alter column email drop not null;

alter table public.clients
  alter column email set default '';

alter table public.clients
  alter column phone drop not null;

alter table public.clients
  alter column phone set default '';

alter table public.clients
add column if not exists normalized_email text;

alter table public.clients
add column if not exists normalized_phone text;

create index if not exists clients_business_id_idx on public.clients (business_id);

create index if not exists clients_business_normalized_email_idx on public.clients (business_id, normalized_email);

create index if not exists clients_business_normalized_phone_idx on public.clients (business_id, normalized_phone);

-- ---------------------------------------------------------------------------
-- bookings.client_id
-- ---------------------------------------------------------------------------
alter table public.bookings
add column if not exists client_id uuid references public.clients (id) on delete set null;

create index if not exists bookings_client_id_idx on public.bookings (client_id);

-- ---------------------------------------------------------------------------
-- Normalizacja (spójnie z aplikacją TS)
-- ---------------------------------------------------------------------------
create or replace function public.normalize_client_email (p_email text) returns text
language sql
immutable
parallel safe
as $$
  select case
    when p_email is null then null
    when nullif(trim(lower(p_email)), '') is null then null
    else trim(lower(p_email))
  end;
$$;

create or replace function public.normalize_client_phone (p_phone text) returns text
language plpgsql
immutable
parallel safe
as $$
declare
  t text;
  d text;
  has_plus boolean;
begin
  if p_phone is null then
    return null;
  end if;
  t := trim(p_phone);
  if t = '' then
    return null;
  end if;
  has_plus := substr(t, 1, 1) = '+';
  d := regexp_replace(t, '[^0-9]', '', 'g');
  if d is null or d = '' then
    return null;
  end if;

  if not has_plus then
    if length(d) = 9 then
      d := '48' || d;
    elsif length(d) = 11
    and substr(d, 1, 2) = '48' then
      null;
    elsif length(d) = 10
    and substr(d, 1, 1) = '0' then
      d := '48' || substr(d, 2);
    end if;
  end if;

  if length(d) = 11
  and substr(d, 1, 2) = '48' then
    return '+' || d;
  end if;

  if has_plus then
    return '+' || d;
  end if;

  if length(d) >= 6 then
    return '+' || d;
  end if;

  return d;
end;
$$;

create or replace function public.clients_set_normalized_fields () returns trigger
language plpgsql
as $$
begin
  new.normalized_email := public.normalize_client_email(new.email);
  new.normalized_phone := public.normalize_client_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists clients_set_normalized on public.clients;

create trigger clients_set_normalized before insert or update on public.clients for each row
execute function public.clients_set_normalized_fields ();

drop trigger if exists clients_set_updated_at on public.clients;

create trigger clients_set_updated_at before update on public.clients for each row
execute function public.set_updated_at ();

-- Uzupełnij znormalizowane dla istniejących wierszy
update public.clients
set
  email = coalesce(email, ''),
  phone = coalesce(phone, '')
where id in (
    select id
    from public.clients
  );

-- ---------------------------------------------------------------------------
-- find_or_create_client
-- ---------------------------------------------------------------------------
create or replace function public.find_or_create_client (
  p_business_id uuid,
  p_full_name text,
  p_email text,
  p_phone text
) returns table (
  client_id uuid,
  outcome text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ne text;
  v_np text;
  v_id uuid;
  v_row_cnt integer;
begin
  v_ne := public.normalize_client_email(p_email);
  v_np := public.normalize_client_phone(p_phone);

  if v_ne is null
  and v_np is null then
    insert into public.clients (
      business_id,
      full_name,
      phone,
      email,
      notes,
      no_show_count,
      confirmed_count
    )
    values (
      p_business_id,
      coalesce(nullif(trim(p_full_name), ''), '?'),
      coalesce(nullif(trim(p_phone), ''), ''),
      coalesce(nullif(trim(p_email), ''), ''),
      null,
      0,
      0
    )
    returning id into v_id;

    return query
    select
      v_id,
      'created'::text;
    return;
  end if;

  select
    c.id into v_id
  from
    public.clients c
  where
    c.business_id = p_business_id
    and (
      (
        v_ne is not null
        and c.normalized_email is not null
        and c.normalized_email = v_ne
      )
      or (
        v_np is not null
        and c.normalized_phone is not null
        and c.normalized_phone = v_np
      )
    )
  order by
    c.created_at asc
  limit 1;

  if v_id is not null then
    update public.clients c
    set
      full_name = coalesce(nullif(trim(c.full_name), ''), nullif(trim(p_full_name), ''), c.full_name),
      phone = coalesce(nullif(trim(p_phone), ''), c.phone),
      email = coalesce(nullif(trim(p_email), ''), c.email),
      updated_at = now()
    where
      c.id = v_id
      and (
        coalesce(nullif(trim(p_phone), ''), c.phone) is distinct from c.phone
        or coalesce(nullif(trim(p_email), ''), c.email) is distinct from c.email
        or coalesce(nullif(trim(c.full_name), ''), nullif(trim(p_full_name), ''), c.full_name) is distinct from c.full_name
      );

    get diagnostics v_row_cnt = row_count;

    if v_row_cnt > 0 then
      return query
      select
        v_id,
        'updated'::text;
    else
      return query
      select
        v_id,
        'found'::text;
    end if;

    return;
  end if;

  insert into public.clients (
    business_id,
    full_name,
    phone,
    email,
    notes,
    no_show_count,
    confirmed_count
  )
  values (
    p_business_id,
    coalesce(nullif(trim(p_full_name), ''), '?'),
    coalesce(nullif(trim(p_phone), ''), ''),
    coalesce(nullif(trim(p_email), ''), ''),
    null,
    0,
    0
  )
  returning id into v_id;

  return query
  select
    v_id,
    'created'::text;
end;
$$;

revoke all on function public.find_or_create_client (uuid, text, text, text) from public;

grant execute on function public.find_or_create_client (uuid, text, text, text) to authenticated;

grant execute on function public.normalize_client_email (text) to authenticated;

grant execute on function public.normalize_client_phone (text) to authenticated;

-- ---------------------------------------------------------------------------
-- create_online_booking: przypisz client_id + zwróć w wyniku
-- ---------------------------------------------------------------------------
create or replace function public.create_online_booking (
  p_slug text,
  p_service_id uuid,
  p_client_name text,
  p_client_phone text,
  p_client_email text,
  p_appointment_date date,
  p_appointment_time time,
  p_customer_note text,
  p_staff_id uuid default null
) returns table (
  id uuid,
  confirmation_token text,
  client_id uuid
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_bp public.business_profiles%rowtype;
  v_svc public.services%rowtype;
  v_staff public.staff_members%rowtype;
  v_staff_name text;
  v_selected_staff_id uuid;
  v_has_staff_assignments boolean := false;
  v_has_booking_staff_cols boolean := false;
  v_id uuid;
  v_token text;
  v_client_id uuid;
begin
  select
    * into v_bp
  from
    public.business_profiles bp
  where
    bp.slug = lower(trim(p_slug))
  limit 1;

  if not found then
    raise exception 'business_not_found';
  end if;

  select
    * into v_svc
  from
    public.services s
  where
    s.id = p_service_id
    and s.business_id = v_bp.id
    and s.is_active = true
  limit 1;

  if not found then
    raise exception 'service_not_found';
  end if;

  v_selected_staff_id := p_staff_id;

  select
    exists (
      select
        1
      from
        public.staff_services ss
      where
        ss.service_id = v_svc.id
        and coalesce(
          nullif(to_jsonb(ss) ->> 'business_id', ''),
          v_bp.id::text
        ) = v_bp.id::text
    )
  into v_has_staff_assignments;

  if v_selected_staff_id is not null then
    select
      * into v_staff
    from
      public.staff_members sm
    where
      sm.id = v_selected_staff_id
      and sm.business_id = v_bp.id
      and sm.is_active = true
    limit 1;

    if not found then
      raise exception 'staff_not_found';
    end if;

    if not exists (
      select
        1
      from
        public.staff_services ss
      where
        ss.service_id = v_svc.id
        and coalesce(
          nullif(to_jsonb(ss) ->> 'business_id', ''),
          v_bp.id::text
        ) = v_bp.id::text
        and coalesce(
          nullif(to_jsonb(ss) ->> 'staff_id', ''),
          nullif(to_jsonb(ss) ->> 'staff_member_id', '')
        ) = v_staff.id::text
      limit 1
    ) then
      raise exception 'staff_service_not_allowed';
    end if;

    v_staff_name := v_staff.name;
  elsif v_has_staff_assignments then
    select
      sm.id,
      sm.name into v_selected_staff_id,
      v_staff_name
    from
      public.staff_members sm
    where
      sm.business_id = v_bp.id
      and sm.is_active = true
      and exists (
        select
          1
        from
          public.staff_services ss
        where
          ss.service_id = v_svc.id
          and coalesce(
            nullif(to_jsonb(ss) ->> 'business_id', ''),
            v_bp.id::text
          ) = v_bp.id::text
          and coalesce(
            nullif(to_jsonb(ss) ->> 'staff_id', ''),
            nullif(to_jsonb(ss) ->> 'staff_member_id', '')
          ) = sm.id::text
      )
      and not exists (
        select
          1
        from
          public.bookings b2
        where
          b2.business_id = v_bp.id
          and b2.status in (
            'booked',
            'pending',
            'confirmed',
            'reschedule_requested',
            'business_reschedule_proposed'
          )
          and (b2.appointment_date::timestamp + b2.appointment_time) < (
            (p_appointment_date::timestamp + p_appointment_time) + make_interval(
              mins => greatest(1, coalesce(v_svc.duration_minutes, 60))
            )
          )
          and (
            (b2.appointment_date::timestamp + b2.appointment_time) + make_interval(
              mins => case
                when coalesce(nullif(to_jsonb(b2) ->> 'service_duration_minutes', ''), '') ~ '^[0-9]+$' then greatest(1, (to_jsonb(b2) ->> 'service_duration_minutes')::int)
                else greatest(60, coalesce(v_svc.duration_minutes, 60))
              end
            )
          ) > (p_appointment_date::timestamp + p_appointment_time)
          and (
            case
              when to_jsonb(b2) ? 'staff_id' then coalesce(nullif(to_jsonb(b2) ->> 'staff_id', ''), '') = sm.id::text
              else true
            end
          )
      )
    order by
      sm.name asc
    limit 1;

    if v_selected_staff_id is null then
      raise exception 'slot_taken';
    end if;
  else
    v_staff_name := null;
  end if;

  if exists (
    select
      1
    from
      public.bookings b2
    where
      b2.business_id = v_bp.id
      and b2.status in (
        'booked',
        'pending',
        'confirmed',
        'reschedule_requested',
        'business_reschedule_proposed'
      )
      and (b2.appointment_date::timestamp + b2.appointment_time) < (
        (p_appointment_date::timestamp + p_appointment_time) + make_interval(
          mins => greatest(1, coalesce(v_svc.duration_minutes, 60))
        )
      )
      and (
        (b2.appointment_date::timestamp + b2.appointment_time) + make_interval(
          mins => case
            when coalesce(nullif(to_jsonb(b2) ->> 'service_duration_minutes', ''), '') ~ '^[0-9]+$' then greatest(1, (to_jsonb(b2) ->> 'service_duration_minutes')::int)
            else greatest(60, coalesce(v_svc.duration_minutes, 60))
          end
        )
      ) > (p_appointment_date::timestamp + p_appointment_time)
      and (
        case
          when v_selected_staff_id is null then coalesce(nullif(to_jsonb(b2) ->> 'staff_id', ''), '') = ''
          when to_jsonb(b2) ? 'staff_id' then coalesce(nullif(to_jsonb(b2) ->> 'staff_id', ''), '') = v_selected_staff_id::text
          else true
        end
      )
  ) then
    raise exception 'slot_taken';
  end if;

  select
    f.client_id into v_client_id
  from
    public.find_or_create_client(
      v_bp.id,
      trim(p_client_name),
      coalesce(p_client_email, ''),
      trim(p_client_phone)
    ) f
  limit 1;

  select
    exists (
      select
        1
      from
        information_schema.columns c
      where
        c.table_schema = 'public'
        and c.table_name = 'bookings'
        and c.column_name = 'staff_id'
    )
  into v_has_booking_staff_cols;

  if v_has_booking_staff_cols then
    insert into public.bookings (
      business_id,
      service_id,
      staff_id,
      staff_name,
      client_id,
      client_name,
      client_phone,
      client_email,
      service_name,
      service_duration_minutes,
      service_price,
      service_currency,
      appointment_date,
      appointment_time,
      status,
      source,
      customer_note
    )
    values (
      v_bp.id,
      v_svc.id,
      v_selected_staff_id,
      v_staff_name,
      v_client_id,
      trim(p_client_name),
      trim(p_client_phone),
      nullif(trim(coalesce(p_client_email, '')), ''),
      v_svc.name,
      v_svc.duration_minutes,
      v_svc.price,
      v_svc.currency,
      p_appointment_date,
      p_appointment_time,
      'booked',
      'online',
      nullif(trim(coalesce(p_customer_note, '')), '')
    )
    returning
      bookings.id,
      (bookings.confirmation_token)::text into v_id,
      v_token;
  else
    insert into public.bookings (
      business_id,
      service_id,
      client_id,
      client_name,
      client_phone,
      client_email,
      service_name,
      service_duration_minutes,
      service_price,
      service_currency,
      appointment_date,
      appointment_time,
      status,
      source,
      customer_note
    )
    values (
      v_bp.id,
      v_svc.id,
      v_client_id,
      trim(p_client_name),
      trim(p_client_phone),
      nullif(trim(coalesce(p_client_email, '')), ''),
      v_svc.name,
      v_svc.duration_minutes,
      v_svc.price,
      v_svc.currency,
      p_appointment_date,
      p_appointment_time,
      'booked',
      'online',
      nullif(trim(coalesce(p_customer_note, '')), '')
    )
    returning
      bookings.id,
      (bookings.confirmation_token)::text into v_id,
      v_token;
  end if;

  return query
  select
    v_id,
    v_token,
    v_client_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: wizyty bez client_id
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_cid uuid;
begin
  for r in
  select
    b.id,
    b.business_id,
    b.client_name,
    b.client_phone,
    b.client_email
  from
    public.bookings b
  where
    b.client_id is null
  order by
    b.created_at asc
  loop
    select
      f.client_id into v_cid
    from
      public.find_or_create_client(
        r.business_id,
        coalesce(nullif(trim(r.client_name), ''), '?'),
        coalesce(r.client_email, ''),
        coalesce(nullif(trim(r.client_phone), ''), '')
      ) f
    limit 1;

    update public.bookings b
    set
      client_id = v_cid
    where
      b.id = r.id;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- RLS: jak bookings (członkowie firmy)
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;

drop policy if exists "clients_select_own" on public.clients;

create policy "clients_select_own" on public.clients for select to authenticated using (
  public.is_business_member_active (business_id)
);

drop policy if exists "clients_insert_own" on public.clients;

create policy "clients_insert_own" on public.clients for insert to authenticated
with check (
  public.is_business_member_active (business_id)
);

drop policy if exists "clients_update_own" on public.clients;

create policy "clients_update_own" on public.clients for update to authenticated using (
  public.is_business_member_active (business_id)
)
with check (
  public.is_business_member_active (business_id)
);

drop policy if exists "clients_delete_own" on public.clients;

create policy "clients_delete_own" on public.clients for delete to authenticated using (
  public.is_business_member_active (business_id)
);
