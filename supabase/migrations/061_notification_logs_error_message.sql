-- Ujednolicenie nazwy kolumny błędu w notification_logs (kod używa error_message).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_logs'
      and column_name = 'error'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_logs'
      and column_name = 'error_message'
  ) then
    alter table public.notification_logs rename column error to error_message;
  end if;
end$$;

alter table public.notification_logs add column if not exists error_message text;
