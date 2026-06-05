-- Wizyty (bookings): w starszych bazach SELECT/INSERT/UPDATE dotyczyły tylko owner_id (migr. 004).
-- Pracownicy panelu muszą widzieć i obsługiwać wizyty firmy.

drop policy if exists "bookings_select_own" on public.bookings;

create policy "bookings_select_own" on public.bookings for select to authenticated using (
  public.is_business_member_active (business_id)
);

drop policy if exists "bookings_insert_own" on public.bookings;

create policy "bookings_insert_own" on public.bookings for insert to authenticated with check (
  public.is_business_member_active (business_id)
);

drop policy if exists "bookings_update_own" on public.bookings;

create policy "bookings_update_own" on public.bookings for update to authenticated using (
  public.is_business_member_active (business_id)
)
with check (
  public.is_business_member_active (business_id)
);

drop policy if exists "bookings_delete_own" on public.bookings;

create policy "bookings_delete_own" on public.bookings for delete to authenticated using (
  public.is_business_member_active (business_id)
);
