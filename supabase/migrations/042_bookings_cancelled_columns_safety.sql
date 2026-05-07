-- Safety migration for environments missing cancellation metadata columns.
alter table public.bookings
  add column if not exists cancelled_at timestamptz;

alter table public.bookings
  add column if not exists cancelled_by text;

alter table public.bookings
  add column if not exists updated_at timestamptz;
