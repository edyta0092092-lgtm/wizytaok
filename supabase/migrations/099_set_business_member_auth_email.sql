-- Synchronizacja e-maila logowania w business_members (własny rekord członka).

create or replace function public.set_business_member_auth_email (p_business_id uuid, p_email text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid () is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_business_member_active (p_business_id) then
    raise exception 'forbidden';
  end if;
  update public.business_members bm
  set
    email = nullif(lower(trim(coalesce(p_email, ''))), ''),
    updated_at = now ()
  where bm.business_id = p_business_id
    and bm.user_id = auth.uid ();
end;
$$;

revoke all on function public.set_business_member_auth_email (uuid, text) from public;
grant execute on function public.set_business_member_auth_email (uuid, text) to authenticated;
