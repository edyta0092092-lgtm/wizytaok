-- Live chat model for /help based on conversations + messages.
-- Keeps old support_tickets flow intact, adds a safer chat path.

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.business_profiles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'open',
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_conversations_business_id_idx
on public.support_conversations(business_id);

create index if not exists support_conversations_updated_at_idx
on public.support_conversations(updated_at desc);

create trigger support_conversations_set_updated_at
before update on public.support_conversations for each row
execute function public.set_updated_at();

alter table public.support_messages
add column if not exists conversation_id uuid references public.support_conversations(id) on delete cascade;

alter table public.support_messages
add column if not exists sender_role text not null default 'user';

alter table public.support_messages
add column if not exists business_id uuid references public.business_profiles(id) on delete cascade;

update public.support_messages sm
set
  conversation_id = sc.id,
  sender_role = coalesce(sm.sender_type, 'user'),
  business_id = coalesce(sm.business_id, st.business_id)
from public.support_tickets st
left join public.support_conversations sc on sc.id = sm.conversation_id
where sm.ticket_id = st.id
  and (sm.conversation_id is null or sm.business_id is null);

create index if not exists support_messages_conversation_id_idx
on public.support_messages(conversation_id);

create index if not exists support_messages_business_id_idx
on public.support_messages(business_id);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists support_conversations_select_member on public.support_conversations;
create policy support_conversations_select_member
on public.support_conversations
for select
using (public.is_business_member_active(business_id));

drop policy if exists support_conversations_insert_member on public.support_conversations;
create policy support_conversations_insert_member
on public.support_conversations
for insert
with check (
  public.is_business_member_active(business_id)
  and user_id = auth.uid()
);

drop policy if exists support_conversations_update_member on public.support_conversations;
create policy support_conversations_update_member
on public.support_conversations
for update
using (public.is_business_member_active(business_id))
with check (public.is_business_member_active(business_id));

drop policy if exists support_messages_select_with_conversation on public.support_messages;
create policy support_messages_select_with_conversation
on public.support_messages
for select
using (
  exists (
    select 1
    from public.support_conversations sc
    where sc.id = support_messages.conversation_id
      and public.is_business_member_active(sc.business_id)
  )
);

drop policy if exists support_messages_insert_user_conversation on public.support_messages;
create policy support_messages_insert_user_conversation
on public.support_messages
for insert
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

create or replace function public.support_messages_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists support_messages_touch_conversation_trg on public.support_messages;
create trigger support_messages_touch_conversation_trg
after insert on public.support_messages
for each row
execute function public.support_messages_touch_conversation();

do $$
begin
  begin
    alter publication supabase_realtime add table public.support_messages;
  exception
    when duplicate_object then
      null;
  end;
end
$$;
