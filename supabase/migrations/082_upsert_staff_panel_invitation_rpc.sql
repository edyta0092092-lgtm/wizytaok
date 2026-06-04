-- Atomowe tworzenie / odświeżenie zaproszenia do panelu (omija problemy RLS z klienta przeglądarki).

create or replace function public.upsert_staff_panel_invitation (
  p_business_id uuid,
  p_staff_member_id uuid,
  p_email text,
  p_role text,
  p_invited_by uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_em text := lower(trim(coalesce(p_email, '')));
  v_token uuid := gen_random_uuid();
  v_member_id uuid;
  v_inv_id uuid;
  v_inv_staff uuid;
  v_inv_status text;
  v_out_token uuid;
begin
  if v_em = '' then
    return jsonb_build_object('ok', false, 'code', 'email_required');
  end if;

  if p_role is null or p_role not in ('admin', 'staff') then
    return jsonb_build_object('ok', false, 'code', 'invalid_role');
  end if;

  select bm.id
    into v_member_id
  from public.business_members bm
  where bm.business_id = p_business_id
    and bm.staff_member_id = p_staff_member_id
    and bm.is_active = true
    and bm.user_id is not null
  limit 1;

  if v_member_id is not null then
    update public.business_members
    set
      role = p_role,
      email = v_em,
      is_active = true,
      updated_at = now()
    where id = v_member_id;

    select i.token
      into v_out_token
    from public.business_invitations i
    where i.business_id = p_business_id
      and i.staff_member_id = p_staff_member_id
      and i.status = 'pending'
    limit 1;

    return jsonb_build_object(
      'ok',
      true,
      'already_has_access',
      true,
      'token',
      v_out_token
    );
  end if;

  update public.business_invitations i
  set status = 'cancelled'
  where i.business_id = p_business_id
    and i.staff_member_id = p_staff_member_id
    and i.status = 'pending';

  select i.id, i.staff_member_id, i.status
    into v_inv_id, v_inv_staff, v_inv_status
  from public.business_invitations i
  where i.business_id = p_business_id
    and lower(trim(i.email)) = v_em
  limit 1;

  if v_inv_id is not null then
    if v_inv_status = 'pending'
      and v_inv_staff is not null
      and v_inv_staff <> p_staff_member_id then
      return jsonb_build_object('ok', false, 'code', 'email_conflict');
    end if;

    if v_inv_status = 'accepted'
      and v_inv_staff is not null
      and v_inv_staff <> p_staff_member_id then
      return jsonb_build_object('ok', false, 'code', 'email_conflict');
    end if;

    update public.business_invitations i
    set
      status = 'pending',
      email = v_em,
      role = p_role,
      staff_member_id = p_staff_member_id,
      invited_by = p_invited_by,
      token = v_token,
      accepted_at = null
    where i.id = v_inv_id;
  else
    insert into public.business_invitations (
      business_id,
      email,
      role,
      staff_member_id,
      invited_by,
      token,
      status
    )
    values (
      p_business_id,
      v_em,
      p_role,
      p_staff_member_id,
      p_invited_by,
      v_token,
      'pending'
    );
  end if;

  select i.token
    into v_out_token
  from public.business_invitations i
  where i.business_id = p_business_id
    and i.staff_member_id = p_staff_member_id
    and i.status = 'pending'
  limit 1;

  if v_out_token is null then
    select i.token
      into v_out_token
    from public.business_invitations i
    where i.business_id = p_business_id
      and lower(trim(i.email)) = v_em
      and i.status = 'pending'
    limit 1;
  end if;

  if v_out_token is null then
    return jsonb_build_object('ok', false, 'code', 'not_persisted');
  end if;

  return jsonb_build_object(
    'ok',
    true,
    'token',
    v_out_token::text
  );
end;
$$;

revoke all on function public.upsert_staff_panel_invitation (uuid, uuid, text, text, uuid) from public;

grant execute on function public.upsert_staff_panel_invitation (uuid, uuid, text, text, uuid) to service_role;

grant execute on function public.upsert_staff_panel_invitation (uuid, uuid, text, text, uuid) to authenticated;
