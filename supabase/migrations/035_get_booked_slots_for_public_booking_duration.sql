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
