-- Dokończenie fixu z 066: business_profiles_sync_reminder_settings nadal używało
-- v_first_scheduled > now() i nie odtwarzało SMS po terminie wysyłki.

-- Przywróć / utrzymaj SMS w kolejce, gdy e-mail 24h już poszedł, a SMS jeszcze nie.
update public.appointment_reminders sms
set
  status = 'pending',
  locked_at = null,
  last_error = null,
  attempts = 0,
  updated_at = now()
from public.appointment_reminders email,
     public.bookings b
where sms.appointment_id = email.appointment_id
  and sms.appointment_id = b.id
  and sms.reminder_kind = 'first'
  and sms.channel = 'sms'
  and email.reminder_kind = 'first'
  and email.channel = 'email'
  and email.status = 'sent'
  and sms.sent_at is null
  and sms.status in ('cancelled', 'skipped', 'pending', 'failed')
  and sms.scheduled_for <= now()
  and b.status <> 'cancelled'
  and b.client_phone is not null
  and btrim(b.client_phone) <> ''
  and b.confirmation_token is not null
  and btrim(b.confirmation_token::text) <> ''
  and ((b.appointment_date::timestamp + b.appointment_time) at time zone 'Europe/Warsaw') > now();

-- Brakujące wiersze SMS (bywa, gdy wcześniej kolejka miała tylko e-mail).
insert into public.appointment_reminders
  (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
select
  b.business_id,
  b.id,
  'sms',
  'first',
  email.scheduled_for,
  'pending'
from public.bookings b
join public.appointment_reminders email
  on email.appointment_id = b.id
 and email.channel = 'email'
 and email.reminder_kind = 'first'
join public.business_profiles bp on bp.id = b.business_id
where b.status <> 'cancelled'
  and coalesce(bp.reminder_channel, 'both') in ('sms', 'both')
  and b.client_phone is not null
  and btrim(b.client_phone) <> ''
  and b.confirmation_token is not null
  and btrim(b.confirmation_token::text) <> ''
  and ((b.appointment_date::timestamp + b.appointment_time) at time zone 'Europe/Warsaw') > now()
  and email.scheduled_for <= now()
  and not exists (
    select 1
      from public.appointment_reminders existing
     where existing.appointment_id = b.id
       and existing.channel = 'sms'
       and existing.reminder_kind = 'first'
  )
on conflict (appointment_id, channel, reminder_kind) do update
  set scheduled_for = excluded.scheduled_for,
      status = case
        when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
        else 'pending'
      end,
      attempts = 0,
      locked_at = null,
      last_error = null,
      updated_at = now()
  where public.appointment_reminders.status not in ('sent', 'failed');

create or replace function public.business_profiles_sync_reminder_settings ()
returns trigger
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
  if tg_op = 'UPDATE'
     and new.default_reminder_minutes is not distinct from old.default_reminder_minutes
     and new.default_reminder_hours is not distinct from old.default_reminder_hours
     and new.second_reminder_minutes is not distinct from old.second_reminder_minutes
     and new.reminder_channel is not distinct from old.reminder_channel then
    return new;
  end if;

  v_default_minutes := coalesce(new.default_reminder_minutes, coalesce(new.default_reminder_hours, 24) * 60);
  v_second_minutes := coalesce(new.second_reminder_minutes, 0);
  v_channel        := coalesce(new.reminder_channel, 'both');
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

  if v_second_minutes = 0 then
    update public.appointment_reminders
       set status = 'cancelled', locked_at = null, updated_at = now()
     where business_id = new.id
       and reminder_kind = 'second'
       and status in ('pending', 'processing');
  end if;

  if not v_channel_has_email and not v_channel_has_sms then
    return new;
  end if;

  for v_booking in
    select id,
           appointment_date,
           appointment_time,
           client_email,
           client_phone,
           confirmation_token
      from public.bookings
     where business_id = new.id
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
      values (new.id, v_booking.id, 'email', 'first', v_first_scheduled, 'pending')
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
      values (new.id, v_booking.id, 'email', 'second', v_second_scheduled, 'pending')
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
      values (new.id, v_booking.id, 'sms', 'first', v_first_scheduled, 'pending')
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
      values (new.id, v_booking.id, 'sms', 'second', v_second_scheduled, 'pending')
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

  return new;
end;
$$;
