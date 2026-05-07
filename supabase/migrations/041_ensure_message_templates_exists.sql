-- Ensure message_templates exists in projects that skipped earlier schema steps.
-- This migration is idempotent and safe to run multiple times.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'message_template_type'
  ) then
    create type public.message_template_type as enum (
      'reminder',
      'second_reminder',
      'confirmation',
      'followup_noshow',
      'company_cancelled_booking'
    );
  end if;
end $$;

do $$ begin alter type public.message_template_type add value 'booking_cancelled_by_company'; exception when duplicate_object then null; end; $$;
do $$ begin alter type public.message_template_type add value 'reminder_24h'; exception when duplicate_object then null; end; $$;
do $$ begin alter type public.message_template_type add value 'reminder_before_visit'; exception when duplicate_object then null; end; $$;
do $$ begin alter type public.message_template_type add value 'booking_confirmation'; exception when duplicate_object then null; end; $$;
do $$ begin alter type public.message_template_type add value 'booking_cancelled_by_client'; exception when duplicate_object then null; end; $$;
do $$ begin alter type public.message_template_type add value 'no_show_follow_up'; exception when duplicate_object then null; end; $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'message_template_channel'
  ) then
    create type public.message_template_channel as enum ('sms', 'email');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'message_template_status'
  ) then
    create type public.message_template_status as enum ('active', 'draft');
  end if;
end $$;

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  type public.message_template_type not null,
  channel public.message_template_channel not null,
  title text not null,
  content text not null,
  timing_minutes_before integer,
  status public.message_template_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists message_templates_business_id_idx on public.message_templates (business_id);
create index if not exists message_templates_business_type_channel_idx on public.message_templates (business_id, type, channel);

create or replace function public.set_updated_at () returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists message_templates_set_updated_at on public.message_templates;
create trigger message_templates_set_updated_at
before update on public.message_templates
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers (some projects may not have them yet)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_business_owner'
  ) then
    execute $fn$
      create or replace function public.is_business_owner (p_business_id uuid) returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select exists (
          select 1
          from public.business_profiles bp
          where bp.id = p_business_id
            and bp.owner_id = auth.uid ()
        );
      $body$;
    $fn$;
    execute 'revoke all on function public.is_business_owner (uuid) from public;';
    execute 'grant execute on function public.is_business_owner (uuid) to authenticated;';
  end if;
end $$;

do $$
declare
  has_members boolean := false;
begin
  select exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'business_members'
      and c.relkind = 'r'
  ) into has_members;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_business_member_active'
  ) then
    if has_members then
      execute $fn$
        create or replace function public.is_business_member_active (p_business_id uuid) returns boolean
        language sql
        stable
        security definer
        set search_path = public
        as $body$
          select public.is_business_owner (p_business_id)
          or exists (
            select 1
            from public.business_members bm
            where bm.business_id = p_business_id
              and bm.user_id = auth.uid ()
              and bm.is_active = true
          );
        $body$;
      $fn$;
    else
      execute $fn$
        create or replace function public.is_business_member_active (p_business_id uuid) returns boolean
        language sql
        stable
        security definer
        set search_path = public
        as $body$
          select public.is_business_owner (p_business_id);
        $body$;
      $fn$;
    end if;
    execute 'revoke all on function public.is_business_member_active (uuid) from public;';
    execute 'grant execute on function public.is_business_member_active (uuid) to authenticated;';
  end if;
end $$;

alter table public.message_templates enable row level security;

drop policy if exists "message_templates_select_own" on public.message_templates;
create policy "message_templates_select_own"
on public.message_templates
for select
to authenticated
using (public.is_business_member_active(business_id));

drop policy if exists "message_templates_insert_own" on public.message_templates;
create policy "message_templates_insert_own"
on public.message_templates
for insert
to authenticated
with check (public.is_business_member_active(business_id));

drop policy if exists "message_templates_update_own" on public.message_templates;
create policy "message_templates_update_own"
on public.message_templates
for update
to authenticated
using (public.is_business_member_active(business_id))
with check (public.is_business_member_active(business_id));

drop policy if exists "message_templates_delete_own" on public.message_templates;
create policy "message_templates_delete_own"
on public.message_templates
for delete
to authenticated
using (public.is_business_member_active(business_id));
