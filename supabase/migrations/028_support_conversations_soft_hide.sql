-- Soft-hide support conversations per viewer side.

alter table public.support_conversations
  add column if not exists hidden_for_user_at timestamptz;

alter table public.support_conversations
  add column if not exists hidden_for_support_at timestamptz;

create index if not exists support_conversations_hidden_for_user_idx
on public.support_conversations(hidden_for_user_at);

create index if not exists support_conversations_hidden_for_support_idx
on public.support_conversations(hidden_for_support_at);
