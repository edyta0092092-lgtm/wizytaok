-- Ujednolicenie szablonów wiadomości i rozszerzenie logów wysyłek.

do $$
begin
  alter type public.message_template_type add value 'reminder_24h';
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter type public.message_template_type add value 'reminder_before_visit';
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter type public.message_template_type add value 'booking_confirmation';
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter type public.message_template_type add value 'booking_cancelled_by_client';
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter type public.message_template_type add value 'no_show_follow_up';
exception when duplicate_object then null;
end;
$$;

alter table public.message_templates
  add column if not exists timing_minutes_before integer;

alter table public.notification_logs
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists scheduled_for timestamptz;

alter table public.notification_logs
  drop constraint if exists notification_logs_status_chk;

alter table public.notification_logs
  add constraint notification_logs_status_chk check (
    status in (
      'scheduled',
      'queued',
      'pending',
      'sent',
      'failed',
      'skipped',
      'disabled',
      'simulated_dev',
      'not_configured'
    )
  );

create index if not exists notification_logs_status_idx on public.notification_logs (status);
create index if not exists notification_logs_scheduled_for_idx on public.notification_logs (scheduled_for desc);
