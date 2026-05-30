-- Jednorazowe uzupełnienie notification_logs z pól przypomnienia na bookings.
-- Działa na starszym schemacie (reminder_sent_at / reminder_status) oraz na nowym
-- (first_reminder_* / second_reminder_*). Idempotentne (NOT EXISTS).

do $$
declare
  has_first_sent boolean;
  has_first_status boolean;
  has_second_sent boolean;
  has_second_status boolean;
  has_second_error boolean;
  has_legacy_sent boolean;
  has_legacy_status boolean;
  has_legacy_error boolean;
  sent_expr text;
  status_expr text;
  error_expr text;
  where_expr text;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'first_reminder_sent_at'
  ) into has_first_sent;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'first_reminder_status'
  ) into has_first_status;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'second_reminder_sent_at'
  ) into has_second_sent;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'second_reminder_status'
  ) into has_second_status;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'second_reminder_error'
  ) into has_second_error;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'reminder_sent_at'
  ) into has_legacy_sent;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'reminder_status'
  ) into has_legacy_status;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'reminder_error'
  ) into has_legacy_error;

  -- -------------------------------------------------------------------------
  -- Pierwsze przypomnienie (24h): nowy schemat lub legacy
  -- -------------------------------------------------------------------------
  if has_first_sent or has_legacy_sent then
    if has_first_sent and has_first_status and has_legacy_status then
      sent_expr := 'coalesce(b.first_reminder_sent_at, b.reminder_sent_at)';
      status_expr := 'lower(trim(coalesce(b.first_reminder_status, b.reminder_status, '''')))';
      error_expr := case
        when has_legacy_error then 'coalesce(nullif(trim(b.reminder_error), ''''), ''backfilled_from_booking'')'
        else '''backfilled_from_booking'''
      end;
    elsif has_first_sent and has_first_status then
      sent_expr := 'b.first_reminder_sent_at';
      status_expr := 'lower(trim(coalesce(b.first_reminder_status, '''')))';
      error_expr := '''backfilled_from_booking''';
    elsif has_legacy_sent and has_legacy_status then
      sent_expr := 'b.reminder_sent_at';
      status_expr := 'lower(trim(coalesce(b.reminder_status, '''')))';
      error_expr := case
        when has_legacy_error then 'coalesce(nullif(trim(b.reminder_error), ''''), ''backfilled_from_booking'')'
        else '''backfilled_from_booking'''
      end;
    elsif has_first_sent then
      sent_expr := 'b.first_reminder_sent_at';
      status_expr := '''sent''';
      error_expr := 'null';
    else
      sent_expr := 'b.reminder_sent_at';
      status_expr := '''sent''';
      error_expr := 'null';
    end if;

    where_expr := format(
      '(%s is not null or %s in (''sent'', ''skipped'', ''failed'', ''not_configured'', ''simulated_dev'', ''simulated''))',
      sent_expr,
      status_expr
    );

    execute format($sql$
      insert into public.notification_logs (
        business_id, booking_id, channel, type, status, recipient, sent_at, created_at, error_message
      )
      select
        b.business_id,
        b.id,
        'email',
        'appointment_reminder_24h',
        case
          when %2$s = 'sent' then 'sent'
          when %2$s = 'skipped' then 'skipped'
          when %2$s = 'failed' then 'failed'
          when %2$s = 'not_configured' then 'not_configured'
          when %2$s in ('simulated_dev', 'simulated') then 'simulated_dev'
          when %1$s is not null then 'sent'
          else null
        end,
        trim(b.client_email),
        %1$s,
        coalesce(%1$s, b.updated_at, now()),
        case when %2$s = 'skipped' then %3$s else null end
      from public.bookings b
      where btrim(coalesce(b.client_email, '')) <> ''
        and %4$s
        and case
          when %2$s = 'sent' then 'sent'
          when %2$s = 'skipped' then 'skipped'
          when %2$s = 'failed' then 'failed'
          when %2$s = 'not_configured' then 'not_configured'
          when %2$s in ('simulated_dev', 'simulated') then 'simulated_dev'
          when %1$s is not null then 'sent'
          else null
        end is not null
        and not exists (
          select 1 from public.notification_logs nl
          where nl.booking_id = b.id
            and nl.type = 'appointment_reminder_24h'
            and nl.channel = 'email'
        )
    $sql$, sent_expr, status_expr, error_expr, where_expr);

    execute format($sql$
      insert into public.notification_logs (
        business_id, booking_id, channel, type, status, recipient, sent_at, created_at, error_message
      )
      select
        b.business_id,
        b.id,
        'sms',
        'appointment_reminder_24h',
        case
          when %2$s = 'sent' then 'sent'
          when %2$s = 'skipped' then 'skipped'
          when %2$s = 'failed' then 'failed'
          when %2$s = 'not_configured' then 'not_configured'
          when %2$s in ('simulated_dev', 'simulated') then 'simulated_dev'
          when %1$s is not null then 'sent'
          else null
        end,
        trim(b.client_phone),
        %1$s,
        coalesce(%1$s, b.updated_at, now()),
        case when %2$s = 'skipped' then %3$s else null end
      from public.bookings b
      where btrim(coalesce(b.client_phone, '')) <> ''
        and %4$s
        and case
          when %2$s = 'sent' then 'sent'
          when %2$s = 'skipped' then 'skipped'
          when %2$s = 'failed' then 'failed'
          when %2$s = 'not_configured' then 'not_configured'
          when %2$s in ('simulated_dev', 'simulated') then 'simulated_dev'
          when %1$s is not null then 'sent'
          else null
        end is not null
        and not exists (
          select 1 from public.notification_logs nl
          where nl.booking_id = b.id
            and nl.type = 'appointment_reminder_24h'
            and nl.channel = 'sms'
        )
    $sql$, sent_expr, status_expr, error_expr, where_expr);
  end if;

  -- -------------------------------------------------------------------------
  -- Drugie przypomnienie (przed wizytą) — tylko gdy kolumny istnieją
  -- -------------------------------------------------------------------------
  if has_second_sent then
    if has_second_status then
      sent_expr := 'b.second_reminder_sent_at';
      status_expr := 'lower(trim(coalesce(b.second_reminder_status, '''')))';
      error_expr := case
        when has_second_error then 'coalesce(nullif(trim(b.second_reminder_error), ''''), ''backfilled_from_booking'')'
        else '''backfilled_from_booking'''
      end;
    else
      sent_expr := 'b.second_reminder_sent_at';
      status_expr := '''sent''';
      error_expr := 'null';
    end if;

    where_expr := format(
      '(%s is not null or %s in (''sent'', ''skipped'', ''failed'', ''not_configured'', ''simulated_dev'', ''simulated''))',
      sent_expr,
      status_expr
    );

    execute format($sql$
      insert into public.notification_logs (
        business_id, booking_id, channel, type, status, recipient, sent_at, created_at, error_message
      )
      select
        b.business_id,
        b.id,
        'email',
        'appointment_reminder_short',
        case
          when %2$s = 'sent' then 'sent'
          when %2$s = 'skipped' then 'skipped'
          when %2$s = 'failed' then 'failed'
          when %2$s = 'not_configured' then 'not_configured'
          when %2$s in ('simulated_dev', 'simulated') then 'simulated_dev'
          when %1$s is not null then 'sent'
          else null
        end,
        trim(b.client_email),
        %1$s,
        coalesce(%1$s, b.updated_at, now()),
        case when %2$s = 'skipped' then %3$s else null end
      from public.bookings b
      where btrim(coalesce(b.client_email, '')) <> ''
        and %4$s
        and case
          when %2$s = 'sent' then 'sent'
          when %2$s = 'skipped' then 'skipped'
          when %2$s = 'failed' then 'failed'
          when %2$s = 'not_configured' then 'not_configured'
          when %2$s in ('simulated_dev', 'simulated') then 'simulated_dev'
          when %1$s is not null then 'sent'
          else null
        end is not null
        and not exists (
          select 1 from public.notification_logs nl
          where nl.booking_id = b.id
            and nl.type = 'appointment_reminder_short'
            and nl.channel = 'email'
        )
    $sql$, sent_expr, status_expr, error_expr, where_expr);

    execute format($sql$
      insert into public.notification_logs (
        business_id, booking_id, channel, type, status, recipient, sent_at, created_at, error_message
      )
      select
        b.business_id,
        b.id,
        'sms',
        'appointment_reminder_short',
        case
          when %2$s = 'sent' then 'sent'
          when %2$s = 'skipped' then 'skipped'
          when %2$s = 'failed' then 'failed'
          when %2$s = 'not_configured' then 'not_configured'
          when %2$s in ('simulated_dev', 'simulated') then 'simulated_dev'
          when %1$s is not null then 'sent'
          else null
        end,
        trim(b.client_phone),
        %1$s,
        coalesce(%1$s, b.updated_at, now()),
        case when %2$s = 'skipped' then %3$s else null end
      from public.bookings b
      where btrim(coalesce(b.client_phone, '')) <> ''
        and %4$s
        and case
          when %2$s = 'sent' then 'sent'
          when %2$s = 'skipped' then 'skipped'
          when %2$s = 'failed' then 'failed'
          when %2$s = 'not_configured' then 'not_configured'
          when %2$s in ('simulated_dev', 'simulated') then 'simulated_dev'
          when %1$s is not null then 'sent'
          else null
        end is not null
        and not exists (
          select 1 from public.notification_logs nl
          where nl.booking_id = b.id
            and nl.type = 'appointment_reminder_short'
            and nl.channel = 'sms'
        )
    $sql$, sent_expr, status_expr, error_expr, where_expr);
  end if;
end$$;
