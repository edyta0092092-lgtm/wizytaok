-- Zaproszenia: normalizacja e-maili i unikalność bez względu na wielkość liter.
-- Wymaga istniejącej tabeli public.business_invitations (migracja 010).
-- Jeśli SQL Editor zwraca „relation does not exist”, uruchom najpierw 087_ensure_business_invitations_table.sql.

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'business_invitations'
  ) then
    raise exception
      'Brak tabeli public.business_invitations. Uruchom migrację 087 w tym samym projekcie Supabase co aplikacja (NEXT_PUBLIC_SUPABASE_URL).';
  end if;
end;
$$;

update public.business_invitations
set email = lower(trim(email))
where email is distinct from lower(trim(email));

with ranked as (
  select
    id,
    row_number() over (
      partition by business_id, lower(trim(email))
      order by
        case status when 'pending' then 0 when 'accepted' then 1 else 2 end,
        created_at desc
    ) as rn
  from public.business_invitations
)
update public.business_invitations i
set status = 'cancelled'
from ranked r
where i.id = r.id
  and r.rn > 1;

alter table public.business_invitations
  drop constraint if exists business_invitations_business_id_email_key;

create unique index if not exists business_invitations_business_id_email_lower_uniq
  on public.business_invitations (business_id, lower(trim(email)));
