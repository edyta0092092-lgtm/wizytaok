-- Przypomnienia 24h (lub wg default_reminder_hours): kolumny, RPC process_due_booking_reminders,
-- rozszerzenie constraintów last_updated_by / last_status_change_source, create_online_booking,
-- get_booking_by_confirmation_token, update_booking_by_confirmation_token (reset reminder po akceptacji propozycji).

alter table public.business_profiles
add column if not exists default_reminder_hours integer not null default 24
  check (default_reminder_hours in (2, 6, 12, 24, 48)),
add column if not exists reminder_channel text not null default 'both'
  check (reminder_channel in ('sms', 'email', 'both'));

comment on column public.business_profiles.default_reminder_hours is 'Domyślny odstęp (godziny) przed wizytą, kiedy wysyłane jest przypomnienie i scheduled reminder_due_at.';
comment on column public.business_profiles.reminder_channel is 'Preferowany kanał przypomnienia (UI / eksport; integracja SMS/e-mail w przyszłości).';

alter table public.bookings
add column if not exists reminder_due_at timestamptz,
add column if not exists reminder_sent_at timestamptz,
add column if not exists reminder_status text;

alter table public.bookings
drop constraint if exists bookings_reminder_status_chk;

alter table public.bookings
add constraint bookings_reminder_status_chk check (
  reminder_status is null
  or reminder_status in (
    'pending',
    'sent',
    'failed',
    'skipped',
    'simulated',
    'pending_message_mock'
  )
);

create index if not exists bookings_reminder_due_pending_idx on public.bookings (business_id, reminder_due_at)
where
  status = 'booked'
  and reminder_sent_at is null;

alter table public.bookings
drop constraint if exists bookings_last_updated_by_chk;

alter table public.bookings
add constraint bookings_last_updated_by_chk check (
  last_updated_by is null
  or last_updated_by in ('customer', 'business', 'system')
);

alter table public.bookings
drop constraint if exists bookings_last_status_change_source_chk;

alter table public.bookings
add constraint bookings_last_status_change_source_chk check (
  last_status_change_source is null
  or last_status_change_source in ('manual', 'confirm', 'system', 'auto_reminder_24h')
);

-- Cron / Supabase scheduled function / Vercel cron: wywołuj public.process_due_booking_reminders()
-- z backendu (service role lub zaufany worker), nie z anonimowego frontu.

create or replace function public.process_due_booking_reminders ()
returns jsonb
language sql
volatile
security invoker
set search_path = public
as $$
  with due as (
    select b2.id
    from public.bookings b2
    where b2.status = 'booked'
      and b2.reminder_due_at is not null
      and b2.reminder_due_at <= now()
      and (b2.appointment_date::timestamp + b2.appointment_time) > now()
      and b2.reminder_sent_at is null
  ),
  upd as (
    update public.bookings b
    set
      status = 'pending',
      reminder_sent_at = now(),
      reminder_status = 'simulated',
      last_updated_by = 'system',
      last_change_type = 'reminder_24h_sent',
      last_status_change_source = 'auto_reminder_24h',
      updated_at = now()
    from due d
    where b.id = d.id
    returning
      b.id,
      b.confirmation_token,
      b.client_name,
      b.client_phone,
      b.client_email,
      b.service_name,
      b.appointment_date,
      b.appointment_time,
      b.business_id
  )
  select jsonb_build_object(
    'processed',
    (select count(*)::int from upd),
    'items',
    coalesce(
      (
        select
          jsonb_agg(
            jsonb_build_object(
              'id',
              u.id,
              'confirmation_token',
              u.confirmation_token,
              'business_slug',
              coalesce(
                (
                  select bp.slug
                  from public.business_profiles bp
                  where bp.id = u.business_id
                  limit 1
                ),
                ''
              ),
              'client_name',
              u.client_name,
              'client_phone',
              u.client_phone,
              'client_email',
              u.client_email,
              'service_name',
              u.service_name,
              'appointment_date',
              u.appointment_date::text,
              'appointment_time',
              u.appointment_time::text
            )
          )
        from upd u
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.process_due_booking_reminders () from public;

grant execute on function public.process_due_booking_reminders () to authenticated;

-- Publiczna rezerwacja online: reminder_due_at wg default_reminder_hours firmy.

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
  v_staff public.staff_members%rowtype;
  v_staff_name text;
  v_id uuid;
  v_token text;
  v_reminder_due timestamptz;
  v_rem_hours int;
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

  if p_staff_id is not null then
    select * into v_staff
    from public.staff_members sm
    where sm.id = p_staff_id
      and sm.business_id = v_bp.id
      and sm.is_active = true
    limit 1;
    if not found then
      raise exception 'staff_not_found';
    end if;
    if not exists (
      select 1
      from public.staff_services ss
      where ss.business_id = v_bp.id
        and ss.staff_id = v_staff.id
        and ss.service_id = v_svc.id
      limit 1
    ) then
      raise exception 'staff_service_not_allowed';
    end if;
    v_staff_name := v_staff.name;
  else
    v_staff_name := null;
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
      and (
        (p_staff_id is null and b2.staff_id is null)
        or (p_staff_id is not null and b2.staff_id = p_staff_id)
      )
  ) then
    raise exception 'slot_taken';
  end if;

  v_rem_hours := coalesce(v_bp.default_reminder_hours, 24);
  v_reminder_due := (
    (p_appointment_date::timestamp + p_appointment_time)
    - make_interval(hours => v_rem_hours)
  );

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
    staff_id,
    staff_name,
    status,
    source,
    customer_note,
    reminder_due_at,
    reminder_status
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
    p_staff_id,
    v_staff_name,
    'booked',
    'online',
    nullif(trim(coalesce(p_customer_note, '')), ''),
    v_reminder_due,
    'pending'
  )
  returning id, confirmation_token into v_id, v_token;

  return query
  select v_id, v_token;
end;
$$;

revoke all on function public.create_online_booking (text, uuid, text, text, text, date, time, text, uuid) from public;

grant execute on function public.create_online_booking (text, uuid, text, text, text, date, time, text, uuid) to anon, authenticated;

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
    'staff_id', v_row.staff_id,
    'staff_name', v_row.staff_name,
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
    'reminder_due_at', case when v_row.reminder_due_at is null then null else v_row.reminder_due_at::text end,
    'reminder_sent_at', case when v_row.reminder_sent_at is null then null else v_row.reminder_sent_at::text end,
    'reminder_status', v_row.reminder_status,
    'created_at', v_row.created_at::text,
    'updated_at', v_row.updated_at::text
  );
end;
$$;

revoke all on function public.get_booking_by_confirmation_token (text) from public;

grant execute on function public.get_booking_by_confirmation_token (text) to anon, authenticated;

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
  v_rem_hours int;
  v_reminder_due timestamptz;
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

    select coalesce(bp.default_reminder_hours, 24) into v_rem_hours
    from public.business_profiles bp
    where bp.id = v_row.business_id
    limit 1;

    v_reminder_due := (
      (v_tgt_d::timestamp + v_tgt_t)
      - make_interval(hours => coalesce(v_rem_hours, 24))
    );

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
      reminder_due_at = v_reminder_due,
      reminder_sent_at = null,
      reminder_status = 'pending',
      updated_at = v_now
    where b.id = v_id;
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('ok', false, 'error', 'unknown_action');
end;
$$;

revoke all on function public.update_booking_by_confirmation_token (text, text, jsonb) from public;

grant execute on function public.update_booking_by_confirmation_token (text, text, jsonb) to anon, authenticated;
