-- Publiczna strona /book/[slug]: odśwież RPC tak, aby NIE odwoływały się do nieistniejącej
-- kolumny booking_slug. Adres rezerwacji zapisany w ustawieniach to public.business_profiles.slug.

create or replace function public.get_business_profile_by_slug (p_slug text)
returns table (
  id uuid,
  business_name text,
  slug text,
  phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select bp.id, bp.business_name, bp.slug, bp.phone
  from public.business_profiles bp
  where bp.slug = lower(trim(p_slug))
  limit 1;
$$;

revoke all on function public.get_business_profile_by_slug (text) from public;

grant execute on function public.get_business_profile_by_slug (text) to anon, authenticated;

create or replace function public.get_active_services_by_business_slug (p_slug text)
returns table (
  id uuid,
  business_id uuid,
  name text,
  description text,
  duration_minutes integer,
  price numeric,
  currency text,
  is_active boolean,
  sort_order integer,
  uses_default_availability boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.business_id,
    s.name,
    s.description,
    s.duration_minutes,
    s.price,
    s.currency,
    s.is_active,
    s.sort_order,
    s.uses_default_availability
  from public.services s
  inner join public.business_profiles bp on bp.id = s.business_id
  where bp.slug = lower(trim(p_slug))
    and s.is_active = true
  order by s.sort_order asc, s.created_at asc;
$$;

revoke all on function public.get_active_services_by_business_slug (text) from public;

grant execute on function public.get_active_services_by_business_slug (text) to anon, authenticated;

-- Fallback gdy funkcja po slugu nie działa lub klient już ma business_id po SELECT slug.
create or replace function public.get_active_services_by_business_id (p_business_id uuid)
returns table (
  id uuid,
  business_id uuid,
  name text,
  description text,
  duration_minutes integer,
  price numeric,
  currency text,
  is_active boolean,
  sort_order integer,
  uses_default_availability boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.business_id,
    s.name,
    s.description,
    s.duration_minutes,
    s.price,
    s.currency,
    s.is_active,
    s.sort_order,
    s.uses_default_availability
  from public.services s
  where s.business_id = p_business_id
    and s.is_active = true
  order by s.sort_order asc, s.created_at asc;
$$;

revoke all on function public.get_active_services_by_business_id (uuid) from public;

grant execute on function public.get_active_services_by_business_id (uuid) to anon, authenticated;
