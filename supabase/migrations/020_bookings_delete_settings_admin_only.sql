-- Ograniczenie usuwania wizyt w panelu do właściciela / adminów (personel bez delete).
drop policy if exists "bookings_delete_own" on public.bookings;

create policy "bookings_delete_own" on public.bookings for delete to authenticated using (
  public.is_business_settings_admin (business_id)
);
