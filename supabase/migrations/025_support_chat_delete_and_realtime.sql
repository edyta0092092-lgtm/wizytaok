-- Enable delete permissions and realtime sync for support conversations/messages.

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists support_conversations_delete_member on public.support_conversations;
create policy support_conversations_delete_member
on public.support_conversations
for delete
to authenticated
using (
  public.is_business_member_active(business_id)
  or public.is_support_admin()
);

drop policy if exists support_messages_delete_with_conversation on public.support_messages;
create policy support_messages_delete_with_conversation
on public.support_messages
for delete
to authenticated
using (
  exists (
    select 1
    from public.support_conversations sc
    where sc.id = support_messages.conversation_id
      and (public.is_business_member_active(sc.business_id) or public.is_support_admin())
  )
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.support_conversations;
  exception
    when duplicate_object then
      null;
  end;
end
$$;
