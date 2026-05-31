-- Naprawa: trigger nie anuluje przypomnień po minięciu scheduled_for.
-- Wcześniej warunek „v_first_scheduled > now()” po terminie wysyłki ustawiał status
-- appointment_reminders na cancelled zamiast zostawić pending dla crona.

-- Przywróć błędnie anulowane przypomnienia (termin minął, wizyta nadal w przyszłości).
update public.appointment_reminders ar
set
  status = 'pending',
  locked_at = null,
  last_error = null,
  attempts = 0,
  updated_at = now()
from public.bookings b
where ar.appointment_id = b.id
  and ar.status = 'cancelled'
  and b.status <> 'cancelled'
  and ar.sent_at is null
  and ar.scheduled_for <= now()
  and ((b.appointment_date::timestamp + b.appointment_time) at time zone 'Europe/Warsaw') > now();

create or replace function public.bookings_sync_appointment_reminders ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_minutes integer;
  v_second_minutes integer;
  v_channel text;
  v_first_scheduled timestamptz;
  v_second_scheduled timestamptz;
  v_appointment_ts timestamptz;
  v_has_email boolean;
  v_has_phone boolean;
  v_has_confirmation_token boolean;
  v_channel_has_email boolean;
  v_channel_has_sms boolean;
  v_first_email_ok boolean;
  v_second_email_ok boolean;
  v_first_sms_ok boolean;
  v_second_sms_ok boolean;
begin
  if tg_op = 'UPDATE'
     and new.status = 'cancelled'
     and (old.status is distinct from new.status) then
    update public.appointment_reminders
       set status = 'cancelled', updated_at = now()
     where appointment_id = new.id
       and status in ('pending', 'processing');
    return new;
  end if;

  if new.status = 'cancelled' then
    return new;
  end if;

  select coalesce(default_reminder_minutes, coalesce(default_reminder_hours, 24) * 60),
         coalesce(second_reminder_minutes, 0),
         coalesce(reminder_channel, 'both')
    into v_default_minutes, v_second_minutes, v_channel
    from public.business_profiles
   where id = new.business_id;

  v_default_minutes := coalesce(v_default_minutes, 1440);
  v_second_minutes := coalesce(v_second_minutes, 0);
  v_channel := coalesce(v_channel, 'both');

  v_appointment_ts := ((new.appointment_date::timestamp + new.appointment_time)
                       at time zone 'Europe/Warsaw');
  v_first_scheduled := v_appointment_ts - make_interval(mins => v_default_minutes);
  if v_second_minutes > 0 then
    v_second_scheduled := v_appointment_ts - make_interval(mins => v_second_minutes);
  end if;

  v_has_email := new.client_email is not null and btrim(new.client_email) <> '';
  v_has_phone := new.client_phone is not null and btrim(new.client_phone) <> '';
  v_has_confirmation_token :=
    new.confirmation_token is not null
    and btrim(new.confirmation_token::text) <> '';
  v_channel_has_email := v_channel in ('email', 'both');
  v_channel_has_sms   := v_channel in ('sms', 'both');

  v_first_email_ok :=
       v_channel_has_email
   and v_has_email
   and v_appointment_ts > now();

  if v_first_email_ok then
    insert into public.appointment_reminders
      (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
    values (new.business_id, new.id, 'email', 'first', v_first_scheduled, 'pending')
    on conflict (appointment_id, channel, reminder_kind) do update
      set scheduled_for = excluded.scheduled_for,
          status = case
            when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
            else 'pending'
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
     where appointment_id = new.id
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
   and v_appointment_ts > now();

  if v_second_email_ok then
    insert into public.appointment_reminders
      (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
    values (new.business_id, new.id, 'email', 'second', v_second_scheduled, 'pending')
    on conflict (appointment_id, channel, reminder_kind) do update
      set scheduled_for = excluded.scheduled_for,
          status = case
            when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
            else 'pending'
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
     where appointment_id = new.id
       and channel = 'email'
       and reminder_kind = 'second'
       and status in ('pending', 'processing');
  end if;

  v_first_sms_ok :=
       v_channel_has_sms
   and v_has_phone
   and v_has_confirmation_token
   and v_appointment_ts > now();

  if v_first_sms_ok then
    insert into public.appointment_reminders
      (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
    values (new.business_id, new.id, 'sms', 'first', v_first_scheduled, 'pending')
    on conflict (appointment_id, channel, reminder_kind) do update
      set scheduled_for = excluded.scheduled_for,
          status = case
            when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
            else 'pending'
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
     where appointment_id = new.id
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
   and v_appointment_ts > now();

  if v_second_sms_ok then
    insert into public.appointment_reminders
      (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
    values (new.business_id, new.id, 'sms', 'second', v_second_scheduled, 'pending')
    on conflict (appointment_id, channel, reminder_kind) do update
      set scheduled_for = excluded.scheduled_for,
          status = case
            when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
            else 'pending'
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
     where appointment_id = new.id
       and channel = 'sms'
       and reminder_kind = 'second'
       and status in ('pending', 'processing');
  end if;

  return new;
end;
$$;

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
     and v_appointment_ts > now();

    if v_first_email_ok then
      insert into public.appointment_reminders
        (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
      values (p_business_id, v_booking.id, 'email', 'first', v_first_scheduled, 'pending')
      on conflict (appointment_id, channel, reminder_kind) do update
        set scheduled_for = excluded.scheduled_for,
            status = case
              when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
              else 'pending'
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
     and v_appointment_ts > now();

    if v_second_email_ok then
      insert into public.appointment_reminders
        (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
      values (p_business_id, v_booking.id, 'email', 'second', v_second_scheduled, 'pending')
      on conflict (appointment_id, channel, reminder_kind) do update
        set scheduled_for = excluded.scheduled_for,
            status = case
              when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
              else 'pending'
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
     and v_appointment_ts > now();

    if v_first_sms_ok then
      insert into public.appointment_reminders
        (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
      values (p_business_id, v_booking.id, 'sms', 'first', v_first_scheduled, 'pending')
      on conflict (appointment_id, channel, reminder_kind) do update
        set scheduled_for = excluded.scheduled_for,
            status = case
              when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
              else 'pending'
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
     and v_appointment_ts > now();

    if v_second_sms_ok then
      insert into public.appointment_reminders
        (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
      values (p_business_id, v_booking.id, 'sms', 'second', v_second_scheduled, 'pending')
      on conflict (appointment_id, channel, reminder_kind) do update
        set scheduled_for = excluded.scheduled_for,
            status = case
              when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
              else 'pending'
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
