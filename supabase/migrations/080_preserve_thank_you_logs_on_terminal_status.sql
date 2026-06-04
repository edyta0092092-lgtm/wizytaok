-- Nie oznaczaj logów „Podziękowanie po wizycie” jako skipped przy statusie końcowym.

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
       'booking_cancelled_by_client',
       'no_show_follow_up',
       'followup_noshow',
       'follow_up_no_show',
       'thank_you_after_visit',
       'thank_you',
       'visit_thank_you'
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

-- Wpisy pominięte przez starszą wersję triggera (queued → skipped przy completed).
update public.notification_logs
   set status = 'sent'
 where coalesce(type, '') in ('thank_you_after_visit', 'thank_you', 'visit_thank_you')
   and status = 'skipped'
   and sent_at is not null;
