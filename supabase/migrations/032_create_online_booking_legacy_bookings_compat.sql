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
  v_selected_staff_id uuid;
  v_has_staff_assignments boolean := false;
  v_has_booking_staff_cols boolean := false;
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

  v_selected_staff_id := p_staff_id;

  select exists (
    select 1
    from public.staff_services ss
    where ss.service_id = v_svc.id
      and coalesce(
        nullif(to_jsonb(ss)->>'business_id', ''),
        v_bp.id::text
      ) = v_bp.id::text
  ) into v_has_staff_assignments;

  if v_selected_staff_id is not null then
    select * into v_staff
    from public.staff_members sm
    where sm.id = v_selected_staff_id
      and sm.business_id = v_bp.id
      and sm.is_active = true
    limit 1;
    if not found then
      raise exception 'staff_not_found';
    end if;

    if not exists (
      select 1
      from public.staff_services ss
      where ss.service_id = v_svc.id
        and coalesce(
          nullif(to_jsonb(ss)->>'business_id', ''),
          v_bp.id::text
        ) = v_bp.id::text
        and coalesce(
          nullif(to_jsonb(ss)->>'staff_id', ''),
          nullif(to_jsonb(ss)->>'staff_member_id', '')
        ) = v_staff.id::text
      limit 1
    ) then
      raise exception 'staff_service_not_allowed';
    end if;
    v_staff_name := v_staff.name;
  elsif v_has_staff_assignments then
    select sm.id, sm.name
      into v_selected_staff_id, v_staff_name
    from public.staff_members sm
    where sm.business_id = v_bp.id
      and sm.is_active = true
      and exists (
        select 1
        from public.staff_services ss
        where ss.service_id = v_svc.id
          and coalesce(
            nullif(to_jsonb(ss)->>'business_id', ''),
            v_bp.id::text
          ) = v_bp.id::text
          and coalesce(
            nullif(to_jsonb(ss)->>'staff_id', ''),
            nullif(to_jsonb(ss)->>'staff_member_id', '')
          ) = sm.id::text
      )
      and not exists (
        select 1
        from public.bookings b2
        where b2.business_id = v_bp.id
          and b2.status in (
            'booked',
            'pending',
            'confirmed',
            'reschedule_requested',
            'business_reschedule_proposed'
          )
          and (b2.appointment_date::timestamp + b2.appointment_time) <
              (
                (p_appointment_date::timestamp + p_appointment_time)
                + make_interval(mins => greatest(1, coalesce(v_svc.duration_minutes, 60)))
              )
          and (
            (b2.appointment_date::timestamp + b2.appointment_time)
            + make_interval(
                mins => case
                  when coalesce(nullif(to_jsonb(b2)->>'service_duration_minutes', ''), '') ~ '^[0-9]+$'
                    then greatest(1, (to_jsonb(b2)->>'service_duration_minutes')::int)
                  else greatest(60, coalesce(v_svc.duration_minutes, 60))
                end
              )
          ) > (p_appointment_date::timestamp + p_appointment_time)
          and (
            case
              when to_jsonb(b2) ? 'staff_id'
                then coalesce(nullif(to_jsonb(b2)->>'staff_id', ''), '') = sm.id::text
              else true
            end
          )
      )
    order by sm.name asc
    limit 1;

    if v_selected_staff_id is null then
      raise exception 'slot_taken';
    end if;
  else
    v_staff_name := null;
  end if;

  if exists (
    select 1
    from public.bookings b2
    where b2.business_id = v_bp.id
      and b2.status in (
        'booked',
        'pending',
        'confirmed',
        'reschedule_requested',
        'business_reschedule_proposed'
      )
      -- Time overlap guard: block all intersecting intervals, not only same start time.
      and (b2.appointment_date::timestamp + b2.appointment_time) <
          (
            (p_appointment_date::timestamp + p_appointment_time)
            + make_interval(mins => greatest(1, coalesce(v_svc.duration_minutes, 60)))
          )
      and (
        (b2.appointment_date::timestamp + b2.appointment_time)
        + make_interval(
            mins => case
              when coalesce(nullif(to_jsonb(b2)->>'service_duration_minutes', ''), '') ~ '^[0-9]+$'
                then greatest(1, (to_jsonb(b2)->>'service_duration_minutes')::int)
              else greatest(60, coalesce(v_svc.duration_minutes, 60))
            end
          )
      ) > (p_appointment_date::timestamp + p_appointment_time)
      and (
        case
          when v_selected_staff_id is null then coalesce(nullif(to_jsonb(b2)->>'staff_id', ''), '') = ''
          when to_jsonb(b2) ? 'staff_id' then coalesce(nullif(to_jsonb(b2)->>'staff_id', ''), '') = v_selected_staff_id::text
          else true
        end
      )
  ) then
    raise exception 'slot_taken';
  end if;

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'bookings'
      and c.column_name = 'staff_id'
  ) into v_has_booking_staff_cols;

  if v_has_booking_staff_cols then
    insert into public.bookings (
      business_id,
      service_id,
      staff_id,
      staff_name,
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
    returning bookings.id, (bookings.confirmation_token)::text into v_id, v_token;
  else
    insert into public.bookings (
      business_id,
      service_id,
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
    returning bookings.id, (bookings.confirmation_token)::text into v_id, v_token;
  end if;

  return query
  select v_id, v_token;
end;
$$;
