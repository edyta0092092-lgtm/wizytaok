-- Kreator własnych szablonów wiadomości (pełny).
--
-- Tabela `custom_templates` przechowuje dowolne szablony zdefiniowane przez firmę
-- (nazwa + treść SMS/e-mail + wyzwalacz). Tabela `custom_template_sends` to log/dedup
-- faktycznych wysyłek (wzór z `appointment_reminders` + `notification_logs`).
-- Migracja jest addytywna i idempotentna — nic nie usuwa ani nie modyfikuje
-- destrukcyjnie istniejących obiektów.

-- ===========================================================================
-- 1) custom_templates — konfiguracja własnych szablonów
-- ===========================================================================
create table if not exists public.custom_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  name text not null,
  sms_enabled boolean not null default false,
  sms_content text not null default '',
  email_enabled boolean not null default false,
  email_subject text not null default '',
  email_content text not null default '',
  trigger_type text not null,
  offset_minutes integer,
  event_key text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'custom_templates_trigger_type_chk'
  ) then
    alter table public.custom_templates
      add constraint custom_templates_trigger_type_chk
      check (trigger_type in ('schedule_before', 'schedule_after', 'event', 'manual'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'custom_templates_event_key_chk'
  ) then
    alter table public.custom_templates
      add constraint custom_templates_event_key_chk
      check (
        event_key is null
        or event_key in ('created', 'confirmed', 'cancelled', 'no_show', 'completed')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'custom_templates_status_chk'
  ) then
    alter table public.custom_templates
      add constraint custom_templates_status_chk
      check (status in ('active', 'draft'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'custom_templates_offset_chk'
  ) then
    alter table public.custom_templates
      add constraint custom_templates_offset_chk
      check (offset_minutes is null or offset_minutes >= 0);
  end if;
end$$;

create index if not exists custom_templates_business_id_idx
  on public.custom_templates (business_id);

create index if not exists custom_templates_business_trigger_idx
  on public.custom_templates (business_id, trigger_type, status);

-- updated_at touch trigger
create or replace function public.custom_templates_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists custom_templates_set_updated_at_trg on public.custom_templates;
create trigger custom_templates_set_updated_at_trg
before update on public.custom_templates
for each row execute function public.custom_templates_set_updated_at();

-- RLS: pełny CRUD dla członków firmy (zarządzanie w panelu).
alter table public.custom_templates enable row level security;

drop policy if exists "custom_templates_select_own" on public.custom_templates;
create policy "custom_templates_select_own"
  on public.custom_templates for select to authenticated
  using (public.is_business_member_active (business_id));

drop policy if exists "custom_templates_insert_own" on public.custom_templates;
create policy "custom_templates_insert_own"
  on public.custom_templates for insert to authenticated
  with check (public.is_business_member_active (business_id));

drop policy if exists "custom_templates_update_own" on public.custom_templates;
create policy "custom_templates_update_own"
  on public.custom_templates for update to authenticated
  using (public.is_business_member_active (business_id))
  with check (public.is_business_member_active (business_id));

drop policy if exists "custom_templates_delete_own" on public.custom_templates;
create policy "custom_templates_delete_own"
  on public.custom_templates for delete to authenticated
  using (public.is_business_member_active (business_id));

-- ===========================================================================
-- 2) custom_template_sends — log/dedup faktycznych wysyłek
-- ===========================================================================
create table if not exists public.custom_template_sends (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  appointment_id uuid not null references public.bookings (id) on delete cascade,
  custom_template_id uuid not null references public.custom_templates (id) on delete cascade,
  channel text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  locked_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  skipped_at timestamptz,
  recipient text,
  subject text,
  body text,
  provider text,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'custom_template_sends_channel_chk'
  ) then
    alter table public.custom_template_sends
      add constraint custom_template_sends_channel_chk
      check (channel in ('email', 'sms'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'custom_template_sends_status_chk'
  ) then
    alter table public.custom_template_sends
      add constraint custom_template_sends_status_chk
      check (status in ('pending', 'processing', 'sent', 'failed', 'skipped'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'custom_template_sends_attempts_chk'
  ) then
    alter table public.custom_template_sends
      add constraint custom_template_sends_attempts_chk
      check (attempts >= 0);
  end if;
end$$;

-- Dołożenie kolumn treści (idempotentnie), gdyby tabela powstała we wcześniejszej wersji.
alter table public.custom_template_sends add column if not exists subject text;
alter table public.custom_template_sends add column if not exists body text;

-- Idempotencja: jedna (wizyta, szablon, kanał) para = jedna wysyłka (dla zaplanowanych/zdarzeń).
create unique index if not exists custom_template_sends_appt_tpl_channel_uidx
  on public.custom_template_sends (appointment_id, custom_template_id, channel);

create index if not exists custom_template_sends_business_id_idx
  on public.custom_template_sends (business_id);

create or replace function public.custom_template_sends_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists custom_template_sends_set_updated_at_trg on public.custom_template_sends;
create trigger custom_template_sends_set_updated_at_trg
before update on public.custom_template_sends
for each row execute function public.custom_template_sends_set_updated_at();

-- RLS: członkowie firmy czytają własne; mutacje wyłącznie service role (cron/dispatch).
alter table public.custom_template_sends enable row level security;

drop policy if exists "custom_template_sends_select_own" on public.custom_template_sends;
create policy "custom_template_sends_select_own"
  on public.custom_template_sends for select to authenticated
  using (public.is_business_member_active (business_id));

-- ===========================================================================
-- 3) Funkcja pomocnicza dla crona: due (szablon, wizyta) dla harmonogramów
--    przed/po wizycie. Czas liczony w Europe/Warsaw (jak przy przypomnieniach).
--    Okno `p_window_minutes` chroni przed wysyłką dla bardzo starych wizyt /
--    szablonów utworzonych później. Deduplikację zapewnia tabela sends (UNIQUE).
-- ===========================================================================
create or replace function public.due_custom_templates(p_window_minutes integer default 720)
returns table (template_id uuid, booking_id uuid, business_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with due as (
    select
      t.id as template_id,
      b.id as booking_id,
      b.business_id as business_id,
      case
        when t.trigger_type = 'schedule_before'
          then ((b.appointment_date::timestamp + b.appointment_time) at time zone 'Europe/Warsaw')
               - make_interval(mins => t.offset_minutes)
        else ((b.appointment_date::timestamp + b.appointment_time) at time zone 'Europe/Warsaw')
             + make_interval(mins => t.offset_minutes)
      end as trigger_ts,
      t.sms_enabled as sms_enabled,
      t.email_enabled as email_enabled,
      b.client_email as client_email,
      b.client_phone as client_phone
    from public.custom_templates t
    join public.bookings b on b.business_id = t.business_id
    where t.status = 'active'
      and t.trigger_type in ('schedule_before', 'schedule_after')
      and t.offset_minutes is not null
      and coalesce(b.status, '') not in ('cancelled')
  )
  select distinct template_id, booking_id, business_id
  from due
  where trigger_ts <= now()
    and trigger_ts >= now() - make_interval(mins => p_window_minutes)
    and (
      (email_enabled and client_email is not null and btrim(client_email) <> '')
      or (sms_enabled and client_phone is not null and btrim(client_phone) <> '')
    );
$$;

grant execute on function public.due_custom_templates(integer) to authenticated, service_role;
