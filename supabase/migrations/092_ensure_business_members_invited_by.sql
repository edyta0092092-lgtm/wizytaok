-- Błąd aplikacji: Could not find the 'invited_by' column of 'business_members' in the schema cache
-- (migracja 010 nie była uruchomiona w tym projekcie Supabase).

alter table public.business_members
  add column if not exists invited_by uuid references auth.users (id) on delete set null;
