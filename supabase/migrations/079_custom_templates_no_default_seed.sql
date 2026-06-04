-- Usuń ewentualne wcześniejsze systemowe wpisy we własnych szablonach (np. po starej 075).

delete from public.custom_template_sends cts
 using public.custom_templates ct
 where cts.custom_template_id = ct.id
   and lower(trim(ct.name)) = lower('Podziękowanie po wizycie');

delete from public.custom_templates
 where lower(trim(name)) = lower('Podziękowanie po wizycie');
