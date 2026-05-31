-- Potwierdzenie wizyty (booking_created / booking_confirmed) nie jest przypomnieniem —
-- nie anuluj oczekujących logów transakcyjnych przy statusie końcowym wizyty.

create or replace function public.cancel_pending_booking_notifications(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.appointment_reminders
     set status = 'cancelled',
         locked_at = null,
         last_error = null,
         updated_at = now()
   where appointment_id = p_appointment_id
     and status in ('pending', 'processing');

  update public.custom_template_sends
     set status = 'skipped',
         skipped_at = now(),
         locked_at = null,
         last_error = null,
         updated_at = now()
   where appointment_id = p_appointment_id
     and status in ('pending', 'processing');

  update public.notification_logs
     set status = 'skipped'
   where booking_id = p_appointment_id
     and status in ('pending', 'queued')
     and coalesce(type, '') not in (
       'booking_created',
       'booking_confirmed',
       'booking_confirmation',
       'confirmation',
       'booking_cancelled',
       'booking_cancelled_by_company',
       'booking_cancelled_by_client'
     );

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'first_reminder_status'
  ) then
    update public.bookings
       set first_reminder_status = 'skipped'
     where id = p_appointment_id
       and first_reminder_status = 'pending';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'second_reminder_status'
  ) then
    update public.bookings
       set second_reminder_status = 'skipped'
     where id = p_appointment_id
       and second_reminder_status = 'pending';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'reminder_status'
  ) then
    update public.bookings
       set reminder_status = 'skipped'
     where id = p_appointment_id
       and reminder_status = 'pending';
  end if;
end;
$$;
