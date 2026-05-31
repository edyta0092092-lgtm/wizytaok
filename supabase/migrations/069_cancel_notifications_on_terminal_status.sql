-- Anuluj oczekujące SMS/e-mail przy statusach końcowych wizyty:
-- cancelled, completed, no_show.

create or replace function public.cancel_pending_booking_notifications(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.appointment_reminders
     set status = 'cancelled',
         locked_at = null,
         last_error = null,
         updated_at = now()
   where appointment_id = p_appointment_id
     and status in ('pending', 'processing');

  update public.custom_template_sends
     set status = 'skipped',
         skipped_at = now(),
         locked_at = null,
         last_error = null,
         updated_at = now()
   where appointment_id = p_appointment_id
     and status in ('pending', 'processing');

  update public.notification_logs
     set status = 'skipped'
   where booking_id = p_appointment_id
     and status in ('pending', 'queued');

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'first_reminder_status'
  ) then
    update public.bookings
       set first_reminder_status = 'skipped'
     where id = p_appointment_id
       and first_reminder_status = 'pending';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'second_reminder_status'
  ) then
    update public.bookings
       set second_reminder_status = 'skipped'
     where id = p_appointment_id
       and second_reminder_status = 'pending';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'reminder_status'
  ) then
    update public.bookings
       set reminder_status = 'skipped'
     where id = p_appointment_id
       and reminder_status = 'pending';
  end if;
end;
$$;

create or replace function public.bookings_cancel_pending_notifications_on_terminal_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status in ('cancelled', 'completed', 'no_show')
     and old.status is distinct from new.status then
    perform public.cancel_pending_booking_notifications(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_cancel_pending_notifications_trg on public.bookings;
create trigger bookings_cancel_pending_notifications_trg
  after update of status
  on public.bookings
  for each row execute function public.bookings_cancel_pending_notifications_on_terminal_status();

-- Nie planuj przypomnień dla wizyt w statusie końcowym (wcześniej tylko cancelled).
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
  if new.status in ('cancelled', 'completed', 'no_show') then
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

-- sync_appointment_reminders_for_business: pomiń wizyty w statusie końcowym
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
       and status not in ('cancelled', 'completed', 'no_show')
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

-- business_profiles_sync_reminder_settings: ten sam filtr statusów
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
       and status not in ('cancelled', 'completed', 'no_show')
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

-- Backfill: wizyty już zamknięte z oczekującymi wysyłkami
do $$
declare
  v_booking_id uuid;
begin
  for v_booking_id in
    select id from public.bookings where status in ('cancelled', 'completed', 'no_show')
  loop
    perform public.cancel_pending_booking_notifications(v_booking_id);
  end loop;
end;
$$;
