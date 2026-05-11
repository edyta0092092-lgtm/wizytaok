-- Etap 1: e-mailowe przypomnienia o wizytach (kolejka + DB trigger).
--
-- Tabela `appointment_reminders` jest addytywna względem starego mechanizmu
-- (kolumn `*_reminder_due_at` na `bookings` oraz tabeli `notification_logs`).
-- Nic nie usuwamy, nie modyfikujemy destrukcyjnie istniejących obiektów.
-- Konwencja czasu — taka sama jak w `bookings_sync_reminder_schedule_trg`
-- (mig. 015): `(appointment_date::timestamp + appointment_time) at time zone 'Europe/Warsaw'`.

create table if not exists public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  appointment_id uuid not null references public.bookings (id) on delete cascade,
  channel text not null,
  reminder_kind text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  locked_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  skipped_at timestamptz,
  provider text,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Constrainty dorzucamy `add … if not exists`-style, żeby migracja była idempotentna.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointment_reminders_channel_chk'
  ) then
    alter table public.appointment_reminders
      add constraint appointment_reminders_channel_chk
      check (channel in ('email', 'sms'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'appointment_reminders_kind_chk'
  ) then
    alter table public.appointment_reminders
      add constraint appointment_reminders_kind_chk
      check (reminder_kind in ('first', 'second'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'appointment_reminders_status_chk'
  ) then
    alter table public.appointment_reminders
      add constraint appointment_reminders_status_chk
      check (status in ('pending', 'processing', 'sent', 'failed', 'skipped', 'cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'appointment_reminders_attempts_chk'
  ) then
    alter table public.appointment_reminders
      add constraint appointment_reminders_attempts_chk
      check (attempts >= 0);
  end if;
end$$;

-- Idempotencja: jedna (appointment, channel, kind) para = jeden reminder
create unique index if not exists appointment_reminders_appt_channel_kind_uidx
  on public.appointment_reminders (appointment_id, channel, reminder_kind);

-- Cron scan: szybkie pickowanie pending/processing rekordów wg czasu
create index if not exists appointment_reminders_status_scheduled_idx
  on public.appointment_reminders (status, scheduled_for);

-- Filtrowanie per business (RLS, panele admina)
create index if not exists appointment_reminders_business_id_idx
  on public.appointment_reminders (business_id);

-- updated_at touch trigger
create or replace function public.appointment_reminders_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists appointment_reminders_set_updated_at_trg on public.appointment_reminders;
create trigger appointment_reminders_set_updated_at_trg
before update on public.appointment_reminders
for each row execute function public.appointment_reminders_set_updated_at();

-- RLS: członkowie firmy mogą czytać własne, mutacje wyłącznie service role
alter table public.appointment_reminders enable row level security;

drop policy if exists "appointment_reminders_select_own" on public.appointment_reminders;
create policy "appointment_reminders_select_own"
  on public.appointment_reminders for select to authenticated
  using (public.is_business_member_active (business_id));

-- Brak polityk insert/update/delete dla authenticated — wpisy wykonuje tylko
-- service role (cron, trigger DB security definer). To samo podejście co przy
-- `notification_logs` (mig. 012).

-- ===========================================================================
-- Synchronizacja stanu kolejki z `bookings` (insert/edycja/anulowanie).
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
begin
  -- 1) Anulowanie: pendingi → cancelled (bez DELETE).
  if tg_op = 'UPDATE' and new.status = 'cancelled' and (old.status is distinct from new.status) then
    update public.appointment_reminders
      set status = 'cancelled', updated_at = now()
      where appointment_id = new.id
        and status in ('pending', 'processing');
    return new;
  end if;

  -- 2) Jeśli wizyta cancelled — nie planujemy nowych.
  if new.status = 'cancelled' then
    return new;
  end if;

  -- 3) Wczytaj ustawienia firmy (default 24h, drugie wyłączone, kanał 'both').
  select coalesce(default_reminder_hours, 24),
         coalesce(second_reminder_minutes, 0),
         coalesce(reminder_channel, 'both')
    into v_default_hours, v_second_minutes, v_channel
    from public.business_profiles
    where id = new.business_id;

  v_default_hours := coalesce(v_default_hours, 24);
  v_second_minutes := coalesce(v_second_minutes, 0);
  v_channel := coalesce(v_channel, 'both');

  -- 4) Moment wizyty w UTC (Europe/Warsaw → UTC).
  v_appointment_ts := ((new.appointment_date::timestamp + new.appointment_time)
                       at time zone 'Europe/Warsaw');
  v_first_scheduled := v_appointment_ts - make_interval(hours => v_default_hours);
  if v_second_minutes > 0 then
    v_second_scheduled := v_appointment_ts - make_interval(mins => v_second_minutes);
  end if;

  -- 5) FIRST reminder: e-mail, jeżeli kanał obejmuje email i klient ma e-mail.
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

  -- 6) SECOND reminder (jeśli ustawiony, > 0 minut).
  if v_second_minutes > 0
     and (v_channel in ('email', 'both'))
     and (new.client_email is not null and btrim(new.client_email) <> '')
     and v_second_scheduled > now() then
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
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_sync_appointment_reminders_trg on public.bookings;
create trigger bookings_sync_appointment_reminders_trg
  after insert or update of appointment_date, appointment_time, status, business_id, client_email
  on public.bookings
  for each row execute function public.bookings_sync_appointment_reminders ();
