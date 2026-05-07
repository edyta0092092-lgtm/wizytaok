-- Fix live chat inserts for support_messages using conversation_id.
-- Backward compatible with older support_tickets shape.

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.business_profiles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'open',
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.support_conversations(id) on delete cascade,
  business_id uuid references public.business_profiles(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null default 'user',
  body text not null,
  created_at timestamptz not null default now()
);

-- Existing environments can still have legacy constraints from support_tickets-based chat.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_messages'
      and column_name = 'ticket_id'
  ) then
    execute 'alter table public.support_messages alter column ticket_id drop not null';
  end if;
end
$$;

alter table public.support_messages
  alter column conversation_id set not null;

alter table public.support_messages
  alter column business_id set not null;

alter table public.support_messages
  alter column sender_user_id set not null;

alter table public.support_messages
  alter column sender_role set not null;

-- Realtime publication safety (idempotent).
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
