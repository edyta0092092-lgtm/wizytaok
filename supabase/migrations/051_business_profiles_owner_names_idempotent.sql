-- Idempotent: pola właściciela (jeśli baza nie miała wcześniejszej migracji 049).
-- Bez DROP/TRUNCATE/DELETE. Imię nadal może być w owner_name; owner_last_name opcjonalnie.

alter table public.business_profiles
add column if not exists owner_last_name text;

alter table public.business_profiles
add column if not exists owner_first_name text;

comment on column public.business_profiles.owner_name is 'Imię lub pełne imię i nazwisko (schemat historyczny).';
comment on column public.business_profiles.owner_last_name is 'Opcjonalne nazwisko osobno; może być null gdy pełna nazwa w owner_name.';
comment on column public.business_profiles.owner_first_name is 'Opcjonalne; duplikat semantyczny owner_name — na żądanie schematu, bez migracji danych.';
