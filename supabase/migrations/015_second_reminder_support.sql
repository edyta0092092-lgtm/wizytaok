-- Drugie przypomnienie przed wizytą (krótkie) + kompatybilność ze starym reminder_*.
-- Bez migracji destrukcyjnych.

alter table public.business_profiles
add column if not exists second_reminder_minutes integer not null default 120;

alter table public.business_profiles
drop constraint if exists business_profiles_second_reminder_minutes_chk;

alter table public.business_profiles
add constraint business_profiles_second_reminder_minutes_chk check (
  second_reminder_minutes in (0, 30, 60, 120, 180)
);

comment on column public.business_profiles.second_reminder_minutes is '0 = disabled, otherwise minutes before appointment for second short reminder.';

alter table public.bookings
add column if not exists first_reminder_due_at timestamptz,
add column if not exists first_reminder_sent_at timestamptz,
add column if not exists first_reminder_status text,
add column if not exists second_reminder_due_at timestamptz,
add column if not exists second_reminder_sent_at timestamptz,
add column if not exists second_reminder_status text,
add column if not exists second_reminder_error text;

alter table public.bookings
drop constraint if exists bookings_first_reminder_status_chk;

alter table public.bookings
add constraint bookings_first_reminder_status_chk check (
  first_reminder_status is null
  or first_reminder_status in (
    'pending',
    'sent',
    'failed',
    'skipped',
    'simulated',
    'pending_message_mock',
    'simulated_dev',
    'not_configured',
    'disabled'
  )
);

alter table public.bookings
drop constraint if exists bookings_second_reminder_status_chk;

alter table public.bookings
add constraint bookings_second_reminder_status_chk check (
  second_reminder_status is null
  or second_reminder_status in (
    'pending',
    'sent',
    'failed',
    'skipped',
    'simulated',
    'pending_message_mock',
    'simulated_dev',
    'not_configured',
    'disabled'
  )
);

create or replace function public.booking_compute_second_reminder_due_at (
  p_date date,
  p_time time,
  p_minutes integer
)
returns timestamptz
language sql
immutable
as $$
  select case
    when p_minutes is null or p_minutes <= 0 then null
    else (p_date::timestamp + p_time) - make_interval(mins => p_minutes)
  end;
$$;

create or replace function public.bookings_sync_reminder_schedule ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_hours integer := 24;
  v_second_minutes integer := 120;
  schedule_changed boolean := false;
begin
  if tg_op = 'INSERT' then
    schedule_changed := true;
  elsif tg_op = 'UPDATE' then
    schedule_changed := (
      new.appointment_date is distinct from old.appointment_date
      or new.appointment_time is distinct from old.appointment_time
      or new.business_id is distinct from old.business_id
    );
  end if;

  if schedule_changed then
    select coalesce(bp.default_reminder_hours, 24), coalesce(bp.second_reminder_minutes, 120)
      into v_first_hours, v_second_minutes
    from public.business_profiles bp
    where bp.id = new.business_id
    limit 1;

    new.first_reminder_due_at := (new.appointment_date::timestamp + new.appointment_time) - make_interval(hours => coalesce(v_first_hours, 24));
    new.first_reminder_sent_at := null;
    new.first_reminder_status := 'pending';

    new.second_reminder_due_at := public.booking_compute_second_reminder_due_at(
      new.appointment_date,
      new.appointment_time,
      v_second_minutes
    );
    new.second_reminder_sent_at := null;
    new.second_reminder_error := null;
    if v_second_minutes <= 0 then
      new.second_reminder_status := 'disabled';
    else
      new.second_reminder_status := 'pending';
    end if;
  end if;

  -- Kompatybilność: stare kolumny nadal reprezentują pierwsze przypomnienie.
  if new.first_reminder_due_at is not null then
    new.reminder_due_at := new.first_reminder_due_at;
  end if;
  if new.first_reminder_sent_at is not null or new.first_reminder_sent_at is null then
    new.reminder_sent_at := new.first_reminder_sent_at;
  end if;
  if new.first_reminder_status is not null then
    new.reminder_status := new.first_reminder_status;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_sync_reminder_schedule_trg on public.bookings;

create trigger bookings_sync_reminder_schedule_trg
before insert or update on public.bookings
for each row
execute function public.bookings_sync_reminder_schedule();

-- Backfill obecnych danych bez niszczenia starych pól.
update public.bookings b
set
  first_reminder_due_at = coalesce(b.first_reminder_due_at, b.reminder_due_at),
  first_reminder_sent_at = coalesce(b.first_reminder_sent_at, b.reminder_sent_at),
  first_reminder_status = coalesce(b.first_reminder_status, b.reminder_status),
  second_reminder_due_at = coalesce(
    b.second_reminder_due_at,
    public.booking_compute_second_reminder_due_at(
      b.appointment_date,
      b.appointment_time,
      coalesce(bp.second_reminder_minutes, 120)
    )
  ),
  second_reminder_status = coalesce(
    b.second_reminder_status,
    case
      when coalesce(bp.second_reminder_minutes, 120) <= 0 then 'disabled'
      else 'pending'
    end
  )
from public.business_profiles bp
where bp.id = b.business_id;

-- Dla wyłączonego drugiego przypomnienia zawsze null due_at i status disabled.
update public.bookings b
set
  second_reminder_due_at = null,
  second_reminder_status = 'disabled',
  second_reminder_sent_at = null,
  second_reminder_error = null
from public.business_profiles bp
where bp.id = b.business_id
  and coalesce(bp.second_reminder_minutes, 120) = 0;

create index if not exists bookings_first_reminder_due_idx on public.bookings (business_id, first_reminder_due_at)
where first_reminder_sent_at is null;

create index if not exists bookings_second_reminder_due_idx on public.bookings (business_id, second_reminder_due_at)
where second_reminder_sent_at is null;
