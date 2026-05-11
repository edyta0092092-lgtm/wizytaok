-- Etap 1 / dopisanie: blokujemy tworzenie second e-mail remindera, gdy jego
-- czas wypada wcześniej lub równo z first reminderem (=> w praktyce klient
-- dostawał dwa identyczne maile pod rząd).
--
-- Co robimy:
--   1) CREATE OR REPLACE FUNCTION public.bookings_sync_appointment_reminders
--      — dorzucamy warunek `v_second_scheduled > v_first_scheduled`.
--      Jeżeli warunki dla second nie są spełnione, ewentualny istniejący
--      pending/processing 'second' tej wizyty trafia na status 'cancelled'
--      przez UPDATE (nigdy DELETE). `sent`/`failed`/`skipped`/`cancelled`
--      nie są zmieniane (są poza WHERE).
--   2) CREATE OR REPLACE FUNCTION public.business_profiles_sync_reminder_settings
--      — analogiczna bramka dla pętli po przyszłych wizytach firmy. Wszystko
--      filtrowane `where business_id = new.id`, więc firma A nie rusza B.
--   3) Backfill istniejących pendingów: tylko UPDATE → 'cancelled' dla wierszy
--      'second' gdzie `second.scheduled_for <= first.scheduled_for`. Sent /
--      failed / cancelled / skipped pomijamy. Brak DELETE.
--
-- Migracja jest idempotentna: `CREATE OR REPLACE FUNCTION` + UPDATE z
-- filtrami w WHERE; ponowne uruchomienie nie produkuje śmieci.
--
-- Nazwy trigerów (`bookings_sync_appointment_reminders_trg`,
-- `business_profiles_sync_reminder_settings_trg`) nie są ruszane —
-- `CREATE TRIGGER` z migracji 053/054 nadal wskazuje po nazwie na zaktualizowane
-- ciało funkcji.

-- ===========================================================================
-- 1) Trigger na `bookings` — sync kolejki, z bramką second > first
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
  v_should_have_second boolean;
begin
  -- 1) Anulowanie wizyty: pendingi → cancelled (bez DELETE).
  if tg_op = 'UPDATE' and new.status = 'cancelled' and (old.status is distinct from new.status) then
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

  -- 4) FIRST reminder (zachowanie bez zmian względem 053).
  if (v_channel in ('email', 'both'))
     and (new.client_email is not null and btrim(new.client_email) <> '')
     and v_first_scheduled > now() then
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
          updated_at = now();
  end if;

  -- 5) SECOND reminder — tworzymy tylko jeśli WSZYSTKIE warunki spełnione,
  --    w tym second_scheduled_for > first_scheduled_for (kluczowa zmiana 055).
  v_should_have_second :=
       v_second_minutes > 0
   and v_channel in ('email', 'both')
   and new.client_email is not null and btrim(new.client_email) <> ''
   and v_second_scheduled is not null
   and v_second_scheduled > v_first_scheduled
   and v_second_scheduled > now();

  if v_should_have_second then
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
          updated_at = now();
  else
    -- Jeżeli istniał wcześniej pending second, który teraz nie spełnia reguł
    -- (np. user zmienił first hours tak, że oba czasy wypadają tej samej godziny)
    -- — oznacz go jako 'cancelled'. Sent/failed/skipped/cancelled pomijamy.
    update public.appointment_reminders
       set status = 'cancelled', locked_at = null, updated_at = now()
     where appointment_id = new.id
       and channel = 'email'
       and reminder_kind = 'second'
       and status in ('pending', 'processing');
  end if;

  return new;
end;
$$;

-- ===========================================================================
-- 2) Trigger na `business_profiles` — reakcja na zmianę ustawień firmy
--    (przepisanie funkcji z 054 z dorzuconą bramką second > first).
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
  v_booking record;
  v_appointment_ts timestamptz;
  v_first_scheduled timestamptz;
  v_second_scheduled timestamptz;
  v_first_valid boolean;
  v_should_have_second boolean;
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

  -- (a) Kanał wyklucza e-mail -> wszystkie pendingi tej firmy oznacz cancelled.
  if v_channel not in ('email', 'both') then
    update public.appointment_reminders
       set status = 'cancelled', locked_at = null, updated_at = now()
     where business_id = new.id
       and channel = 'email'
       and status in ('pending', 'processing');
    return new;
  end if;

  -- (b) Drugi reminder wyłączony -> pending 'second' tej firmy -> cancelled.
  if v_second_minutes = 0 then
    update public.appointment_reminders
       set status = 'cancelled', locked_at = null, updated_at = now()
     where business_id = new.id
       and channel = 'email'
       and reminder_kind = 'second'
       and status in ('pending', 'processing');
  end if;

  -- (c) Iteruj po przyszłych wizytach tej firmy, przelicz first/second.
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
    v_first_valid     := v_first_scheduled > now();

    -- FIRST
    if v_first_valid then
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
      update public.appointment_reminders
         set status = 'cancelled', locked_at = null, updated_at = now()
       where appointment_id = v_booking.id
         and channel = 'email'
         and reminder_kind = 'first'
         and status in ('pending', 'processing');
    end if;

    -- SECOND
    if v_second_minutes > 0 then
      v_second_scheduled := v_appointment_ts - make_interval(mins => v_second_minutes);
      v_should_have_second :=
           v_second_scheduled is not null
       and v_second_scheduled > v_first_scheduled
       and v_second_scheduled > now();
    else
      v_should_have_second := false;
    end if;

    if v_should_have_second then
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
  end loop;

  return new;
end;
$$;

-- ===========================================================================
-- 3) Backfill: istniejące pendingi 'second', które dublują first.
--    Tylko UPDATE → 'cancelled'. Brak DELETE. Sent/failed/skipped pomijamy
--    bo nie wchodzą do WHERE (s.status in ('pending','processing')).
--    Filtr `s.appointment_id = f.appointment_id` zapewnia, że nigdy nie
--    przeskakujemy poza tę samą wizytę (czyli tę samą firmę).
-- ===========================================================================
update public.appointment_reminders s
   set status = 'cancelled', locked_at = null, updated_at = now()
  from public.appointment_reminders f
 where s.appointment_id = f.appointment_id
   and s.channel = 'email'
   and f.channel = 'email'
   and s.reminder_kind = 'second'
   and f.reminder_kind = 'first'
   and s.status in ('pending', 'processing')
   and s.scheduled_for <= f.scheduled_for;
