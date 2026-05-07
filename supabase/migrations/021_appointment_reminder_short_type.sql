-- Wspólny typ techniczny dla przypomnień + ochrona przed duplikatami.

-- Ujednolicenie starszych wpisów logów do nowego nazewnictwa.
update public.notification_logs
set type = 'appointment_reminder_24h'
where type in ('reminder_24h', 'first_reminder_24h');

update public.notification_logs
set type = 'appointment_reminder_short'
where type = 'second_reminder';

-- Dodatkowe zabezpieczenie idempotencji per booking + kanał + typ szablonu.
create unique index if not exists notification_logs_booking_type_channel_uidx
on public.notification_logs (booking_id, type, channel);
