-- Fix support conversation delete permissions and services management RLS.

create table if not exists public.support_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text unique not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists support_admins_email_idx on public.support_admins(lower(email));
create unique index if not exists support_admins_user_id_unique on public.support_admins(user_id) where user_id is not null;

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.services enable row level security;

drop policy if exists support_conversations_delete_member on public.support_conversations;
drop policy if exists support_conversations_delete_owner_or_support on public.support_conversations;
create policy support_conversations_delete_owner_or_support
on public.support_conversations
for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.business_profiles bp
    where bp.id = support_conversations.business_id
      and bp.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.support_admins sa
    where sa.is_active = true
      and (
        (sa.user_id is not null and sa.user_id = auth.uid())
        or lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

drop policy if exists support_conversations_update_owner_or_support on public.support_conversations;
create policy support_conversations_update_owner_or_support
on public.support_conversations
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.business_profiles bp
    where bp.id = support_conversations.business_id
      and bp.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.support_admins sa
    where sa.is_active = true
      and (
        (sa.user_id is not null and sa.user_id = auth.uid())
        or lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.business_profiles bp
    where bp.id = support_conversations.business_id
      and bp.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.support_admins sa
    where sa.is_active = true
      and (
        (sa.user_id is not null and sa.user_id = auth.uid())
        or lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

drop policy if exists support_messages_delete_with_conversation on public.support_messages;
drop policy if exists support_messages_delete_owner_or_support on public.support_messages;
create policy support_messages_delete_owner_or_support
on public.support_messages
for delete
to authenticated
using (
  sender_user_id = auth.uid()
  or exists (
    select 1
    from public.support_conversations sc
    where sc.id = support_messages.conversation_id
      and (
        sc.user_id = auth.uid()
        or exists (
          select 1
          from public.business_profiles bp
          where bp.id = sc.business_id
            and bp.owner_id = auth.uid()
        )
        or exists (
          select 1
          from public.support_admins sa
          where sa.is_active = true
            and (
              (sa.user_id is not null and sa.user_id = auth.uid())
              or lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        )
      )
  )
);

drop policy if exists services_select_own_business on public.services;
create policy services_select_own_business
on public.services
for select
to authenticated
using (public.is_business_member_active(services.business_id));

drop policy if exists services_insert_own_business on public.services;
create policy services_insert_own_business
on public.services
for insert
to authenticated
with check (public.is_business_settings_admin(services.business_id));

drop policy if exists services_update_own_business on public.services;
create policy services_update_own_business
on public.services
for update
to authenticated
using (public.is_business_settings_admin(services.business_id))
with check (public.is_business_settings_admin(services.business_id));

drop policy if exists services_delete_own_business on public.services;
create policy services_delete_own_business
on public.services
for delete
to authenticated
using (public.is_business_settings_admin(services.business_id));
