-- Jednorazowe uzupełnienie notification_logs z pól przypomnienia na bookings.
-- Gdy przypomnienie faktycznie wyszło (sent_at / status), a wpis w logu nie powstał,
-- historia w panelu „Wysłane" / „Pominięte" będzie kompletna.
-- Idempotentne: nie nadpisuje istniejących wierszy (UNIQUE booking_id + type + channel).

-- Pierwsze przypomnienie (24h) — e-mail
insert into public.notification_logs (
  business_id,
  booking_id,
  channel,
  type,
  status,
  recipient,
  sent_at,
  created_at,
  error_message
)
select
  b.business_id,
  b.id,
  'email',
  'appointment_reminder_24h',
  case
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'sent' then 'sent'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'skipped' then 'skipped'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'failed' then 'failed'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'not_configured' then 'not_configured'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) in ('simulated_dev', 'simulated') then 'simulated_dev'
    when coalesce(b.first_reminder_sent_at, b.reminder_sent_at) is not null then 'sent'
    else null
  end,
  trim(b.client_email),
  coalesce(b.first_reminder_sent_at, b.reminder_sent_at),
  coalesce(b.first_reminder_sent_at, b.reminder_sent_at, b.updated_at, now()),
  case
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'skipped'
      then coalesce(nullif(trim(b.reminder_error), ''), 'backfilled_from_booking')
    else null
  end
from public.bookings b
where btrim(coalesce(b.client_email, '')) <> ''
  and (
    b.first_reminder_sent_at is not null
    or b.reminder_sent_at is not null
    or lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) in (
      'sent', 'skipped', 'failed', 'not_configured', 'simulated_dev', 'simulated'
    )
  )
  and case
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'sent' then 'sent'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'skipped' then 'skipped'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'failed' then 'failed'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'not_configured' then 'not_configured'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) in ('simulated_dev', 'simulated') then 'simulated_dev'
    when coalesce(b.first_reminder_sent_at, b.reminder_sent_at) is not null then 'sent'
    else null
  end is not null
  and not exists (
    select 1
    from public.notification_logs nl
    where nl.booking_id = b.id
      and nl.type = 'appointment_reminder_24h'
      and nl.channel = 'email'
  );

-- Pierwsze przypomnienie (24h) — SMS
insert into public.notification_logs (
  business_id,
  booking_id,
  channel,
  type,
  status,
  recipient,
  sent_at,
  created_at,
  error_message
)
select
  b.business_id,
  b.id,
  'sms',
  'appointment_reminder_24h',
  case
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'sent' then 'sent'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'skipped' then 'skipped'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'failed' then 'failed'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'not_configured' then 'not_configured'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) in ('simulated_dev', 'simulated') then 'simulated_dev'
    when coalesce(b.first_reminder_sent_at, b.reminder_sent_at) is not null then 'sent'
    else null
  end,
  trim(b.client_phone),
  coalesce(b.first_reminder_sent_at, b.reminder_sent_at),
  coalesce(b.first_reminder_sent_at, b.reminder_sent_at, b.updated_at, now()),
  case
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'skipped'
      then coalesce(nullif(trim(b.reminder_error), ''), 'backfilled_from_booking')
    else null
  end
from public.bookings b
where btrim(coalesce(b.client_phone, '')) <> ''
  and (
    b.first_reminder_sent_at is not null
    or b.reminder_sent_at is not null
    or lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) in (
      'sent', 'skipped', 'failed', 'not_configured', 'simulated_dev', 'simulated'
    )
  )
  and case
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'sent' then 'sent'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'skipped' then 'skipped'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'failed' then 'failed'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) = 'not_configured' then 'not_configured'
    when lower(trim(coalesce(b.first_reminder_status, b.reminder_status, ''))) in ('simulated_dev', 'simulated') then 'simulated_dev'
    when coalesce(b.first_reminder_sent_at, b.reminder_sent_at) is not null then 'sent'
    else null
  end is not null
  and not exists (
    select 1
    from public.notification_logs nl
    where nl.booking_id = b.id
      and nl.type = 'appointment_reminder_24h'
      and nl.channel = 'sms'
  );

