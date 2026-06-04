-- Domyślny własny szablon: podziękowanie przy statusie zrealizowana (SMS + e-mail, aktywny).

insert into public.custom_templates (
  business_id,
  name,
  sms_enabled,
  sms_content,
  email_enabled,
  email_subject,
  email_content,
  trigger_type,
  offset_minutes,
  event_key,
  status
)
select
  bp.id,
  'Podziękowanie po wizycie',
  true,
  'Cześć {{imie}}, dziękujemy za skorzystanie z naszych usług. Jeśli potrzebujesz, zapraszamy ponownie: {{link_rezerwacji}}. Pozdrawiamy, {{nazwa_firmy}}',
  true,
  '{{nazwa_firmy}}: Dziękujemy za wizytę',
  'Cześć {{imie}},

dziękujemy za skorzystanie z naszych usług. Jeśli potrzebujesz, zapraszamy ponownie:
{{link_rezerwacji}}

Pozdrawiamy,
{{nazwa_firmy}}',
  'event',
  null,
  'completed',
  'active'
from public.business_profiles bp
where not exists (
  select 1
  from public.custom_templates ct
  where ct.business_id = bp.id
    and ct.trigger_type = 'event'
    and ct.event_key = 'completed'
    and lower(trim(ct.name)) = lower('Podziękowanie po wizycie')
);
