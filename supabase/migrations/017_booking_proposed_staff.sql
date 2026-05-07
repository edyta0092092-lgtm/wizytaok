-- Opcjonalna osoba w propozycji zmiany terminu (wizyty).
alter table public.bookings
  add column if not exists proposed_staff_id uuid references public.staff_members (id) on delete set null;

alter table public.bookings
  add column if not exists proposed_staff_name text;
