# SUPABASE MIGRATION LINEAGE — WizytaOK

## Zasada główna

- Nie uruchamiamy ręcznie starych migracji jako „naprawy na szybko”.
- Nie usuwamy historycznych migracji z repo (to historia ewolucji schematu).
- Runtime aplikacji opiera się na **najnowszych wersjach RPC** (nadpisanych przez `create or replace`).
- Każda przyszła zmiana DB powinna być **idempotentna** i bezpieczna (`IF NOT EXISTS`, brak destrukcyjnych operacji).

## Aktywne obszary runtime

| Obszar | Element | Typ | Aktualny status | Dlaczego jest ważny | Czy ruszać? |
|---|---|---|---|---|---|
| Rezerwacje/wizyty | `public.bookings` | tabela | ACTIVE | Główne źródło wizyt, statusów, kalendarza i rezerwacji online | NIE |
| Klienci | `public.clients` | tabela | ACTIVE | Dane klienta, deduplikacja po telefonie/e-mailu, powiązanie `bookings.client_id` | NIE |
| Zespół | `public.staff_members` | tabela | ACTIVE | Pracownicy, przypisania, dostępność i obsada wizyt | NIE |
| Zespół-usługi | `public.staff_services` | tabela | ACTIVE (z compat fallback) | Mapowanie usług do pracowników, publiczny booking staff | NIE |
| Dostępność | `public.availability_rules` | tabela | ACTIVE | Godziny pracy firmy i walidacje terminów | NIE |
| Dostępność | `public.availability_exceptions` | tabela | ACTIVE | Wyjątki dni/godzin pracy | NIE |
| Dostępność-usługi | `public.service_availability_rules` | tabela | ACTIVE | Ograniczenia dostępności per usługa | NIE |
| Wiadomości | `public.message_templates` | tabela | ACTIVE | Szablony SMS/e-mail i typy `booking_*` / reminders | NIE |
| Logi wiadomości | `public.notification_logs` | tabela | ACTIVE | Źródło prawdy dla statusów wysyłki (`sent/queued/failed/...`) | NIE |
| Support chat | `public.support_conversations` | tabela | ACTIVE | Wątki supportu, statusy, soft-hide, realtime | NIE |
| Support chat | `public.support_messages` | tabela | ACTIVE (z legacy kolumnami) | Wiadomości supportu realtime, insert/select przez RLS | NIE |
| Kontekst firmy | `public.business_profiles` | tabela | ACTIVE | Multi-tenant (`business_id`), slug, ustawienia przypomnień | NIE |
| RLS helper | `public.is_business_owner` | funkcja | ACTIVE | Fundament polityk RLS i uprawnień biznesu | NIE |
| RLS helper | `public.is_business_member_active` | funkcja | ACTIVE | Fundament dostępu członków zespołu do zasobów | NIE |
| RLS helper | `public.is_business_settings_admin` | funkcja | ACTIVE | Uprawnienia admin/owner do ustawień i delete | NIE |

## Aktywne RPC i finalne wersje

