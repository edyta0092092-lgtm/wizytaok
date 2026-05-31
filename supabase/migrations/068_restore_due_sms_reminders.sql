-- Przywróć due SMS w kolejce (anulowane / failed / skipped) gdy e-mail już poszedł lub termin minął.

update public.appointment_reminders sms
set
  status = 'pending',
  locked_at = null,
  last_error = null,
  attempts = 0,
  updated_at = now()
from public.bookings b
left join public.appointment_reminders email
  on email.appointment_id = sms.appointment_id
 and email.reminder_kind = sms.reminder_kind
 and email.channel = 'email'
where sms.appointment_id = b.id
  and sms.channel = 'sms'
  and sms.sent_at is null
  and sms.status in ('cancelled', 'skipped', 'failed', 'pending')
  and b.status <> 'cancelled'
  and b.client_phone is not null
  and btrim(b.client_phone) <> ''
  and b.confirmation_token is not null
  and btrim(b.confirmation_token::text) <> ''
  and sms.scheduled_for <= now()
  and ((b.appointment_date::timestamp + b.appointment_time) at time zone 'Europe/Warsaw') > now()
  and (
    email.id is null
    or email.status in ('sent', 'pending', 'processing', 'failed')
  );

insert into public.appointment_reminders
  (business_id, appointment_id, channel, reminder_kind, scheduled_for, status)
select
  b.business_id,
  b.id,
  'sms',
  'first',
  coalesce(
    email.scheduled_for,
    ((b.appointment_date::timestamp + b.appointment_time) at time zone 'Europe/Warsaw')
      - make_interval(mins => coalesce(bp.default_reminder_minutes, 1440))
  ),
  'pending'
from public.bookings b
join public.business_profiles bp on bp.id = b.business_id
left join public.appointment_reminders email
  on email.appointment_id = b.id
 and email.channel = 'email'
 and email.reminder_kind = 'first'
where b.status <> 'cancelled'
  and coalesce(bp.reminder_channel, 'both') in ('sms', 'both')
  and b.client_phone is not null
  and btrim(b.client_phone) <> ''
  and b.confirmation_token is not null
  and btrim(b.confirmation_token::text) <> ''
  and ((b.appointment_date::timestamp + b.appointment_time) at time zone 'Europe/Warsaw') > now()
  and not exists (
    select 1
      from public.appointment_reminders existing
     where existing.appointment_id = b.id
       and existing.channel = 'sms'
       and existing.reminder_kind = 'first'
  )
on conflict (appointment_id, channel, reminder_kind) do update
  set scheduled_for = excluded.scheduled_for,
      status = case
        when public.appointment_reminders.status in ('sent', 'failed') then public.appointment_reminders.status
        else 'pending'
      end,
      attempts = 0,
      locked_at = null,
      last_error = null,
      updated_at = now()
  where public.appointment_reminders.status not in ('sent', 'failed');
