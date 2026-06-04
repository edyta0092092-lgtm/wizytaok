-- „Podziękowanie po wizycie”: wysyłka przy statusie zrealizowana, nie 20 min po terminie.

update public.custom_templates
   set trigger_type = 'event',
       offset_minutes = null,
       event_key = 'completed'
 where lower(trim(name)) = lower('Podziękowanie po wizycie')
   and trigger_type = 'schedule_after';
