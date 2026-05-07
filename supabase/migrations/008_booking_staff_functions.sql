-- Rozszerzenie funkcji publicznego bookingu o staff.

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
            b.status,
            'staff_id',
            b.staff_id
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
    p_staff_id,
    v_staff_name,
    'booked',
    'online',
    nullif(trim(coalesce(p_customer_note, '')), '')
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
    'created_at', v_row.created_at::text,
    'updated_at', v_row.updated_at::text
  );
end;
$$;

revoke all on function public.get_booking_by_confirmation_token (text) from public;
grant execute on function public.get_booking_by_confirmation_token (text) to anon, authenticated;