| RPC | Używane przez | Migracje historyczne | Ostatnia obowiązująca wersja | Uwagi |
|---|---|---|---|---|
| `create_online_booking` | public booking, `bookings-store.ts` | `004`, `005`, `008`, `011`, `031`, `032` | `039_clients_normalized_and_booking_client_id.sql` | Finalnie obsługuje `client_id`, compat dla staff i overlapy |
| `get_booking_by_confirmation_token` | /confirm, public cancel/confirm | `004`, `008`, `011` | `033_get_booking_by_confirmation_token_compat.sql` | Wersja compat JSON oparta o `to_jsonb(b)` |
| `update_booking_by_confirmation_token` | /confirm flow | `004`, `005`, `011`, `034` | `038_remove_reschedule_booking_statuses.sql` | Finalnie bez akcji reschedule/proposal, tylko confirm/cancel |
| `get_booked_slots_for_public_booking` | walidacja slotów w public booking | `005`, `008`, `035` | `038_remove_reschedule_booking_statuses.sql` | Finalnie blokuje tylko aktywne statusy (`booked/pending/confirmed`) |
| `get_public_staff_for_service` | publiczny wybór osoby | `021`, `022` | `023_get_public_staff_staff_member_id.sql` | Wersja pod legacy `staff_member_id` schemat |
| `find_or_create_client` | deduplikacja klienta | n/a (wprowadzone raz) | `039_clients_normalized_and_booking_client_id.sql` | Krytyczne dla logiki klient po phone/email |
| `get_business_profile_by_slug` | `/book/[slug]`, profile publiczne | `001` | `018_fix_public_booking_profile_rpc_slug_only.sql` | Naprawa pod `business_profiles.slug` |
| `is_business_slug_available` | ustawienia profilu firmy | `001` | `001_business_profiles.sql` | Stabilne RPC walidacyjne |
| `get_business_invitation_public` | strona akceptacji zaproszenia | `010` | `010_business_members_roles_and_rls.sql` | Kontrakt JSON używany w UI |
| `accept_business_invitation` | akceptacja zaproszenia | `010` | `013_business_member_staff_link.sql` | Nadpisane pod `staff_member_id` |
| `ensure_owner_membership` | bootstrap ownera do `business_members` | `010` | `010_business_members_roles_and_rls.sql` | Krytyczne dla uprawnień owner/admin |
| `set_business_member_display_name` | profil konta/team | `010` | `010_business_members_roles_and_rls.sql` | Używane przez panel account/team |

## Migracje legacy / hotfix / compat

Poniższe migracje są częścią kompatybilności i historii produkcyjnej.  
**Nie usuwać ich z repo** i **nie odpalać ręcznie ponownie bez jasno zdefiniowanego powodu**.

- `031_create_online_booking_staff_services_compat.sql`
- `032_create_online_booking_legacy_bookings_compat.sql`
- `033_get_booking_by_confirmation_token_compat.sql`
- `034_update_booking_by_confirmation_token_compat.sql`
- `035_get_booked_slots_for_public_booking_duration.sql`
- `038_remove_reschedule_booking_statuses.sql`
- `039_clients_normalized_and_booking_client_id.sql`
- `041_ensure_message_templates_exists.sql`
- `042_bookings_cancelled_columns_safety.sql`

Rola tych migracji:
- naprawy kompatybilności między różnymi środowiskami/schematami,
- bezpieczne domknięcie brakujących obiektów (`041`, `042`),
- finalizacja kontraktów RPC używanych przez runtime.

## Elementy podejrzane, ale nie do usuwania

To lista do przyszłej analizy architektonicznej.  
**To NIE jest zgoda na usuwanie**:

- `public.support_tickets` (legacy model support przed `support_conversations`)
- `public.support_messages.ticket_id` (legacy ślad w schemacie)
- `public.businesses` (stary model tenantu)
- `public.appointments` (stary model wizyt)
- `supabase/schema.sql` (historyczny bootstrap, nie pełna prawda o aktualnym runtime)

## Proponowane oznaczenia w Supabase SQL Editor

Rekomendowane prefiksy nazw zapisanych zapytań:

- `[ACTIVE]`
- `[LEGACY]`
- `[DO_NOT_RUN]`
- `[DIAGNOSTIC]`
- `[SUPERSEDED]`

To dotyczy tylko listy **Saved Queries** w UI Supabase SQL Editor, nie obiektów bazy.

## Checklist przed jakąkolwiek przyszłą zmianą bazy

- [ ] Backup/snapshot środowiska
- [ ] Audyt użycia tabel/kolumn/RPC w kodzie
- [ ] Migracja idempotentna (bez operacji destrukcyjnych)
- [ ] Testy lokalne migracji
- [ ] Testy ręczne paneli (Wizyty, Online booking, Klienci, Grafik, Wiadomości, Zespół, Support)
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Ręczne potwierdzenie przed produkcją
