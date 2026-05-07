-- Identyfikatory wykonawcy w public.bookings mapują się na public.staff_members(id).
-- Nie dodajemy osobnej kolumny proposed_staff_member_id — używane są staff_id oraz proposed_staff_id.

comment on column public.bookings.staff_id is 'UUID przypisanego wykonawcy (staff_members.id).';
comment on column public.bookings.proposed_staff_id is 'UUID proponowanego wykonawcy przy propozycji zmiany terminu (staff_members.id).';
