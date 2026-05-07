-- Blokada podwójnej rezerwacji na ten sam slot (business_id + data + godzina) dla aktywnych statusów.
-- Przed migracją: jeśli CREATE UNIQUE INDEX się nie powiedzie z powodu duplikatów, uruchom ręcznie:
--
-- select business_id, appointment_date, appointment_time, count(*)
-- from public.bookings
-- where status in ('booked', 'pending', 'confirmed', 'reschedule_requested', 'business_reschedule_proposed')
-- group by business_id, appointment_date, appointment_time
-- having count(*) > 1;

create unique index if not exists bookings_unique_active_slot on public.bookings (
  business_id,
  appointment_date,
  appointment_time
)
where
  status in (
    'booked',
    'pending',
    'confirmed',
    'reschedule_requested',
    'business_reschedule_proposed'
  );

-- Anon: lista zajętych slotów (appointment_date + appointment_time) dla slug w zakresie dat.
create or replace function public.get_booked_slots_for_public_booking (
  p_slug text,
  p_date_from date,
  p_date_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return coalesce(
    (
      select
        jsonb_agg(
          jsonb_build_object(
            'appointment_date',
            b.appointment_date::text,
            'appointment_time',
            to_char(b.appointment_time, 'HH24:MI:SS'),
            'status',
            b.status
          )
        )
      from public.bookings b
      inner join public.business_profiles bp on bp.id = b.business_id
      where lower(trim(bp.slug)) = lower(trim(p_slug))
        and b.appointment_date >= p_date_from
        and b.appointment_date <= p_date_to
        and b.status in (
          'booked',
          'pending',
          'confirmed',
          'reschedule_requested',
          'business_reschedule_proposed'
        )
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.get_booked_slots_for_public_booking (text, date, date) from public;

grant execute on function public.get_booked_slots_for_public_booking (text, date, date) to anon, authenticated;

-- Rezerwacja online: odmowa gdy slot zajęty (dodatkowo do indeksu unikalnego).
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

  if exists (
    select 1
    from public.bookings b2
    where b2.business_id = v_bp.id
      and b2.appointment_date = p_appointment_date
      and b2.appointment_time = p_appointment_time
      and b2.status in (
        'booked',
        'pending',
        'confirmed',
        'reschedule_requested',
        'business_reschedule_proposed'
      )
  ) then
    raise exception 'slot_taken';
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

-- Akcje klienta: walidacja kolizji slotu przy prośbie o termin i przy akceptacji propozycji firmy.
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
  v_row public.bookings%rowtype;
  v_new_pd date;
  v_new_pt time;
  v_tgt_d date;
  v_tgt_t time;
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
    select * into strict v_row
    from public.bookings
    where id = v_id
    for update;

    v_new_pd := case
      when nullif(trim(p_payload->>'proposed_date'), '') is not null then (p_payload->>'proposed_date')::date
      else v_row.proposed_date
    end;
    v_new_pt := case
      when nullif(trim(p_payload->>'proposed_time'), '') is not null then (p_payload->>'proposed_time')::time
      else v_row.proposed_time
    end;

    if v_new_pd is not null and v_new_pt is not null then
      if exists (
        select 1
        from public.bookings bx
        where bx.business_id = v_row.business_id
          and bx.id <> v_id
          and bx.appointment_date = v_new_pd
          and bx.appointment_time = v_new_pt
          and bx.status in (
            'booked',
            'pending',
            'confirmed',
            'reschedule_requested',
            'business_reschedule_proposed'
          )
      ) then
        return jsonb_build_object('ok', false, 'error', 'slot_unavailable');
      end if;
    end if;

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
    select * into strict v_row
    from public.bookings
    where id = v_id
    for update;

    v_tgt_d := coalesce(v_row.proposed_date, v_row.appointment_date);
    v_tgt_t := coalesce(v_row.proposed_time, v_row.appointment_time);

    if exists (
      select 1
      from public.bookings bx
      where bx.business_id = v_row.business_id
        and bx.id <> v_id
        and bx.appointment_date = v_tgt_d
        and bx.appointment_time = v_tgt_t
        and bx.status in (
          'booked',
          'pending',
          'confirmed',
          'reschedule_requested',
          'business_reschedule_proposed'
        )
    ) then
      return jsonb_build_object('ok', false, 'error', 'slot_unavailable');
    end if;

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
