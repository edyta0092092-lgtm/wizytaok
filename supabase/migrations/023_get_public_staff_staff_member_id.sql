-- Publiczna rezerwacja: staff_services używa staff_member_id (bez staff_id / business_id na ss).
-- Firma i usługa: services.business_id + services.id = ss.service_id.
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
  inner join public.services s on s.id = ss.service_id
  inner join public.staff_members sm on sm.id = ss.staff_member_id
  where s.business_id = p_business_id
    and sm.business_id = p_business_id
    and sm.is_active = true
    and (
      ss.service_id = p_service_id
      or lower(replace(ss.service_id::text, '-', '')) = lower(replace(p_service_id::text, '-', ''))
    )
  order by sm.name asc;
$$;
