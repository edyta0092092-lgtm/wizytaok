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
  where (
    coalesce(nullif(to_jsonb(b)->>'confirmation_token', ''), '') = trim(coalesce(p_token, ''))
    or b.id::text = trim(coalesce(p_token, ''))
  )
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
