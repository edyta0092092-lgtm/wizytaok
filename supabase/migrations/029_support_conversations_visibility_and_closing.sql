alter table public.support_conversations
add column if not exists hidden_for_user_at timestamptz;

alter table public.support_conversations
add column if not exists hidden_for_support_at timestamptz;

alter table public.support_conversations
add column if not exists closed_by text;

alter table public.support_conversations
add column if not exists closed_at timestamptz;
