-- Postęp pierwszej konfiguracji / przewodnika panelu per użytkownik i firma.

create table if not exists public.panel_onboarding_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  track text not null,
  welcome_dismissed_at timestamptz,
  completed_at timestamptz,
  steps jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, business_id),
  constraint panel_onboarding_state_track_chk check (track in ('admin', 'staff'))
);

create index if not exists panel_onboarding_state_business_id_idx
  on public.panel_onboarding_state (business_id);

drop trigger if exists panel_onboarding_state_set_updated_at on public.panel_onboarding_state;

create trigger panel_onboarding_state_set_updated_at
before update on public.panel_onboarding_state
for each row
execute function public.set_updated_at ();

alter table public.panel_onboarding_state enable row level security;

drop policy if exists panel_onboarding_state_select_own on public.panel_onboarding_state;

create policy panel_onboarding_state_select_own
on public.panel_onboarding_state
for select
to authenticated
using (
  user_id = auth.uid ()
  and (
    public.is_business_owner (business_id)
    or public.is_business_member_active (business_id)
  )
);

drop policy if exists panel_onboarding_state_insert_own on public.panel_onboarding_state;

create policy panel_onboarding_state_insert_own
on public.panel_onboarding_state
for insert
to authenticated
with check (
  user_id = auth.uid ()
  and (
    public.is_business_owner (business_id)
    or public.is_business_member_active (business_id)
  )
);

drop policy if exists panel_onboarding_state_update_own on public.panel_onboarding_state;

create policy panel_onboarding_state_update_own
on public.panel_onboarding_state
for update
to authenticated
using (
  user_id = auth.uid ()
  and (
    public.is_business_owner (business_id)
    or public.is_business_member_active (business_id)
  )
)
with check (
  user_id = auth.uid ()
  and (
    public.is_business_owner (business_id)
    or public.is_business_member_active (business_id)
  )
);

grant select, insert, update on public.panel_onboarding_state to authenticated;
