-- Powiązanie konta panelu z rekordem staff (stanowisko zawodowe vs rola w panelu).
-- Nieniszczące: tylko nowe kolumny i aktualizacja funkcji akceptacji zaproszenia.

alter table public.business_members
add column if not exists staff_member_id uuid references public.staff_members (id) on delete set null;

create index if not exists business_members_staff_member_id_idx on public.business_members (staff_member_id);

alter table public.business_invitations
add column if not exists staff_member_id uuid references public.staff_members (id) on delete set null;

create index if not exists business_invitations_staff_member_id_idx on public.business_invitations (staff_member_id);

-- Akceptacja: zapisz staff_member_id w business_members.
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
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;
  if v_inv.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'cancelled');
  end if;
  if v_inv.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;
  select u.email into v_email
  from auth.users u
  where u.id = v_uid;
  if lower(trim(coalesce(v_email, ''))) <> lower(trim(coalesce(v_inv.email, ''))) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;
  insert into public.business_members (
    business_id,
    user_id,
    role,
    display_name,
    email,
    is_active,
    invited_by,
    staff_member_id
  )
  values (
    v_inv.business_id,
    v_uid,
    v_inv.role,
    null,
    v_inv.email,
    true,
    v_inv.invited_by,
    v_inv.staff_member_id
  )
  on conflict (business_id, user_id) do update
  set
    role = excluded.role,
    is_active = true,
    email = excluded.email,
    staff_member_id = coalesce(excluded.staff_member_id, public.business_members.staff_member_id),
    invited_by = coalesce(public.business_members.invited_by, excluded.invited_by),
    updated_at = now ();
  update public.business_invitations i
  set
    status = 'accepted',
    accepted_at = now ()
  where i.id = v_inv.id;
  return jsonb_build_object('ok', true);
end;
$$;
