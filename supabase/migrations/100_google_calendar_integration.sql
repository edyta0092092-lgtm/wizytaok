-- Google Calendar: połączenia OAuth (osobne od logowania Supabase) + powiązanie eventów z wizytami.

create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  business_member_id uuid null references public.business_members (id) on delete set null,
  staff_member_id uuid null references public.staff_members (id) on delete set null,
  google_account_email text null,
  google_calendar_id text null,
  google_calendar_summary text null,
  refresh_token_ciphertext text not null default '',
  refresh_token_iv text not null default '',
  refresh_token_tag text not null default '',
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index if not exists google_calendar_connections_business_staff_idx
  on public.google_calendar_connections (business_id, staff_member_id)
  where disconnected_at is null and google_calendar_id is not null;

create index if not exists google_calendar_connections_user_idx
  on public.google_calendar_connections (user_id)
  where disconnected_at is null;

alter table public.bookings
  add column if not exists google_calendar_event_id text null;

comment on table public.google_calendar_connections is
  'OAuth Google Calendar per użytkownik panelu (nie Supabase Auth Google). Tokeny szyfrowane po stronie aplikacji.';

comment on column public.bookings.google_calendar_event_id is
  'Id wydarzenia w Google Calendar do aktualizacji/anulowania.';

alter table public.google_calendar_connections enable row level security;

drop policy if exists google_calendar_connections_select_own on public.google_calendar_connections;

create policy google_calendar_connections_select_own
  on public.google_calendar_connections
  for select
  to authenticated
  using (
    user_id = auth.uid ()
    and public.is_business_member_active (business_id)
  );

-- INSERT/UPDATE/DELETE tylko przez service role (route handlery API).

grant select on public.google_calendar_connections to authenticated;

create trigger google_calendar_connections_set_updated_at
before update on public.google_calendar_connections for each row
execute function public.set_updated_at ();
