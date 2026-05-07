-- Align support messages schema with realtime chat requirements.
-- Safe migration: no destructive operations, preserves existing data.

alter table if exists public.support_messages
add column if not exists business_id uuid references public.business_profiles (id) on delete cascade;

update public.support_messages sm
set business_id = st.business_id
from public.support_tickets st
where sm.ticket_id = st.id
  and sm.business_id is null;

create index if not exists support_messages_business_id_idx
on public.support_messages (business_id);

-- Keep tenant isolation explicit for reads.
drop policy if exists support_messages_select_with_ticket on public.support_messages;
create policy support_messages_select_with_ticket on public.support_messages for select using (
  exists (
    select 1
    from public.support_tickets st
    where st.id = support_messages.ticket_id
      and public.is_business_member_active (st.business_id)
  )
);

-- Keep insert restricted to user sender type in own company thread.
drop policy if exists support_messages_insert_user_thread on public.support_messages;
create policy support_messages_insert_user_thread on public.support_messages for insert
with check (
  sender_type = 'user'
  and sender_user_id = auth.uid ()
  and exists (
    select 1
    from public.support_tickets st
    where st.id = ticket_id
      and public.is_business_member_active (st.business_id)
      and st.status <> 'closed'
  )
);
