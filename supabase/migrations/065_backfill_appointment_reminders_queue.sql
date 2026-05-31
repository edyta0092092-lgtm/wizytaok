-- Backfill kolejki appointment_reminders dla przyszłych wizyt po konfiguracji szablonów.
-- sync_business_profile_reminders_from_templates aktualizowało tylko business_profiles;
-- istniejące wizyty nie dostały wpisów, dopóki nie zmieniły się kolumny profilu.

create or replace function public.sync_appointment_reminders_for_business(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_minutes integer;
  v_second_minutes integer;
  v_channel text;
  v_channel_has_email boolean;
  v_channel_has_sms boolean;
  v_booking record;
  v_appointment_ts timestamptz;
  v_first_scheduled timestamptz;
  v_second_scheduled timestamptz;
  v_has_email boolean;
  v_has_phone boolean;
  v_has_confirmation_token boolean;
  v_first_email_ok boolean;
  v_second_email_ok boolean;
  v_first_sms_ok boolean;
  v_second_sms_ok boolean;
begin
  select coalesce(default_reminder_minutes, coalesce(default_reminder_hours, 24) * 60),
         coalesce(second_reminder_minutes, 0),
         coalesce(reminder_channel, 'both')
    into v_default_minutes, v_second_minutes, v_channel
    from public.business_profiles
   where id = p_business_id;

  if not found then
    return;
  end if;

  v_default_minutes := coalesce(v_default_minutes, 1440);
  v_second_minutes := coalesce(v_second_minutes, 0);
  v_channel := coalesce(v_channel, 'both');
  v_channel_has_email := v_channel in ('email', 'both');
  v_channel_has_sms   := v_channel in ('sms', 'both');

  if not v_channel_has_email then
    update public.appointment_reminders
       set status = 'cancelled', locked_at = null, updated_at = now()
     where business_id = p_business_id
       and channel = 'email'
       and status in ('pending', 'processing');
  end if;

  if not v_channel_has_sms then
    update public.appointment_reminders
       set status = 'cancelled', locked_at = null, updated_at = now()
     where business_id = p_business_id
       and channel = 'sms'
       and status in ('pending', 'processing');
  end if;

  if v_second_minutes = 0 then
    update public.appointment_reminders
       set status = 'cancelled', locked_at = null, updated_at = now()
     where business_id = p_business_id
       and reminder_kind = 'second'
       and status in ('pending', 'processing');
  end if;

  if not v_channel_has_email and not v_channel_has_sms then
    return;
  end if;

  for v_booking in
    select id,
           appointment_date,
           appointment_time,
           client_email,
           client_phone,
           confirmation_token
      from public.bookings
     where business_id = p_business_id
       and status <> 'cancelled'
       and ((appointment_date::timestamp + appointment_time) at time zone 'Europe/Warsaw') > now()
  loop
    v_appointment_ts := ((v_booking.appointment_date::timestamp + v_booking.appointment_time)
                         at time zone 'Europe/Warsaw');
    v_first_scheduled := v_appointment_ts - make_interval(mins => v_default_minutes);
    if v_second_minutes > 0 then
      v_second_scheduled := v_appointment_ts - make_interval(mins => v_second_minutes);
    else
      v_second_scheduled := null;
    end if;

    v_has_email := v_booking.client_email is not null
                   and btrim(v_booking.client_email) <> '';
    v_has_phone := v_booking.client_phone is not null
                   and btrim(v_booking.client_phone) <> '';
    v_has_confirmation_token :=
      v_booking.confirmation_token is not null
      and btrim(v_booking.confirmation_token::text) <> '';

    v_first_email_ok :=
         v_channel_has_email
     and v_has_email
     and v_first_scheduled > now();

    if v_first_email_ok then
      insert into public.appointment_reminders
        (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
      values (p_business_id, v_booking.id, 'email', 'first', v_first_scheduled, 'pending')
      on conflict (appointment_id, channel, reminder_kind) do update
        set scheduled_for = excluded.scheduled_for,
            status = case
              when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
              when excluded.scheduled_for > now() then 'pending'
              else public.appointment_reminders.status
            end,
            attempts = case
              when public.appointment_reminders.status = 'cancelled' then 0
              else public.appointment_reminders.attempts
            end,
            locked_at = null,
            last_error = null,
            updated_at = now()
        where public.appointment_reminders.status not in ('sent', 'failed');
    else
      update public.appointment_reminders
         set status = 'cancelled', locked_at = null, updated_at = now()
       where appointment_id = v_booking.id
         and channel = 'email'
         and reminder_kind = 'first'
         and status in ('pending', 'processing');
    end if;

    v_second_email_ok :=
         v_second_minutes > 0
     and v_channel_has_email
     and v_has_email
     and v_second_scheduled is not null
     and v_second_scheduled > v_first_scheduled
     and v_second_scheduled > now();

    if v_second_email_ok then
      insert into public.appointment_reminders
        (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
      values (p_business_id, v_booking.id, 'email', 'second', v_second_scheduled, 'pending')
      on conflict (appointment_id, channel, reminder_kind) do update
        set scheduled_for = excluded.scheduled_for,
            status = case
              when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
              when excluded.scheduled_for > now() then 'pending'
              else public.appointment_reminders.status
            end,
            attempts = case
              when public.appointment_reminders.status = 'cancelled' then 0
              else public.appointment_reminders.attempts
            end,
            locked_at = null,
            last_error = null,
            updated_at = now()
        where public.appointment_reminders.status not in ('sent', 'failed');
    else
      update public.appointment_reminders
         set status = 'cancelled', locked_at = null, updated_at = now()
       where appointment_id = v_booking.id
         and channel = 'email'
         and reminder_kind = 'second'
         and status in ('pending', 'processing');
    end if;

    v_first_sms_ok :=
         v_channel_has_sms
     and v_has_phone
     and v_has_confirmation_token
     and v_first_scheduled > now();

    if v_first_sms_ok then
      insert into public.appointment_reminders
        (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
      values (p_business_id, v_booking.id, 'sms', 'first', v_first_scheduled, 'pending')
      on conflict (appointment_id, channel, reminder_kind) do update
        set scheduled_for = excluded.scheduled_for,
            status = case
              when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
              when excluded.scheduled_for > now() then 'pending'
              else public.appointment_reminders.status
            end,
            attempts = case
              when public.appointment_reminders.status = 'cancelled' then 0
              else public.appointment_reminders.attempts
            end,
            locked_at = null,
            last_error = null,
            updated_at = now()
        where public.appointment_reminders.status not in ('sent', 'failed');
    else
      update public.appointment_reminders
         set status = 'cancelled', locked_at = null, updated_at = now()
       where appointment_id = v_booking.id
         and channel = 'sms'
         and reminder_kind = 'first'
         and status in ('pending', 'processing');
    end if;

    v_second_sms_ok :=
         v_second_minutes > 0
     and v_channel_has_sms
     and v_has_phone
     and v_has_confirmation_token
     and v_second_scheduled is not null
     and v_second_scheduled > v_first_scheduled
     and v_second_scheduled > now();

    if v_second_sms_ok then
      insert into public.appointment_reminders
        (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
      values (p_business_id, v_booking.id, 'sms', 'second', v_second_scheduled, 'pending')
      on conflict (appointment_id, channel, reminder_kind) do update
        set scheduled_for = excluded.scheduled_for,
            status = case
              when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
              when excluded.scheduled_for > now() then 'pending'
              else public.appointment_reminders.status
            end,
            attempts = case
              when public.appointment_reminders.status = 'cancelled' then 0
              else public.appointment_reminders.attempts
            end,
            locked_at = null,
            last_error = null,
            updated_at = now()
        where public.appointment_reminders.status not in ('sent', 'failed');
    else
      update public.appointment_reminders
         set status = 'cancelled', locked_at = null, updated_at = now()
       where appointment_id = v_booking.id
         and channel = 'sms'
         and reminder_kind = 'second'
         and status in ('pending', 'processing');
    end if;
  end loop;
end;
$$;

-- Po sync profilu z szablonów — od razu uzupełnij kolejkę wizyt.
create or replace function public.sync_business_profile_reminders_from_templates(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_minutes integer := 1440;
  v_second_minutes integer := 120;
  v_second_timing integer;
  v_first_sms boolean := true;
  v_first_email boolean := true;
  v_second_sms boolean := true;
  v_second_email boolean := true;
  v_has_first_sms boolean := false;
  v_has_first_email boolean := false;
  v_has_second_sms boolean := false;
  v_has_second_email boolean := false;
  v_channel text := 'both';
begin
  select max(timing_minutes_before) filter (where type::text = 'reminder_24h')
    into v_first_minutes
    from public.message_templates
   where business_id = p_business_id;
  v_first_minutes := coalesce(v_first_minutes, 1440);

  select max(timing_minutes_before) filter (where type::text = 'reminder_before_visit')
    into v_second_timing
    from public.message_templates
   where business_id = p_business_id;

  select exists(
           select 1 from public.message_templates
            where business_id = p_business_id and type::text = 'reminder_24h' and channel = 'sms'
         ),
         exists(
           select 1 from public.message_templates
            where business_id = p_business_id and type::text = 'reminder_24h' and channel = 'email'
         ),
         exists(
           select 1 from public.message_templates
            where business_id = p_business_id and type::text = 'reminder_before_visit' and channel = 'sms'
         ),
         exists(
           select 1 from public.message_templates
            where business_id = p_business_id and type::text = 'reminder_before_visit' and channel = 'email'
         )
    into v_has_first_sms, v_has_first_email, v_has_second_sms, v_has_second_email;

  if v_has_first_sms then
    select coalesce(bool_or(status = 'active'), false)
      into v_first_sms
      from public.message_templates
     where business_id = p_business_id and type::text = 'reminder_24h' and channel = 'sms';
  end if;
  if v_has_first_email then
    select coalesce(bool_or(status = 'active'), false)
      into v_first_email
      from public.message_templates
     where business_id = p_business_id and type::text = 'reminder_24h' and channel = 'email';
  end if;
  if v_has_second_sms then
    select coalesce(bool_or(status = 'active'), false)
      into v_second_sms
      from public.message_templates
     where business_id = p_business_id and type::text = 'reminder_before_visit' and channel = 'sms';
  end if;
  if v_has_second_email then
    select coalesce(bool_or(status = 'active'), false)
      into v_second_email
      from public.message_templates
     where business_id = p_business_id and type::text = 'reminder_before_visit' and channel = 'email';
  end if;

  if v_second_timing is null then
    v_second_minutes := 120;
  elsif v_second_timing <= 0 then
    v_second_minutes := 0;
  elsif not v_second_sms and not v_second_email then
    v_second_minutes := 0;
  else
    v_second_minutes := v_second_timing;
  end if;

  if (v_first_sms or v_second_sms) and (v_first_email or v_second_email) then
    v_channel := 'both';
  elsif (v_first_sms or v_second_sms) then
    v_channel := 'sms';
  elsif (v_first_email or v_second_email) then
    v_channel := 'email';
  else
    v_channel := 'both';
  end if;

  update public.business_profiles
     set default_reminder_minutes = v_first_minutes,
         default_reminder_hours = greatest(1, (v_first_minutes + 59) / 60),
         second_reminder_minutes = v_second_minutes,
         reminder_channel = v_channel
   where id = p_business_id;

  perform public.sync_appointment_reminders_for_business(p_business_id);
end;
$$;

grant execute on function public.sync_appointment_reminders_for_business(uuid) to authenticated;
grant execute on function public.sync_appointment_reminders_for_business(uuid) to service_role;

-- Backfill: wszystkie firmy, wszystkie przyszłe wizyty.
do $$
declare
  r record;
begin
  for r in select id from public.business_profiles loop
    perform public.sync_business_profile_reminders_from_templates(r.id);
  end loop;
end;
$$;

-- Uprość trigger profilu — ta sama logika co sync_appointment_reminders_for_business.
create or replace function public.business_profiles_sync_reminder_settings ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel text;
  v_channel_has_email boolean;
  v_channel_has_sms boolean;
begin
  if tg_op = 'UPDATE'
     and new.default_reminder_minutes is not distinct from old.default_reminder_minutes
     and new.default_reminder_hours is not distinct from old.default_reminder_hours
     and new.second_reminder_minutes is not distinct from old.second_reminder_minutes
     and new.reminder_channel is not distinct from old.reminder_channel then
    return new;
  end if;

  v_channel := coalesce(new.reminder_channel, 'both');
  v_channel_has_email := v_channel in ('email', 'both');
  v_channel_has_sms   := v_channel in ('sms', 'both');

  if not v_channel_has_email then
    update public.appointment_reminders
       set status = 'cancelled', locked_at = null, updated_at = now()
     where business_id = new.id
       and channel = 'email'
       and status in ('pending', 'processing');
  end if;

  if not v_channel_has_sms then
    update public.appointment_reminders
       set status = 'cancelled', locked_at = null, updated_at = now()
     where business_id = new.id
       and channel = 'sms'
       and status in ('pending', 'processing');
  end if;

  if coalesce(new.second_reminder_minutes, 0) = 0 then
    update public.appointment_reminders
       set status = 'cancelled', locked_at = null, updated_at = now()
     where business_id = new.id
       and reminder_kind = 'second'
       and status in ('pending', 'processing');
  end if;

  perform public.sync_appointment_reminders_for_business(new.id);
  return new;
end;
$$;
