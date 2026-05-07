-- Publiczna rezerwacja /book: odczyt osób przypisanych do usługi mimo ewentualnych problemów z RLS na staff_services.
-- Ponownie tworzymy politykę SELECT dla anon (na wypadek, że wcześniejsza migracja ją usunęła bez odtworzenia).

drop policy if exists "staff_services_select_public" on public.staff_services;

create policy "staff_services_select_public" on public.staff_services for select to anon, authenticated using (true);

create or replace function public.get_public_staff_for_service (
  p_business_id uuid,
  p_service_id uuid
)
returns table (
  id uuid,
  name text
)
language sql
stable
security definer
set search_path = public
as $$
  select sm.id, sm.name::text
  from public.staff_services ss
  inner join public.staff_members sm on sm.id = ss.staff_id
  where ss.service_id = p_service_id
    and ss.business_id = p_business_id
    and sm.business_id = p_business_id
    and sm.is_active = true
  order by sm.name asc;
$$;

revoke all on function public.get_public_staff_for_service (uuid, uuid) from public;

grant execute on function public.get_public_staff_for_service (uuid, uuid) to anon, authenticated;
