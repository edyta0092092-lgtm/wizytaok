alter table public.bookings
add column if not exists staff_id uuid;

alter table public.bookings
add column if not exists staff_name text;

create index if not exists bookings_staff_id_idx
on public.bookings (staff_id);
