-- Błąd aplikacji: Could not find the 'is_active' column of 'business_members' in the schema cache
-- (migracja 010 / 052 nie była uruchomiona w tym projekcie Supabase).

alter table public.business_members
  add column if not exists is_active boolean not null default true;

alter table public.business_members
  add column if not exists updated_at timestamptz not null default now();
