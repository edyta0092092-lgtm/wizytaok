-- Log wysyłek (notification_logs), reminder_error na bookings, usunięcie RPC process_due_booking_reminders
-- (przetwarzanie przeniesione do Next.js /api/cron/reminders z service role).

alter table public.bookings
add column if not exists reminder_error text;

alter table public.bookings
drop constraint if exists bookings_reminder_status_chk;

alter table public.bookings
add constraint bookings_reminder_status_chk check (
  reminder_status is null
  or reminder_status in (
    'pending',
    'sent',
    'failed',
    'skipped',
    'simulated',
    'pending_message_mock',
    'simulated_dev',
    'not_configured'
  )
);

alter table public.bookings
drop constraint if exists bookings_last_status_change_source_chk;

update public.bookings
set last_status_change_source = 'automatic_24h_reminder'
where last_status_change_source = 'auto_reminder_24h';

alter table public.bookings
add constraint bookings_last_status_change_source_chk check (
  last_status_change_source is null
  or last_status_change_source in (
    'manual',
    'confirm',
    'system',
    'automatic_24h_reminder'
  )
);

drop function if exists public.process_due_booking_reminders ();

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  channel text not null check (channel in ('sms', 'email')),
  type text not null default 'reminder_24h',
  recipient text,
  status text not null check (
    status in ('sent', 'failed', 'skipped', 'simulated_dev', 'not_configured')
  ),
  subject text,
  body text,
  provider text,
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notification_logs_business_id_idx on public.notification_logs (business_id);

create index if not exists notification_logs_booking_id_idx on public.notification_logs (booking_id);

create index if not exists notification_logs_created_at_idx on public.notification_logs (created_at desc);

alter table public.notification_logs enable row level security;

drop policy if exists "notification_logs_select_member" on public.notification_logs;

create policy "notification_logs_select_member" on public.notification_logs for select to authenticated using (
  public.is_business_member_active (business_id)
);

comment on table public.notification_logs is 'Historia wysyłek (cron przypomnień). INSERT tylko service role lub backend.';
