-- Pracownicy panelu muszą odczytać status subskrypcji firmy (trial / active).
-- W starszych bazach polityka SELECT na business_profiles często dotyczyła tylko owner_id (migr. 001).

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
      and coalesce (bm.is_active, true) = true
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
      and coalesce (bm.is_active, true) = true
  );
$$;

revoke all on function public.is_business_member_active (uuid) from public;
grant execute on function public.is_business_member_active (uuid) to authenticated;

revoke all on function public.is_business_settings_admin (uuid) from public;
grant execute on function public.is_business_settings_admin (uuid) to authenticated;

drop policy if exists "business_profiles_select_own" on public.business_profiles;

create policy "business_profiles_select_own" on public.business_profiles for select to authenticated using (
  auth.uid () = owner_id
  or public.is_business_member_active (id)
);

create or replace function public.get_business_member_subscription_access (p_business_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status text;
  v_stripe_status text;
begin
  if auth.uid () is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select bp.owner_id into v_owner
  from public.business_profiles bp
  where bp.id = p_business_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if auth.uid () <> v_owner and not public.is_business_member_active (p_business_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select bp.subscription_status, bp.stripe_subscription_status
  into v_status, v_stripe_status
  from public.business_profiles bp
  where bp.id = p_business_id;

  return jsonb_build_object(
    'ok', true,
    'id', p_business_id,
    'subscription_status', v_status,
    'stripe_subscription_status', v_stripe_status
  );
end;
$$;

revoke all on function public.get_business_member_subscription_access (uuid) from public;
grant execute on function public.get_business_member_subscription_access (uuid) to authenticated;
