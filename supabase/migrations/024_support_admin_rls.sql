-- Support-admin access for /support panel + support replies.

create table if not exists public.support_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint support_admins_user_unique unique (user_id),
  constraint support_admins_email_unique unique (email)
);

create index if not exists support_admins_active_idx on public.support_admins (is_active);
create index if not exists support_admins_email_idx on public.support_admins (lower(email));

alter table public.support_admins enable row level security;

drop policy if exists support_admins_self_select on public.support_admins;
create policy support_admins_self_select on public.support_admins
for select to authenticated
using (
  (user_id is not null and user_id = auth.uid())
  or lower(coalesce(email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
);

create or replace function public.is_support_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.support_admins sa
    where sa.is_active = true
      and (
        (sa.user_id is not null and sa.user_id = auth.uid())
        or lower(coalesce(sa.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
  );
$$;

revoke all on function public.is_support_admin() from public;
grant execute on function public.is_support_admin() to authenticated;

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists support_conversations_select_member on public.support_conversations;
create policy support_conversations_select_member
on public.support_conversations
for select
to authenticated
using (
  public.is_business_member_active(business_id)
  or public.is_support_admin()
);

drop policy if exists support_conversations_insert_member on public.support_conversations;
create policy support_conversations_insert_member
on public.support_conversations
for insert
to authenticated
with check (
  (
    public.is_business_member_active(business_id)
    and user_id = auth.uid()
  )
  or public.is_support_admin()
);

drop policy if exists support_conversations_update_member on public.support_conversations;
create policy support_conversations_update_member
on public.support_conversations
for update
to authenticated
using (
  public.is_business_member_active(business_id)
  or public.is_support_admin()
)
with check (
  public.is_business_member_active(business_id)
  or public.is_support_admin()
);

drop policy if exists support_messages_select_with_conversation on public.support_messages;
create policy support_messages_select_with_conversation
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_conversations sc
    where sc.id = support_messages.conversation_id
      and (public.is_business_member_active(sc.business_id) or public.is_support_admin())
  )
);

drop policy if exists support_messages_insert_user_conversation on public.support_messages;
create policy support_messages_insert_user_conversation
on public.support_messages
for insert
to authenticated
with check (
  sender_role = 'user'
  and sender_user_id = auth.uid()
  and exists (
    select 1
    from public.support_conversations sc
    where sc.id = support_messages.conversation_id
      and public.is_business_member_active(sc.business_id)
      and sc.status <> 'closed'
  )
);

drop policy if exists support_messages_insert_support_conversation on public.support_messages;
create policy support_messages_insert_support_conversation
on public.support_messages
for insert
to authenticated
with check (
  sender_role = 'support'
  and sender_user_id = auth.uid()
  and public.is_support_admin()
  and exists (
    select 1
    from public.support_conversations sc
    where sc.id = support_messages.conversation_id
      and sc.business_id = support_messages.business_id
  )
);
