-- Właściciel: blokuj tylko e-mail z auth.users (nie pole business_members).
-- Po zapisie zaproszenia odczytaj token także po adresie e-mail (gdy staff_member_id się nie zgadza).

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
  v_owner_id uuid;
  v_owner_auth_email text;
  v_member_id uuid;
  v_inv_id uuid;
  v_inv_staff uuid;
  v_inv_status text;
  v_out_token uuid;
  v_other_has_access boolean;
begin
  if v_em = '' then
    return jsonb_build_object('ok', false, 'code', 'email_required');
  end if;

  if p_role is null or p_role not in ('admin', 'staff') then
    return jsonb_build_object('ok', false, 'code', 'invalid_role');
  end if;

  select bp.owner_id into v_owner_id
  from public.business_profiles bp
  where bp.id = p_business_id;

  if v_owner_id is not null then
    select lower(trim(coalesce(u.email, '')))
      into v_owner_auth_email
    from auth.users u
    where u.id = v_owner_id;

    if v_owner_auth_email <> '' and v_owner_auth_email = v_em then
      return jsonb_build_object('ok', false, 'code', 'owner_email');
    end if;
  end if;

  select bm.id
    into v_member_id
  from public.business_members bm
  where bm.business_id = p_business_id
    and bm.staff_member_id = p_staff_member_id
    and bm.user_id is not null
  limit 1;

  if v_member_id is not null then
    update public.business_members
    set role = p_role, email = v_em, updated_at = now()
    where id = v_member_id;

    select i.token into v_out_token
    from public.business_invitations i
    where i.business_id = p_business_id
      and i.staff_member_id = p_staff_member_id
      and i.status = 'pending'
    limit 1;

    if v_out_token is not null then
      return jsonb_build_object('ok', true, 'already_has_access', true, 'token', v_out_token);
    end if;
  end if;

  if exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id is not null
      and bm.staff_member_id is not null
      and bm.staff_member_id <> p_staff_member_id
      and lower(trim(coalesce(bm.email, ''))) = v_em
  ) then
    return jsonb_build_object('ok', false, 'code', 'email_conflict');
  end if;

  update public.business_invitations i
  set status = 'cancelled'
  where i.business_id = p_business_id
    and i.staff_member_id = p_staff_member_id
    and i.status = 'pending';

  update public.business_invitations i
  set status = 'cancelled'
  where i.business_id = p_business_id
    and lower(trim(i.email)) = v_em
    and i.status = 'pending'
    and (i.staff_member_id is null or i.staff_member_id <> p_staff_member_id);

  select i.id, i.staff_member_id, i.status
    into v_inv_id, v_inv_staff, v_inv_status
  from public.business_invitations i
  where i.business_id = p_business_id
    and lower(trim(i.email)) = v_em
  limit 1;

  if v_inv_id is not null
    and v_inv_status = 'accepted'
    and v_inv_staff is not null
    and v_inv_staff <> p_staff_member_id then
    select exists (
      select 1 from public.business_members bm
      where bm.business_id = p_business_id
        and bm.staff_member_id = v_inv_staff
        and bm.user_id is not null
    ) into v_other_has_access;
    if v_other_has_access then
      return jsonb_build_object('ok', false, 'code', 'email_conflict');
    end if;
  end if;

  begin
    if v_inv_id is not null then
      update public.business_invitations i
      set status = 'pending', email = v_em, role = p_role,
          staff_member_id = p_staff_member_id, invited_by = p_invited_by,
          token = v_token, accepted_at = null
      where i.id = v_inv_id;
    else
      insert into public.business_invitations (
        business_id, email, role, staff_member_id, invited_by, token, status
      ) values (
        p_business_id, v_em, p_role, p_staff_member_id, p_invited_by, v_token, 'pending'
      );
    end if;
  exception
    when foreign_key_violation then
      if v_inv_id is not null then
        update public.business_invitations i
        set status = 'pending', email = v_em, role = p_role,
            staff_member_id = p_staff_member_id, invited_by = null,
            token = v_token, accepted_at = null
        where i.id = v_inv_id;
      else
        insert into public.business_invitations (
          business_id, email, role, staff_member_id, invited_by, token, status
        ) values (
          p_business_id, v_em, p_role, p_staff_member_id, null, v_token, 'pending'
        );
      end if;
  end;

  select i.token into v_out_token
  from public.business_invitations i
  where i.business_id = p_business_id
    and i.status = 'pending'
    and lower(trim(i.email)) = v_em
  limit 1;

  if v_out_token is null then
    select i.token into v_out_token
    from public.business_invitations i
    where i.business_id = p_business_id
      and i.staff_member_id = p_staff_member_id
      and i.status = 'pending'
    limit 1;
  end if;

  if v_out_token is null then
    return jsonb_build_object('ok', false, 'code', 'not_persisted');
  end if;

  return jsonb_build_object('ok', true, 'token', v_out_token::text);
exception when others then
  return jsonb_build_object('ok', false, 'code', 'db_error', 'detail', sqlerrm);
end;
$$;

revoke all on function public.upsert_staff_panel_invitation (uuid, uuid, text, text, uuid) from public;
grant execute on function public.upsert_staff_panel_invitation (uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.upsert_staff_panel_invitation (uuid, uuid, text, text, uuid) to authenticated;
