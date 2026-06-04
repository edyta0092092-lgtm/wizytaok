-- Krok 2/2: szablon w message_templates (uruchom po 077).

delete from public.custom_template_sends cts
 using public.custom_templates ct
 where cts.custom_template_id = ct.id
   and lower(trim(ct.name)) = lower('Podziękowanie po wizycie');

delete from public.custom_templates
 where lower(trim(name)) = lower('Podziękowanie po wizycie');

insert into public.message_templates (business_id, type, channel, title, content, status)
select
  bp.id,
  'thank_you_after_visit'::public.message_template_type,
  'sms'::public.message_template_channel,
  'Podziękowanie po wizycie',
  'Cześć {{imie}}, dziękujemy za skorzystanie z naszych usług. Jeśli potrzebujesz, zapraszamy ponownie: {{link_rezerwacji}}. Pozdrawiamy, {{nazwa_firmy}}',
  'active'::public.message_template_status
from public.business_profiles bp
where not exists (
  select 1
  from public.message_templates mt
  where mt.business_id = bp.id
    and mt.type = 'thank_you_after_visit'
    and mt.channel = 'sms'
);

insert into public.message_templates (business_id, type, channel, title, content, status)
select
  bp.id,
  'thank_you_after_visit'::public.message_template_type,
  'email'::public.message_template_channel,
  '{{nazwa_firmy}}: Dziękujemy za wizytę',
  'Cześć {{imie}},

dziękujemy za skorzystanie z naszych usług. Jeśli potrzebujesz, zapraszamy ponownie:
{{link_rezerwacji}}

Pozdrawiamy,
{{nazwa_firmy}}',
  'active'::public.message_template_status
from public.business_profiles bp
where not exists (
  select 1
  from public.message_templates mt
  where mt.business_id = bp.id
    and mt.type = 'thank_you_after_visit'
    and mt.channel = 'email'
);
