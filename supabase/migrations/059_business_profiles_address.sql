-- Adres firmy (Google Places) — widoczny w przypomnieniach SMS/e-mail.
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS business_address text,
  ADD COLUMN IF NOT EXISTS business_address_place_id text;

COMMENT ON COLUMN public.business_profiles.business_address IS
  'Sformatowany adres firmy z Google Places (do szablonów {{adres_firmy}}).';
COMMENT ON COLUMN public.business_profiles.business_address_place_id IS
  'Google Place ID — potwierdza wybór z autouzupełniania.';