-- Drugie przypomnienie (przed wizytą) — e-mail
insert into public.notification_logs (
  business_id,
  booking_id,
  channel,
  type,
  status,
  recipient,
  sent_at,
  created_at,
  error_message
)
select
  b.business_id,
  b.id,
  'email',
  'appointment_reminder_short',
  case
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'sent' then 'sent'
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'skipped' then 'skipped'
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'failed' then 'failed'
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'not_configured' then 'not_configured'
    when lower(trim(coalesce(b.second_reminder_status, ''))) in ('simulated_dev', 'simulated') then 'simulated_dev'
    when b.second_reminder_sent_at is not null then 'sent'
    else null
  end,
  trim(b.client_email),
  b.second_reminder_sent_at,
  coalesce(b.second_reminder_sent_at, b.updated_at, now()),
  case
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'skipped'
      then coalesce(nullif(trim(b.second_reminder_error), ''), 'backfilled_from_booking')
    else null
  end
from public.bookings b
where btrim(coalesce(b.client_email, '')) <> ''
  and (
    b.second_reminder_sent_at is not null
    or lower(trim(coalesce(b.second_reminder_status, ''))) in (
      'sent', 'skipped', 'failed', 'not_configured', 'simulated_dev', 'simulated'
    )
  )
  and case
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'sent' then 'sent'
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'skipped' then 'skipped'
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'failed' then 'failed'
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'not_configured' then 'not_configured'
    when lower(trim(coalesce(b.second_reminder_status, ''))) in ('simulated_dev', 'simulated') then 'simulated_dev'
    when b.second_reminder_sent_at is not null then 'sent'
    else null
  end is not null
  and not exists (
    select 1
    from public.notification_logs nl
    where nl.booking_id = b.id
      and nl.type = 'appointment_reminder_short'
      and nl.channel = 'email'
  );

-- Drugie przypomnienie (przed wizytą) — SMS
insert into public.notification_logs (
  business_id,
  booking_id,
  channel,
  type,
  status,
  recipient,
  sent_at,
  created_at,
  error_message
)
select
  b.business_id,
  b.id,
  'sms',
  'appointment_reminder_short',
  case
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'sent' then 'sent'
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'skipped' then 'skipped'
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'failed' then 'failed'
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'not_configured' then 'not_configured'
    when lower(trim(coalesce(b.second_reminder_status, ''))) in ('simulated_dev', 'simulated') then 'simulated_dev'
    when b.second_reminder_sent_at is not null then 'sent'
    else null
  end,
  trim(b.client_phone),
  b.second_reminder_sent_at,
  coalesce(b.second_reminder_sent_at, b.updated_at, now()),
  case
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'skipped'
      then coalesce(nullif(trim(b.second_reminder_error), ''), 'backfilled_from_booking')
    else null
  end
from public.bookings b
where btrim(coalesce(b.client_phone, '')) <> ''
  and (
    b.second_reminder_sent_at is not null
    or lower(trim(coalesce(b.second_reminder_status, ''))) in (
      'sent', 'skipped', 'failed', 'not_configured', 'simulated_dev', 'simulated'
    )
  )
  and case
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'sent' then 'sent'
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'skipped' then 'skipped'
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'failed' then 'failed'
    when lower(trim(coalesce(b.second_reminder_status, ''))) = 'not_configured' then 'not_configured'
    when lower(trim(coalesce(b.second_reminder_status, ''))) in ('simulated_dev', 'simulated') then 'simulated_dev'
    when b.second_reminder_sent_at is not null then 'sent'
    else null
  end is not null
  and not exists (
    select 1
    from public.notification_logs nl
    where nl.booking_id = b.id
      and nl.type = 'appointment_reminder_short'
      and nl.channel = 'sms'
  );
