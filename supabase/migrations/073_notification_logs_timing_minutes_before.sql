-- Zapis czasu przypomnienia (minuty przed wizytą) w momencie wysyłki / logowania.
alter table public.notification_logs
  add column if not exists timing_minutes_before integer null;

comment on column public.notification_logs.timing_minutes_before is
  'Minuty przed wizytą z ustawień szablonu w chwili wysyłki (tylko przypomnienia).';
