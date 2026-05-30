-- Uzupełnienie brakujących logów „Potwierdzenie wizyty” (booking_created).
-- Heurystyka: dla istniejących wizyt z danym kanałem kontaktu zakładamy wysłane potwierdzenie
-- w momencie utworzenia rezerwacji (naprawa historii sprzed poprawki zapisu logów).
-- Idempotentne (NOT EXISTS). Obsługa kolumny error vs error_message.

do $$
declare
  err_col text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_logs'
      and column_name = 'error_message'
  ) then
    err_col := 'error_message';
  else
    err_col := 'error';
  end if;

  execute format($sql$
    insert into public.notification_logs (
      business_id,
      booking_id,
      channel,
      type,
      status,
      recipient,
      sent_at,
      created_at,
      %I
    )
    select
      b.business_id,
      b.id,
      'sms',
      'booking_created',
      'sent',
      trim(b.client_phone),
      coalesce(b.created_at, now()),
      coalesce(b.created_at, now()),
      null
    from public.bookings b
    where btrim(coalesce(b.client_phone, '')) <> ''
      and b.status in ('booked', 'pending', 'confirmed', 'completed', 'no_show')
      and not exists (
        select 1
        from public.notification_logs nl
        where nl.booking_id = b.id
          and nl.type = 'booking_created'
          and nl.channel = 'sms'
      )
  $sql$, err_col);

  execute format($sql$
    insert into public.notification_logs (
      business_id,
      booking_id,
      channel,
      type,
      status,
      recipient,
      sent_at,
      created_at,
      %I
    )
    select
      b.business_id,
      b.id,
      'email',
      'booking_created',
      'sent',
      trim(b.client_email),
      coalesce(b.created_at, now()),
      coalesce(b.created_at, now()),
      null
    from public.bookings b
    where btrim(coalesce(b.client_email, '')) <> ''
      and b.status in ('booked', 'pending', 'confirmed', 'completed', 'no_show')
      and not exists (
        select 1
        from public.notification_logs nl
        where nl.booking_id = b.id
          and nl.type = 'booking_created'
          and nl.channel = 'email'
      )
  $sql$, err_col);
end $$;
