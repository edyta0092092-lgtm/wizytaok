-- Wpisy transakcyjne (podziękowanie, anulowanie) oznaczone skipped mimo wysłanej treści.

update public.notification_logs
   set status = 'sent',
       sent_at = coalesce(sent_at, created_at)
 where status in ('skipped', 'queued')
   and coalesce(type, '') in (
     'thank_you_after_visit',
     'thank_you',
     'visit_thank_you',
     'booking_cancelled_by_company',
     'booking_cancelled_by_client',
     'booking_cancelled',
     'company_cancelled_booking',
     'client_cancelled_booking',
     'no_show_follow_up',
     'followup_noshow',
     'follow_up_no_show',
     'booking_confirmed',
     'booking_created',
     'booking_confirmation',
     'confirmation'
   )
   and coalesce(nullif(trim(body), ''), nullif(trim(recipient), '')) is not null;
