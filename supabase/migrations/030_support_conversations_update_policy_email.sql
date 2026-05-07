drop policy if exists "support_conversations_update_owner_or_support" on public.support_conversations;
drop policy if exists support_conversations_update_owner_or_support on public.support_conversations;

create policy "support_conversations_update_owner_or_support"
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
    where lower(sa.email) = lower(auth.jwt() ->> 'email')
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
    where lower(sa.email) = lower(auth.jwt() ->> 'email')
  )
);
