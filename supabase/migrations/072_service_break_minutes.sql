-- Przerwy między wizytami: break_minutes na usłudze, default_break_minutes w profilu firmy,
-- snapshot service_break_minutes w bookings oraz uwzględnienie w RPC dostępności/rezerwacji.

alter table public.services
  add column if not exists break_minutes integer;

alter table public.services
  add column if not exists uses_default_availability boolean not null default true;

alter table public.business_profiles
  add column if not exists default_break_minutes integer;

alter table public.bookings
  add column if not exists service_break_minutes integer not null default 0;

comment on column public.services.break_minutes is
  'Opcjonalna przerwa po usłudze (min). NULL = użyj business_profiles.default_break_minutes.';

comment on column public.business_profiles.default_break_minutes is
  'Domyślna przerwa między wizytami (min) dla rezerwacji online.';

comment on column public.bookings.service_break_minutes is
  'Snapshot przerwy po usłudzie w momencie rezerwacji (min).';

update public.bookings b
set service_break_minutes = coalesce(
  (
    select coalesce(s.break_minutes, bp.default_break_minutes, 0)
    from public.services s
    inner join public.business_profiles bp on bp.id = b.business_id
    where s.id = b.service_id
  ),
  (
    select coalesce(bp.default_break_minutes, 0)
    from public.business_profiles bp
    where bp.id = b.business_id
  ),
  0
);

-- PostgreSQL nie pozwala CREATE OR REPLACE, gdy zmienia się zestaw kolumn RETURNS TABLE.
drop function if exists public.get_business_profile_by_slug(text);
drop function if exists public.get_active_services_by_business_slug(text);
drop function if exists public.get_active_services_by_business_id(uuid);

create or replace function public.get_business_profile_by_slug (p_slug text)
returns table (
  id uuid,
  business_name text,
  slug text,
  phone text,
  default_break_minutes integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    bp.id,
    bp.business_name,
    bp.slug,
    bp.phone,
    bp.default_break_minutes
  from public.business_profiles bp
  where bp.slug = lower(trim(p_slug))
  limit 1;
$$;

revoke all on function public.get_business_profile_by_slug (text) from public;
grant execute on function public.get_business_profile_by_slug (text) to anon, authenticated;

create or replace function public.get_active_services_by_business_slug (p_slug text)
returns table (
  id uuid,
  business_id uuid,
  name text,
  description text,
  duration_minutes integer,
  break_minutes integer,
  price numeric,
  currency text,
  is_active boolean,
  sort_order integer,
  uses_default_availability boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.business_id,
    s.name,
    s.description,
    s.duration_minutes,
    s.break_minutes,
    s.price,
    s.currency,
    s.is_active,
    s.sort_order,
    s.uses_default_availability
  from public.services s
  inner join public.business_profiles bp on bp.id = s.business_id
  where bp.slug = lower(trim(p_slug))
    and s.is_active = true
  order by s.sort_order asc, s.created_at asc;
$$;

revoke all on function public.get_active_services_by_business_slug (text) from public;
grant execute on function public.get_active_services_by_business_slug (text) to anon, authenticated;

create or replace function public.get_active_services_by_business_id (p_business_id uuid)
returns table (
  id uuid,
  business_id uuid,
  name text,
  description text,
  duration_minutes integer,
  break_minutes integer,
  price numeric,
  currency text,
  is_active boolean,
  sort_order integer,
  uses_default_availability boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.business_id,
    s.name,
    s.description,
    s.duration_minutes,
    s.break_minutes,
    s.price,
    s.currency,
    s.is_active,
    s.sort_order,
    s.uses_default_availability
  from public.services s
  where s.business_id = p_business_id
    and s.is_active = true
  order by s.sort_order asc, s.created_at asc;
$$;

revoke all on function public.get_active_services_by_business_id (uuid) from public;
grant execute on function public.get_active_services_by_business_id (uuid) to anon, authenticated;

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
            end,
            'service_break_minutes',
            case
              when coalesce(nullif(to_jsonb(b)->>'service_break_minutes', ''), '') ~ '^[0-9]+$'
                then greatest(0, (to_jsonb(b)->>'service_break_minutes')::int)
              else 0
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
  v_new_duration integer;
  v_new_break integer;
  v_new_span integer;
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

  v_new_duration := greatest(1, coalesce(v_svc.duration_minutes, 60));
  v_new_break := greatest(0, coalesce(v_svc.break_minutes, v_bp.default_break_minutes, 0));
  v_new_span := v_new_duration + v_new_break;

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
            'confirmed'
          )
          and (b2.appointment_date::timestamp + b2.appointment_time) <
              (
                (p_appointment_date::timestamp + p_appointment_time)
                + make_interval(mins => v_new_span)
              )
          and (
            (b2.appointment_date::timestamp + b2.appointment_time)
            + make_interval(
                mins =>
                  (
                    case
                      when coalesce(nullif(to_jsonb(b2)->>'service_duration_minutes', ''), '') ~ '^[0-9]+$'
                        then greatest(1, (to_jsonb(b2)->>'service_duration_minutes')::int)
                      else greatest(60, coalesce(v_svc.duration_minutes, 60))
                    end
                  )
                  + greatest(
                      0,
                      coalesce(
                        case
                          when coalesce(nullif(to_jsonb(b2)->>'service_break_minutes', ''), '') ~ '^[0-9]+$'
                            then (to_jsonb(b2)->>'service_break_minutes')::int
                          else 0
                        end,
                        0
                      )
                    )
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
        'confirmed'
      )
      and (b2.appointment_date::timestamp + b2.appointment_time) <
          (
            (p_appointment_date::timestamp + p_appointment_time)
            + make_interval(mins => v_new_span)
          )
      and (
        (b2.appointment_date::timestamp + b2.appointment_time)
        + make_interval(
            mins =>
              (
                case
                  when coalesce(nullif(to_jsonb(b2)->>'service_duration_minutes', ''), '') ~ '^[0-9]+$'
                    then greatest(1, (to_jsonb(b2)->>'service_duration_minutes')::int)
                  else greatest(60, coalesce(v_svc.duration_minutes, 60))
                end
              )
              + greatest(
                  0,
                  coalesce(
                    case
                      when coalesce(nullif(to_jsonb(b2)->>'service_break_minutes', ''), '') ~ '^[0-9]+$'
                        then (to_jsonb(b2)->>'service_break_minutes')::int
                      else 0
                    end,
                    0
                  )
                )
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

  insert into public.bookings (
    business_id,
    service_id,
    client_name,
    client_phone,
    client_email,
    service_name,
    service_duration_minutes,
    service_break_minutes,
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
    trim(p_client_name),
    trim(p_client_phone),
    nullif(trim(coalesce(p_client_email, '')), ''),
    v_svc.name,
    v_svc.duration_minutes,
    v_new_break,
    v_svc.price,
    v_svc.currency,
    p_appointment_date,
    p_appointment_time,
    v_selected_staff_id,
    v_staff_name,
    'confirmed',
    'online',
    nullif(trim(coalesce(p_customer_note, '')), '')
  )
  returning bookings.id, (bookings.confirmation_token)::text into v_id, v_token;

  return query
  select v_id, v_token;
end;
$$;

revoke all on function public.create_online_booking (text, uuid, text, text, text, date, time, text, uuid) from public;
grant execute on function public.create_online_booking (text, uuid, text, text, text, date, time, text, uuid) to anon, authenticated;
