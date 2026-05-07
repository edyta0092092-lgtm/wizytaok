-- Opcjonalny identyfikator podatkowy (NIP i podobne) przy profilu firmy.

alter table public.business_profiles
add column if not exists tax_id text;

comment on column public.business_profiles.tax_id is 'Optional company tax identifier (e.g. Polish NIP), UI-only enrichment.';
