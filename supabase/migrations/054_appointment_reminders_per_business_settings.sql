-- Etap 1 / dopisanie: reakcja na zmianę per-business ustawień przypomnień.
--
-- Co dodajemy:
--   0) Idempotentne dorzucenie kolumn ustawień przypomnień do `business_profiles`
--      (jeżeli wcześniejsza migracja ich nie założyła) — czysto `ADD COLUMN
--      IF NOT EXISTS` + `ADD CONSTRAINT IF NOT EXISTS` przez `DO`. Bez `ALTER
--      COLUMN`, bez modyfikacji istniejących wartości, bez `DELETE`/`TRUNCATE`.
--   1) Trigger AFTER UPDATE OF (default_reminder_hours, second_reminder_minutes,
--      reminder_channel) na `business_profiles`, który zaktualizuje WYŁĄCZNIE
--      przyszłe pendingi tej firmy (NIE rusza wierszy ze statusem `sent`/`failed`,
--      NIE używa DELETE — używa UPDATE / INSERT … ON CONFLICT).
--   2) Backfill: dla istniejących przyszłych wizyt (które powstały przed 053)
--      tworzymy pending e-mail remindery wg aktualnych ustawień firmy
--      — wszystko per business_id, jedna firma nigdy nie patrzy na ustawienia innej.
--
-- SMS celowo na razie nie obsługujemy — kolumna `channel` dopuszcza 'sms',
-- ale ani trigger ani backfill nie tworzy SMS-owych wierszy. Etap 2.

-- ---------------------------------------------------------------------------
-- 0) Bezpieczne, addytywne kolumny ustawień przypomnień na `business_profiles`.
--    Wszystko jest `IF NOT EXISTS`, więc na bazach które już mają te kolumny
--    operacja jest no-opem. NIE modyfikujemy istniejących wartości ani danych.
-- ---------------------------------------------------------------------------
alter table public.business_profiles
  add column if not exists default_reminder_hours integer not null default 24;

alter table public.business_profiles
  add column if not exists second_reminder_minutes integer not null default 0;

