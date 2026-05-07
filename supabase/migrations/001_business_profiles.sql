-- Profil firmy (1:1 z właścicielem) + publiczny slug dla /book/[slug]
-- Uruchom w Supabase SQL Editor lub: supabase db push
-- Wymaga wcześniejszego utworzenia public.set_updated_at (patrz supabase/schema.sql) lub poniżej:

create or replace function public.set_updated_at () returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create extension if not exists "pgcrypto";

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid (),
  owner_id uuid not null references auth.users (id) on delete cascade,
  business_name text not null,
  slug text not null,
  owner_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_profiles_slug_lower_chk check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint business_profiles_owner_unique unique (owner_id)
);

create unique index if not exists business_profiles_slug_unique_idx on public.business_profiles (slug);

create index if not exists business_profiles_owner_id_idx on public.business_profiles (owner_id);

create trigger business_profiles_set_updated_at
before update on public.business_profiles for each row
execute function public.set_updated_at ();

alter table public.business_profiles enable row level security;

create policy "business_profiles_select_own" on public.business_profiles for select to authenticated using (auth.uid () = owner_id);

create policy "business_profiles_insert_own" on public.business_profiles for insert to authenticated with check (auth.uid () = owner_id);

create policy "business_profiles_update_own" on public.business_profiles for update to authenticated using (auth.uid () = owner_id)
with check (auth.uid () = owner_id);

create policy "business_profiles_delete_own" on public.business_profiles for delete to authenticated using (auth.uid () = owner_id);

-- Publiczny odczyt po slug (tylko bezpieczne kolumny), bez SELECT na całej tabeli dla anon
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

create or replace function public.is_business_slug_available (p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.business_profiles bp
    where bp.slug = lower(trim(p_slug))
  );
$$;

revoke all on function public.is_business_slug_available (text) from public;
grant execute on function public.is_business_slug_available (text) to anon, authenticated;
