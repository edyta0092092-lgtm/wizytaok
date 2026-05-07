-- Rezerwacje online i ręczne (1:N z business_profiles). RLS: właściciel firmy. Publiczny dostęp przez RPC (anon).

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  confirmation_token text not null default gen_random_uuid ()::text,
  client_name text not null,
  client_phone text not null,
  client_email text,
  service_name text not null,
  service_duration_minutes integer not null default 0,
  service_price numeric not null default 0,
  service_currency text not null default 'PLN',
  appointment_date date not null,
  appointment_time time not null,
  status text not null default 'booked',
  source text not null default 'online',
  customer_note text,
  business_note text,
  proposed_date date,
  proposed_time time,
  proposed_service_id uuid references public.services (id) on delete set null,
  proposed_service_name text,
  proposed_service_duration_minutes integer,
  proposed_service_price numeric,
  previous_date date,
  previous_time time,
  previous_service_name text,
  last_updated_by text,
  last_change_type text,
  last_status_change_source text,
  status_before_request text,
  reschedule_message text,
  internal_note text,
  accepted_proposal_at timestamptz,
  business_proposal_kind text,
  previous_service_duration_minutes integer,
  previous_service_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_status_chk check (
    status in (
      'booked',
      'pending',
      'confirmed',
      'reschedule_requested',
      'business_reschedule_proposed',
      'cancelled',
      'no_show'
    )
  ),
  constraint bookings_source_chk check (source in ('online', 'manual')),
  constraint bookings_last_updated_by_chk check (
    last_updated_by is null
    or last_updated_by in ('customer', 'business')
  ),
  constraint bookings_last_status_change_source_chk check (
    last_status_change_source is null
    or last_status_change_source in ('manual', 'confirm', 'system')
  ),
  constraint bookings_business_proposal_kind_chk check (
    business_proposal_kind is null
    or business_proposal_kind in ('time', 'service', 'both')
  ),
  constraint bookings_status_before_request_chk check (
    status_before_request is null
    or status_before_request in ('booked', 'confirmed')
  ),
  constraint bookings_confirmation_token_unique unique (confirmation_token)
);

create index if not exists bookings_business_id_idx on public.bookings (business_id);

create index if not exists bookings_appointment_date_idx on public.bookings (appointment_date);

create index if not exists bookings_confirmation_token_idx on public.bookings (confirmation_token);

create trigger bookings_set_updated_at
before update on public.bookings for each row
execute function public.set_updated_at ();

alter table public.bookings enable row level security;

drop policy if exists "bookings_select_own" on public.bookings;

