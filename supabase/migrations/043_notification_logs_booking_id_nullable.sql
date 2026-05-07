-- Logi testowych integracji (SMS/e-mail z panelu) mogą nie dotyczyć konkretnej rezerwacji.
alter table public.notification_logs
  alter column booking_id drop not null;
