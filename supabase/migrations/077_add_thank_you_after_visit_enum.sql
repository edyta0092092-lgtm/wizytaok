-- Krok 1/2: nowa wartość enum (osobna migracja — PostgreSQL wymaga commit przed użyciem).

do $$ begin
  alter type public.message_template_type add value 'thank_you_after_visit';
exception
  when duplicate_object then null;
end $$;