alter table public.business_profiles
  add column if not exists reminder_channel text not null default 'email';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'business_profiles_default_reminder_hours_chk'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_default_reminder_hours_chk
      check (default_reminder_hours >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'business_profiles_second_reminder_minutes_chk'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_second_reminder_minutes_chk
      check (second_reminder_minutes >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'business_profiles_reminder_channel_chk'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_reminder_channel_chk
      check (reminder_channel in ('email', 'sms', 'both', 'none'));
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- 1) Trigger na zmianę ustawień przypomnień firmy
-- ---------------------------------------------------------------------------
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
  v_booking record;
  v_appointment_ts timestamptz;
  v_first_scheduled timestamptz;
  v_second_scheduled timestamptz;
begin
  -- Bez zmian w trzech polach -> nic nie rób.
  if tg_op = 'UPDATE'
     and new.default_reminder_hours is not distinct from old.default_reminder_hours
     and new.second_reminder_minutes is not distinct from old.second_reminder_minutes
     and new.reminder_channel is not distinct from old.reminder_channel then
    return new;
  end if;

  v_default_hours  := coalesce(new.default_reminder_hours, 24);
  v_second_minutes := coalesce(new.second_reminder_minutes, 0);
  v_channel        := coalesce(new.reminder_channel, 'both');

  -- (a) Jeżeli kanał wyklucza e-mail -> wszystkie pendingi tej firmy oznacz cancelled (UPDATE, nie DELETE)
  if v_channel not in ('email', 'both') then
    update public.appointment_reminders
       set status = 'cancelled', locked_at = null, updated_at = now()
     where business_id = new.id
       and channel = 'email'
       and status in ('pending', 'processing');
    return new;
  end if;

  -- (b) Jeżeli drugi reminder wyłączony -> pending 'second' tej firmy -> cancelled
  if v_second_minutes = 0 then
    update public.appointment_reminders
       set status = 'cancelled', locked_at = null, updated_at = now()
     where business_id = new.id
       and channel = 'email'
       and reminder_kind = 'second'
       and status in ('pending', 'processing');
  end if;

  -- (c) Dla każdej przyszłej, nieanulowanej wizyty tej firmy z e-mailem klienta:
  --     przelicz scheduled_for dla 'first' (i 'second' jeśli włączony).
  for v_booking in
    select id, appointment_date, appointment_time, client_email
      from public.bookings
     where business_id = new.id
       and status <> 'cancelled'
       and client_email is not null
       and btrim(client_email) <> ''
       and ((appointment_date::timestamp + appointment_time) at time zone 'Europe/Warsaw') > now()
  loop
    v_appointment_ts := ((v_booking.appointment_date::timestamp + v_booking.appointment_time)
                         at time zone 'Europe/Warsaw');
    v_first_scheduled := v_appointment_ts - make_interval(hours => v_default_hours);

    -- FIRST
    if v_first_scheduled > now() then
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
            updated_at = now();
    else
      -- Po przesunięciu nowy czas wypada w przeszłości — kasujemy pending (sent zostaje sent).
      update public.appointment_reminders
         set status = 'cancelled', locked_at = null, updated_at = now()
       where appointment_id = v_booking.id
         and channel = 'email'
         and reminder_kind = 'first'
         and status in ('pending', 'processing');
    end if;

    -- SECOND (tylko jeśli włączony)
    if v_second_minutes > 0 then
      v_second_scheduled := v_appointment_ts - make_interval(mins => v_second_minutes);
      if v_second_scheduled > now() then
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
              updated_at = now();
      else
        update public.appointment_reminders
           set status = 'cancelled', locked_at = null, updated_at = now()
         where appointment_id = v_booking.id
           and channel = 'email'
           and reminder_kind = 'second'
           and status in ('pending', 'processing');
      end if;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists business_profiles_sync_reminder_settings_trg on public.business_profiles;
create trigger business_profiles_sync_reminder_settings_trg
  after update of default_reminder_hours, second_reminder_minutes, reminder_channel
  on public.business_profiles
  for each row execute function public.business_profiles_sync_reminder_settings ();

-- ---------------------------------------------------------------------------
-- 2) Backfill dla wizyt, które powstały przed migracją 053.
--    Czysto INSERT … ON CONFLICT DO NOTHING. Nigdy nie nadpisujemy istniejących
--    wierszy, nigdy nic nie kasujemy. Filtrowane per business_id przez JOIN.
-- ---------------------------------------------------------------------------
do $$
declare
  v_now timestamptz := now();
  b record;
  v_appointment_ts timestamptz;
  v_first_scheduled timestamptz;
  v_second_scheduled timestamptz;
begin
  for b in
    select bk.id as booking_id,
           bk.business_id,
           bk.appointment_date,
           bk.appointment_time,
           coalesce(bp.default_reminder_hours, 24) as default_hours,
           coalesce(bp.second_reminder_minutes, 0) as second_min,
           coalesce(bp.reminder_channel, 'both')    as channel
      from public.bookings bk
      join public.business_profiles bp on bp.id = bk.business_id
     where bk.status <> 'cancelled'
       and bk.client_email is not null
       and btrim(bk.client_email) <> ''
       and ((bk.appointment_date::timestamp + bk.appointment_time) at time zone 'Europe/Warsaw') > v_now
  loop
    if b.channel not in ('email','both') then
      continue;
    end if;

    v_appointment_ts := ((b.appointment_date::timestamp + b.appointment_time)
                          at time zone 'Europe/Warsaw');
    v_first_scheduled := v_appointment_ts - make_interval(hours => b.default_hours);

    if v_first_scheduled > v_now then
      insert into public.appointment_reminders
        (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
      values (b.business_id, b.booking_id, 'email', 'first', v_first_scheduled, 'pending')
      on conflict (appointment_id, channel, reminder_kind) do nothing;
    end if;

    if b.second_min > 0 then
      v_second_scheduled := v_appointment_ts - make_interval(mins => b.second_min);
      if v_second_scheduled > v_now then
        insert into public.appointment_reminders
          (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
        values (b.business_id, b.booking_id, 'email', 'second', v_second_scheduled, 'pending')
        on conflict (appointment_id, channel, reminder_kind) do nothing;
      end if;
    end if;
  end loop;
end$$;
