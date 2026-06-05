-- is_business_member_active: nie wymaga kolumny is_active (starsze bazy / NULL na wierszu zaproszenia).

create or replace function public.is_business_member_active (p_business_id uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_business_owner (p_business_id)
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid ()
  );
$$;

create or replace function public.is_business_settings_admin (p_business_id uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_business_owner (p_business_id)
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid ()
      and bm.role = 'admin'
  );
$$;

revoke all on function public.is_business_member_active (uuid) from public;
grant execute on function public.is_business_member_active (uuid) to authenticated;

revoke all on function public.is_business_settings_admin (uuid) from public;
grant execute on function public.is_business_settings_admin (uuid) to authenticated;
