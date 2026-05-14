-- Etap 2: SMS reminders przez SMSAPI — rozszerzenie istniejących triggerów
-- o symetryczną obsługę `channel='sms'` obok `channel='email'`.
--
-- Co dodajemy:
--   1) CREATE OR REPLACE FUNCTION public.bookings_sync_appointment_reminders
--      — ścieżki SMS wymagają niepustego `confirmation_token` (e‑mail nie).
--      — SMS first/second tylko przy `reminder_channel ∈ ('sms','both')`,
--        niepustym `client_phone`, niepustym `confirmation_token`, `scheduled_for > now()`
--        oraz dla second: `v_second_scheduled > v_first_scheduled`.
--      — jeśli warunki padną, pending/processing SMS → `cancelled` (UPDATE). Bez DELETE.
--   2) DROP TRIGGER IF EXISTS + CREATE TRIGGER `bookings_sync_appointment_reminders_trg`
--      — AFTER UPDATE OF m.in. `client_phone`, `confirmation_token`.
--   3) CREATE OR REPLACE FUNCTION public.business_profiles_sync_reminder_settings
--      — pętla czyta `confirmation_token`; te same warunki co wyżej dla SMS.
--      — wszystko per `business_id` — firma A nie rusza reminderów firmy B.
--   4) Brak masowego backfillu SMS przy migracji — kolejka SMS powstaje tylko z
--      triggerów po nowych/zmienionych wizytach. Włączenie wysyłki kontroluje cron
--      (env `SMS_REMINDERS_ENABLED=true` w aplikacji), żeby uniknąć lawiny SMS po deployu.
--
-- POPRAWKA bezpieczeństwa (sent/failed):
--   Wszystkie `ON CONFLICT DO UPDATE` mają `WHERE appointment_reminders.status
--   NOT IN ('sent','failed')` — wtedy żadna kolumna istniejącego wiersza
--   sent/failed nie jest modyfikowana (w tym scheduled_for, locked_at, last_error,
--   attempts, updated_at).
--
-- Bezpieczeństwo (zakazy spełnione):
--   * brak DROP TABLE
--   * brak TRUNCATE
--   * brak DELETE FROM
--   * brak destrukcyjnych ALTER (zero ALTER COLUMN, zero zmian typu/notnull
--     istniejących kolumn)
--   * brak DROP FUNCTION
--   * zero zmian w Stripe, webhooku Stripe, Auth, rejestracji, rolach, trial flow
--   * zero zmian w tabelach `bookings`, `clients`, `services`, `staff_members`,
--     `business_members`, `business_profiles` poza CREATE OR REPLACE funkcji
--     triggera (nazwy triggerów nieruszane)
--
-- Tabela `appointment_reminders` (mig. 053):
--   * `channel ∈ ('email','sms')`, unique `(appointment_id, channel, reminder_kind)`.

