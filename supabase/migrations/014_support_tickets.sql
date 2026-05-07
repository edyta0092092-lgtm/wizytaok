-- Zgłoszenia do obsługi serwisu oraz wątki wiadomości (panel biznesowy).

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  subject text not null,
  message text not null,
  priority text not null default 'normal',
  status text not null default 'open',
  current_path text,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint support_tickets_priority_chk check (
    priority in ('low', 'normal', 'high')
  ),
  constraint support_tickets_status_chk check (
    status in ('open', 'in_progress', 'resolved', 'closed')
  )
);

create index if not exists support_tickets_business_id_idx on public.support_tickets (business_id);

create index if not exists support_tickets_user_id_idx on public.support_tickets (user_id);

create index if not exists support_tickets_updated_at_idx on public.support_tickets (updated_at desc);

create trigger support_tickets_set_updated_at
before update on public.support_tickets for each row
execute function public.set_updated_at ();

alter table public.support_tickets enable row level security;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid (),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_user_id uuid references auth.users (id) on delete set null,
  sender_type text not null default 'user',
  body text not null,
  created_at timestamptz not null default now (),
  constraint support_messages_sender_type_chk check (
    sender_type in ('user', 'support', 'system')
  )
);

create index if not exists support_messages_ticket_id_idx on public.support_messages (ticket_id, created_at);

alter table public.support_messages enable row level security;

-- Po nowej wiadomości odśwież updated_at zgłoszenia.
create or replace function public.support_messages_touch_ticket () returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
  set
    updated_at = now ()
  where
    id = new.ticket_id;
  return new;
end;
$$;

create trigger support_messages_touch_ticket_trg
after insert on public.support_messages for each row
execute function public.support_messages_touch_ticket ();

-- RLS: widoczność po członkostwie w firmie.
create policy support_tickets_select_active_member on public.support_tickets for select using (public.is_business_member_active (business_id));

create policy support_tickets_insert_self on public.support_tickets for insert
with check (
  public.is_business_member_active (business_id)
  and user_id = auth.uid ()
);

-- Brak publicznej aktualizacji zgłoszeń z panelu użytkownika w MVP (status obsługa później).

create policy support_messages_select_with_ticket on public.support_messages for select using (
  exists (
    select
      1
    from
      public.support_tickets st
    where
      st.id = support_messages.ticket_id
      and public.is_business_member_active (st.business_id)
  )
);

create policy support_messages_insert_user_thread on public.support_messages for insert
with check (
  sender_type = 'user'
  and sender_user_id = auth.uid ()
  and exists (
    select
      1
    from
      public.support_tickets st
    where
      st.id = ticket_id
      and public.is_business_member_active (st.business_id)
      and st.status <> 'closed'
  )
);
