-- Nazwisko właściciela osobno od imienia (owner_name = imię).
alter table public.business_profiles
  add column if not exists owner_last_name text;

create or replace function public.ensure_owner_membership () returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid ();
  v_bid uuid;
  v_email text;
  v_display text;
begin
  if v_uid is null then
    return;
  end if;
  select
    bp.id,
    u.email,
    coalesce(
      nullif(
        trim(
          both ' '
          from concat_ws(
            ' ',
            nullif(trim(coalesce(bp.owner_name, '')), ''),
            nullif(trim(coalesce(bp.owner_last_name, '')), '')
          )
        ),
        ''
      ),
      bp.business_name
    )
    into v_bid, v_email, v_display
  from public.business_profiles bp
  join auth.users u on u.id = bp.owner_id
  where bp.owner_id = v_uid
  limit 1;
  if v_bid is null then
    return;
  end if;
  insert into public.business_members (
    business_id,
    user_id,
    role,
    display_name,
    email,
    is_active
  )
  values (
    v_bid,
    v_uid,
    'admin',
    v_display,
    v_email,
    true
  )
  on conflict (business_id, user_id) do update
  set
    role = 'admin',
    is_active = true,
    email = excluded.email,
    display_name = coalesce(public.business_members.display_name, excluded.display_name),
    updated_at = now ();
end;
$$;