-- ===========================================================================
-- 1) Trigger na `bookings` — sync kolejki dla email + sms
-- ===========================================================================
create or replace function public.bookings_sync_appointment_reminders ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_hours integer;
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
  -- 1) Anulowanie wizyty: pendingi (oba kanały) -> cancelled. Bez DELETE.
  if tg_op = 'UPDATE'
     and new.status = 'cancelled'
     and (old.status is distinct from new.status) then
    update public.appointment_reminders
       set status = 'cancelled', updated_at = now()
     where appointment_id = new.id
       and status in ('pending', 'processing');
    return new;
  end if;

  -- 2) Wizyta już anulowana — nie planujemy nowych przypomnień.
  if new.status = 'cancelled' then
    return new;
  end if;

  -- 3) Ustawienia firmy (default 24h, drugie wyłączone, kanał 'both').
  select coalesce(default_reminder_hours, 24),
         coalesce(second_reminder_minutes, 0),
         coalesce(reminder_channel, 'both')
    into v_default_hours, v_second_minutes, v_channel
    from public.business_profiles
   where id = new.business_id;

  v_default_hours  := coalesce(v_default_hours, 24);
  v_second_minutes := coalesce(v_second_minutes, 0);
  v_channel        := coalesce(v_channel, 'both');

  v_appointment_ts := ((new.appointment_date::timestamp + new.appointment_time)
                       at time zone 'Europe/Warsaw');
  v_first_scheduled := v_appointment_ts - make_interval(hours => v_default_hours);
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

  -- ------------------------------------------------------------------------
  -- 4) EMAIL — first / second (bez wymogu confirmation_token).
  -- ------------------------------------------------------------------------
  v_first_email_ok :=
       v_channel_has_email
   and v_has_email
   and v_first_scheduled > now();

  if v_first_email_ok then
    insert into public.appointment_reminders
      (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
    values (new.business_id, new.id, 'email', 'first', v_first_scheduled, 'pending')
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
   and v_second_scheduled > now();

  if v_second_email_ok then
    insert into public.appointment_reminders
      (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
    values (new.business_id, new.id, 'email', 'second', v_second_scheduled, 'pending')
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
     where appointment_id = new.id
       and channel = 'email'
       and reminder_kind = 'second'
       and status in ('pending', 'processing');
  end if;

  -- ------------------------------------------------------------------------
  -- 5) SMS — wymaga client_phone + confirmation_token (jak manageUrl w cronie).
  -- ------------------------------------------------------------------------
  v_first_sms_ok :=
       v_channel_has_sms
   and v_has_phone
   and v_has_confirmation_token
   and v_first_scheduled > now();

  if v_first_sms_ok then
    insert into public.appointment_reminders
      (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
    values (new.business_id, new.id, 'sms', 'first', v_first_scheduled, 'pending')
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
   and v_second_scheduled > now();

  if v_second_sms_ok then
    insert into public.appointment_reminders
      (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
    values (new.business_id, new.id, 'sms', 'second', v_second_scheduled, 'pending')
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
     where appointment_id = new.id
       and channel = 'sms'
       and reminder_kind = 'second'
       and status in ('pending', 'processing');
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_sync_appointment_reminders_trg on public.bookings;
create trigger bookings_sync_appointment_reminders_trg
  after insert or update of
    appointment_date,
    appointment_time,
    status,
    business_id,
    client_email,
    client_phone,
    confirmation_token
  on public.bookings
  for each row execute function public.bookings_sync_appointment_reminders ();

-- ===========================================================================
-- 2) Trigger na `business_profiles` — reakcja na zmianę ustawień firmy
-- ===========================================================================
create or replace function public.business_profiles_sync_reminder_settings ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_hours integer;
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
     and new.default_reminder_hours is not distinct from old.default_reminder_hours
     and new.second_reminder_minutes is not distinct from old.second_reminder_minutes
     and new.reminder_channel is not distinct from old.reminder_channel then
    return new;
  end if;

  v_default_hours  := coalesce(new.default_reminder_hours, 24);
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
    v_first_scheduled := v_appointment_ts - make_interval(hours => v_default_hours);
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
      values (new.id, v_booking.id, 'email', 'first', v_first_scheduled, 'pending')
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
      values (new.id, v_booking.id, 'email', 'second', v_second_scheduled, 'pending')
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
      values (new.id, v_booking.id, 'sms', 'first', v_first_scheduled, 'pending')
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
      values (new.id, v_booking.id, 'sms', 'second', v_second_scheduled, 'pending')
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

  return new;
end;
$$;

-- ===========================================================================
-- 3) (Usunięte) Backfill SMS — celowo brak masowego INSERT przy migracji.
--     SMS reminders dla istniejących wizyt NIE są tworzone tutaj (MVP / bezpieczeństwo
--     produkcyjne). Wiersze `channel='sms'` pojawiają się wyłącznie z triggerów
--     po insert/update bookingu lub zmianie ustawień firmy. Wysyłkę SMS steruje
--     dodatkowo aplikacja: `SMS_REMINDERS_ENABLED=true` w cronie send-reminders.
-- ===========================================================================
