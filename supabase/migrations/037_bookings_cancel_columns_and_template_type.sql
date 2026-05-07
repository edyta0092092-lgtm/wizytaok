-- Anulowanie wizyty przez firmę (metadane) + typ szablonu booking_cancelled_by_company
-- + statusy queued/pending w notification_logs

alter table public.bookings
  add column if not exists cancelled_at timestamptz;

alter table public.bookings
  add column if not exists cancelled_by text;

alter table public.bookings
  add column if not exists cancellation_note text;

do $$
begin
  alter type public.message_template_type add value 'booking_cancelled_by_company';
exception
  when duplicate_object then
    null;
end;
$$;

alter table public.notification_logs
  drop constraint if exists notification_logs_status_chk;

alter table public.notification_logs
  add constraint notification_logs_status_chk check (
    status in (
      'sent',
      'failed',
      'skipped',
      'simulated_dev',
      'not_configured',
      'queued',
      'pending'
    )
  );