create policy "bookings_select_own" on public.bookings for select to authenticated using (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

drop policy if exists "bookings_insert_own" on public.bookings;

create policy "bookings_insert_own" on public.bookings for insert to authenticated with check (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

drop policy if exists "bookings_update_own" on public.bookings;

create policy "bookings_update_own" on public.bookings for update to authenticated using (
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

drop policy if exists "bookings_delete_own" on public.bookings;

create policy "bookings_delete_own" on public.bookings for delete to authenticated using (
  business_id in (
    select bp.id
    from public.business_profiles bp
    where bp.owner_id = auth.uid ()
  )
);

-- Publiczna rezerwacja online (anon): walidacja slug + usługa aktywna.
create or replace function public.create_online_booking (
  p_slug text,
  p_service_id uuid,
  p_client_name text,
  p_client_phone text,
  p_client_email text,
  p_appointment_date date,
  p_appointment_time time,
  p_customer_note text
)
returns table (
  id uuid,
  confirmation_token text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_bp public.business_profiles%rowtype;
  v_svc public.services%rowtype;
  v_id uuid;
  v_token text;
begin
  select * into v_bp
  from public.business_profiles bp
  where bp.slug = lower(trim(p_slug))
  limit 1;
  if not found then
    raise exception 'business_not_found';
  end if;

  select * into v_svc
  from public.services s
  where s.id = p_service_id
    and s.business_id = v_bp.id
    and s.is_active = true
  limit 1;
  if not found then
    raise exception 'service_not_found';
  end if;

  v_token := gen_random_uuid ()::text;

  insert into public.bookings (
    business_id,
    service_id,
    confirmation_token,
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
    v_token,
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
  returning id, confirmation_token into v_id, v_token;

  return query
  select v_id, v_token;
end;
$$;

revoke all on function public.create_online_booking (text, uuid, text, text, text, date, time, text) from public;

grant execute on function public.create_online_booking (text, uuid, text, text, text, date, time, text) to anon, authenticated;

-- Odczyt pojedynczej rezerwacji po tokenie lub starym id (tekst = uuid).
create or replace function public.get_booking_by_confirmation_token (p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.bookings%rowtype;
  v_slug text;
begin
  select b.* into v_row
  from public.bookings b
  where b.confirmation_token = trim(p_token)
     or b.id::text = trim(p_token)
  limit 1;
  if not found then
    return null;
  end if;

  select bp.slug into v_slug
  from public.business_profiles bp
  where bp.id = v_row.business_id
  limit 1;

  return jsonb_build_object(
    'id', v_row.id,
    'business_id', v_row.business_id,
    'confirmation_token', v_row.confirmation_token,
    'business_slug', coalesce(v_slug, ''),
    'service_id', v_row.service_id,
    'service_name', v_row.service_name,
    'service_duration_minutes', v_row.service_duration_minutes,
    'service_price', v_row.service_price,
    'service_currency', v_row.service_currency,
    'appointment_date', v_row.appointment_date::text,
    'appointment_time', v_row.appointment_time::text,
    'status', v_row.status,
    'source', v_row.source,
    'client_name', v_row.client_name,
    'client_phone', v_row.client_phone,
    'client_email', v_row.client_email,
    'customer_note', v_row.customer_note,
    'business_note', v_row.business_note,
    'proposed_date', case when v_row.proposed_date is null then null else v_row.proposed_date::text end,
    'proposed_time', case when v_row.proposed_time is null then null else v_row.proposed_time::text end,
    'proposed_service_id', v_row.proposed_service_id,
    'proposed_service_name', v_row.proposed_service_name,
    'proposed_service_duration_minutes', v_row.proposed_service_duration_minutes,
    'proposed_service_price', v_row.proposed_service_price,
    'previous_date', case when v_row.previous_date is null then null else v_row.previous_date::text end,
    'previous_time', case when v_row.previous_time is null then null else v_row.previous_time::text end,
    'previous_service_name', v_row.previous_service_name,
    'previous_service_duration_minutes', v_row.previous_service_duration_minutes,
    'previous_service_price', v_row.previous_service_price,
    'status_before_request', v_row.status_before_request,
    'reschedule_message', v_row.reschedule_message,
    'internal_note', v_row.internal_note,
    'last_updated_by', v_row.last_updated_by,
    'last_change_type', v_row.last_change_type,
    'last_status_change_source', v_row.last_status_change_source,
    'accepted_proposal_at', case when v_row.accepted_proposal_at is null then null else v_row.accepted_proposal_at::text end,
    'business_proposal_kind', v_row.business_proposal_kind,
    'created_at', v_row.created_at::text,
    'updated_at', v_row.updated_at::text
  );
end;
$$;

revoke all on function public.get_booking_by_confirmation_token (text) from public;

grant execute on function public.get_booking_by_confirmation_token (text) to anon, authenticated;

-- Akcje klienta na rezerwacji (anon).
create or replace function public.update_booking_by_confirmation_token (
  p_token text,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_now timestamptz := now();
begin
  select b.id into v_id
  from public.bookings b
  where b.confirmation_token = trim(p_token)
     or b.id::text = trim(p_token)
  limit 1;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_action = 'confirm' then
    update public.bookings
    set
      status = 'confirmed',
      last_updated_by = 'customer',
      last_status_change_source = 'confirm',
      last_change_type = null,
      updated_at = v_now
    where id = v_id;
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'cancel' then
    update public.bookings
    set
      status = 'cancelled',
      last_updated_by = 'customer',
      last_status_change_source = 'confirm',
      customer_note = coalesce(nullif(trim(p_payload->>'customer_note'), ''), customer_note),
      updated_at = v_now
    where id = v_id;
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'request_reschedule' then
    update public.bookings
    set
      status = 'reschedule_requested',
      proposed_date = case
        when nullif(trim(p_payload->>'proposed_date'), '') is not null then (p_payload->>'proposed_date')::date
        else proposed_date
      end,
      proposed_time = case
        when nullif(trim(p_payload->>'proposed_time'), '') is not null then (p_payload->>'proposed_time')::time
        else proposed_time
      end,
      proposed_service_id = case
        when p_payload ? 'proposed_service_id' and nullif(trim(p_payload->>'proposed_service_id'), '') is not null
        then (p_payload->>'proposed_service_id')::uuid
        else proposed_service_id
      end,
      proposed_service_name = coalesce(nullif(trim(p_payload->>'proposed_service_name'), ''), proposed_service_name),
      proposed_service_duration_minutes = case
        when p_payload ? 'proposed_service_duration_minutes' then (p_payload->>'proposed_service_duration_minutes')::integer
        else proposed_service_duration_minutes
      end,
      proposed_service_price = case
        when p_payload ? 'proposed_service_price' then (p_payload->>'proposed_service_price')::numeric
        else proposed_service_price
      end,
      customer_note = coalesce(nullif(trim(p_payload->>'customer_note'), ''), customer_note),
      status_before_request = case
        when nullif(trim(p_payload->>'status_before_request'), '') in ('booked', 'confirmed') then p_payload->>'status_before_request'
        else status_before_request
      end,
      last_updated_by = 'customer',
      last_status_change_source = 'confirm',
      updated_at = v_now
    where id = v_id;
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'accept_business_proposal' then
    update public.bookings b
    set
      previous_date = b.appointment_date,
      previous_time = b.appointment_time,
      previous_service_name = b.service_name,
      previous_service_duration_minutes = b.service_duration_minutes,
      previous_service_price = b.service_price,
      appointment_date = coalesce(b.proposed_date, b.appointment_date),
      appointment_time = coalesce(b.proposed_time, b.appointment_time),
      service_id = coalesce(b.proposed_service_id, b.service_id),
      service_name = coalesce(nullif(trim(b.proposed_service_name), ''), b.service_name),
      service_duration_minutes = coalesce(
        b.proposed_service_duration_minutes,
        b.service_duration_minutes
      ),
      service_price = coalesce(b.proposed_service_price, b.service_price),
      status = 'booked',
      proposed_date = null,
      proposed_time = null,
      proposed_service_id = null,
      proposed_service_name = null,
      proposed_service_duration_minutes = null,
      proposed_service_price = null,
      business_note = null,
      status_before_request = null,
      last_updated_by = 'customer',
      last_status_change_source = 'confirm',
      last_change_type = 'business_proposal_accepted',
      accepted_proposal_at = v_now,
      updated_at = v_now
    where b.id = v_id;
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('ok', false, 'error', 'unknown_action');
end;
$$;

revoke all on function public.update_booking_by_confirmation_token (text, text, jsonb) from public;

grant execute on function public.update_booking_by_confirmation_token (text, text, jsonb) to anon, authenticated;
