-- Dopasowanie service_id niezależnie od formatu UUID (np. różna wielkość liter w tekście).
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
  where ss.business_id = p_business_id
    and sm.business_id = p_business_id
    and sm.is_active = true
    and (
      ss.service_id = p_service_id
      or lower(replace(ss.service_id::text, '-', '')) = lower(replace(p_service_id::text, '-', ''))
    )
  order by sm.name asc;
$$;
