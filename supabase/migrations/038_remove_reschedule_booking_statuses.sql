-- Normalize legacy reschedule-related statuses and drop them from allowed values.
-- App no longer uses client reschedule requests or business counter-proposals.

update public.bookings
set
  status = 'booked',
  updated_at = now()
where status in ('reschedule_requested', 'business_reschedule_proposed');

alter table public.bookings
  drop constraint if exists bookings_status_chk;

alter table public.bookings
  add constraint bookings_status_chk check (
    status in (
      'booked',
      'pending',
      'confirmed',
      'cancelled',
      'no_show'
    )
  );

-- RPC used by /confirm: only confirm + cancel (no request_reschedule / accept_business_proposal).
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

  return jsonb_build_object('ok', false, 'error', 'unknown_action');
end;
$$;

revoke all on function public.update_booking_by_confirmation_token (text, text, jsonb) from public;
grant execute on function public.update_booking_by_confirmation_token (text, text, jsonb) to anon, authenticated;

-- Slot blocking for public calendar: only active visit statuses remain.
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
            nullif(to_jsonb(b)->>'staff_id', ''),
            'service_duration_minutes',
            case
              when coalesce(nullif(to_jsonb(b)->>'service_duration_minutes', ''), '') ~ '^[0-9]+$'
                then greatest(1, (to_jsonb(b)->>'service_duration_minutes')::int)
              else 60
            end
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
          'confirmed'
        )
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.get_booked_slots_for_public_booking (text, date, date) from public;
grant execute on function public.get_booked_slots_for_public_booking (text, date, date) to anon, authenticated;
