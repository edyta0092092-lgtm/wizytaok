-- accept_business_invitation: fallback gdy kolumna invited_by nie istnieje w starszej bazie.

create or replace function public.accept_business_invitation (p_token uuid) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_inv public.business_invitations%rowtype;
  v_uid uuid := auth.uid ();
  v_email text;
  v_member_err text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select * into v_inv
  from public.business_invitations i
  where i.token = p_token
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_inv.status = 'accepted' then
    if exists (
      select 1 from public.business_members bm
      where bm.business_id = v_inv.business_id and bm.user_id = v_uid
    ) then
      return jsonb_build_object('ok', true);
    end if;
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;
  if v_inv.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'cancelled');
  end if;
  if v_inv.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  if lower(trim(coalesce(v_email, ''))) <> lower(trim(coalesce(v_inv.email, ''))) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  begin
    insert into public.business_members (
      business_id, user_id, role, display_name, email, is_active, invited_by, staff_member_id
    )
    values (
      v_inv.business_id, v_uid, v_inv.role, null, v_inv.email, true, v_inv.invited_by, v_inv.staff_member_id
    )
    on conflict (business_id, user_id) do update
    set
      role = excluded.role,
      is_active = true,
      email = excluded.email,
      staff_member_id = coalesce(excluded.staff_member_id, public.business_members.staff_member_id),
      invited_by = coalesce(public.business_members.invited_by, excluded.invited_by),
      updated_at = now ();
  exception
    when others then
      v_member_err := sqlerrm;
      if v_member_err ilike '%staff_member_id%' then
        begin
          insert into public.business_members (
            business_id, user_id, role, display_name, email, is_active, invited_by
          )
          values (
            v_inv.business_id, v_uid, v_inv.role, null, v_inv.email, true, v_inv.invited_by
          )
          on conflict (business_id, user_id) do update
          set
            role = excluded.role,
            is_active = true,
            email = excluded.email,
            invited_by = coalesce(public.business_members.invited_by, excluded.invited_by),
            updated_at = now ();
        exception
          when others then
            v_member_err := sqlerrm;
            if v_member_err ilike '%invited_by%' then
              insert into public.business_members (
                business_id, user_id, role, display_name, email, is_active
              )
              values (
                v_inv.business_id, v_uid, v_inv.role, null, v_inv.email, true
              )
              on conflict (business_id, user_id) do update
              set
                role = excluded.role,
                is_active = true,
                email = excluded.email,
                updated_at = now ();
            else
              return jsonb_build_object('ok', false, 'error', 'member_upsert_failed', 'detail', v_member_err);
            end if;
        end;
      elsif v_member_err ilike '%invited_by%' then
        begin
          insert into public.business_members (
            business_id, user_id, role, display_name, email, is_active, staff_member_id
          )
          values (
            v_inv.business_id, v_uid, v_inv.role, null, v_inv.email, true, v_inv.staff_member_id
          )
          on conflict (business_id, user_id) do update
          set
            role = excluded.role,
            is_active = true,
            email = excluded.email,
            staff_member_id = coalesce(excluded.staff_member_id, public.business_members.staff_member_id),
            updated_at = now ();
        exception
          when others then
            v_member_err := sqlerrm;
            if v_member_err ilike '%staff_member_id%' then
              insert into public.business_members (
                business_id, user_id, role, display_name, email, is_active
              )
              values (
                v_inv.business_id, v_uid, v_inv.role, null, v_inv.email, true
              )
              on conflict (business_id, user_id) do update
              set
                role = excluded.role,
                is_active = true,
                email = excluded.email,
                updated_at = now ();
            else
              return jsonb_build_object('ok', false, 'error', 'member_upsert_failed', 'detail', v_member_err);
            end if;
        end;
      else
        return jsonb_build_object('ok', false, 'error', 'member_upsert_failed', 'detail', v_member_err);
      end if;
  end;

  update public.business_invitations i
  set status = 'accepted', accepted_at = now()
  where i.id = v_inv.id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.accept_business_invitation (uuid) from public;
grant execute on function public.accept_business_invitation (uuid) to authenticated;
