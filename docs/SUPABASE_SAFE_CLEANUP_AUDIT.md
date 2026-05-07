# SUPABASE SAFE CLEANUP AUDIT (WizytaOK)

Data audytu: 2026-05-07  
Zakres: wyłącznie audyt i plan porządkowania (bez destrukcyjnych zmian).

## Metoda

- Przejrzano migracje w `supabase/migrations` oraz `supabase/schema.sql`.
- Przejrzano użycie Supabase w kodzie (`from(...)`, `rpc(...)`, realtime `channel(...)`, RLS helpery).
- Porównano elementy używane runtime z elementami historycznymi/kompatybilnościowymi.
- Nie wykonano żadnej operacji usuwającej dane ani struktury.

## Macierz audytu

| Obszar | Element | Typ | Status | Gdzie używane w kodzie | Ryzyko zmiany | Rekomendacja | Czy można bezpiecznie ruszać |
|---|---|---|---|---|---|---|---|
| Wizyty / rezerwacje | `public.bookings` | tabela | używane | `bookings-store.ts`, `cancel-by-company/route.ts`, `schedule/page.tsx`, `today-dashboard-stats.ts`, `sending-history-section.tsx`, `slot-availability.ts` | Wysokie | Nie ruszać struktury bez planu kompatybilności | NIE |
| Wizyty / rezerwacje | `bookings.status` + `bookings_status_chk` | kolumna | używane | filtry/statusy w panelu wizyt i API anulowania | Wysokie | Utrzymać obecny zestaw statusów (`booked/pending/confirmed/no_show/cancelled`) | NIE |
| Wizyty / rezerwacje | `create_online_booking` | funkcja / RPC | używane | `bookings-store.ts` (`rpc("create_online_booking")`) | Wysokie | Nie zmieniać sygnatury bez warstwy compat | NIE |
| Wizyty / rezerwacje | `get_booking_by_confirmation_token` | funkcja / RPC | używane | `bookings-store.ts`, `api/public/cancel-booking/route.ts`, `booking-confirmed-server.ts` | Wysokie | Nie ruszać kontraktu JSON bez migracji aplikacji | NIE |
| Wizyty / rezerwacje | `update_booking_by_confirmation_token` | funkcja / RPC | używane | `bookings-store.ts`, `booking-confirmed-server.ts` | Wysokie | Pozostawić wersję po `038` (bez starych akcji reschedule) | NIE |
| Wizyty / rezerwacje | `get_booked_slots_for_public_booking` | funkcja / RPC | używane | `slot-availability.ts` | Wysokie | Zachować logikę overlap i aktywne statusy | NIE |
| Wizyty / rezerwacje | `bookings_delete_own` policy | policy | używane | delete wizyty (`deleteBooking`) + RLS | Wysokie | Nie zmieniać bez testów ról owner/admin/staff | TYLKO PO POTWIERDZENIU |
| Klienci | `public.clients` | tabela | używane | `clients.repository.ts`, `clients-store.ts`, `clients/page.tsx`, `find-or-create-client.ts` | Wysokie | Nie usuwać kolumn normalized* / indeksów | NIE |
| Klienci | `find_or_create_client` | funkcja / RPC | używane | `find-or-create-client.ts`, `create_online_booking` w migracji `039` | Średnie | Zachować; ewentualnie tylko dokumentacja działania | TYLKO PO POTWIERDZENIU |
| Zespół | `public.staff_members`, `public.staff_services` | tabela | używane | `staff-store.ts`, `team/page.tsx`, public booking staff selection | Wysokie | Nie zmieniać nazw kolumn bez kompatybilności (`staff_id`/`staff_member_id`) | NIE |
| Zespół | `get_public_staff_for_service` | funkcja / RPC | używane | `staff-store.ts` | Wysokie | Utrzymać obecną wersję compat (legacy schematy) | NIE |
| Dostępność | `availability_rules`, `availability_exceptions`, `service_availability_rules` | tabela | używane | `availability-store.ts`, `services-store.ts` | Wysokie | Nie ruszać RLS i relacji z `business_id` | NIE |
| Wiadomości | `public.message_templates` | tabela | używane | `message-templates-section.tsx`, `template-runtime.ts`, repo templates | Wysokie | Utrzymać tabelę + RLS helpery | NIE |
| Wiadomości | `public.notification_logs` | tabela | używane | `sending-history-section.tsx`, `today-dashboard-stats.ts`, `reminders*.ts`, cancellation notifications | Wysokie | Nie zmieniać `status` i `type` bez mapowania UI | NIE |
| Wiadomości | `message_template_type` enum (rozszerzany) | kolumna / enum | potencjalnie zdublowane | migracje `037`, `040`, `041` | Średnie | Nie usuwać wartości; tylko udokumentować i utrzymać add-if-missing | TYLKO PO POTWIERDZENIU |
| Support live chat | `support_conversations`, `support_messages`, realtime publication | tabela / trigger / publication | używane | `help/page.tsx`, `support/page.tsx` (`channel(...postgres_changes...)`) | Wysokie | Nie ruszać triggerów i publication | NIE |
| Support live chat | `support_tickets` + `support_messages.ticket_id` legacy | tabela/kolumna | stare | brak realnego użycia runtime (tylko typy DB) | Średnie | Oznaczyć jako legacy do archiwizacji decyzją manualną | TYLKO PO POTWIERDZENIU |
| Auth/role | `is_business_owner`, `is_business_member_active`, `is_business_settings_admin` | funkcja | używane | polityki RLS, `041`, większość paneli | Wysokie | Nie ruszać implementacji bez pełnego testu RLS | NIE |
| Auth/role | `ensure_owner_membership`, `set_business_member_display_name` | funkcja / RPC | używane | `business-access-context.tsx`, `account/page.tsx` | Średnie | Zachować sygnaturę i `SECURITY DEFINER` | NIE |
| Zaproszenia | `get_business_invitation_public`, `accept_business_invitation` | funkcja / RPC | używane | `accept-invite/[token]/page.tsx` | Średnie | Nie zmieniać kontraktu JSON bez migracji frontendu | NIE |
| Business profile | `get_business_profile_by_slug`, `is_business_slug_available` | funkcja / RPC | używane | `public-booking-slug.ts`, `business-profile.repository.ts` | Średnie | Zachować; tylko dokumentacyjne porządki | NIE |
| Legacy schema | `public.businesses`, `public.appointments` | tabela | niepewne / stare | używane tylko przez `business.repository.ts` i `appointments.repository.ts` (brak realnego użycia UI) | Średnie | Trzymać jako legacy; nie usuwać bez pełnej inwentaryzacji produkcji | TYLKO PO POTWIERDZENIU |
| Migracje | podwójne numery migracji (`021`, `022`, `023`) | migracja | potencjalnie zdublowane | katalog `supabase/migrations` | Niskie runtime / średnie operacyjne | Nie kasować; dodać README z chronologią i przeznaczeniem | TAK |
| Migracje | compat/hotfix 031-035, 038, 041, 042 | migracja | używane / krytyczne | związane z RPC i stabilnością schematu | Średnie | Utrzymać idempotentność, nie porządkować agresywnie | NIE |

## Na pewno nie ruszać

- `bookings` + wszystkie krytyczne RPC: `create_online_booking`, `get_booking_by_confirmation_token`, `update_booking_by_confirmation_token`, `get_booked_slots_for_public_booking`.
- RLS helpery: `is_business_owner`, `is_business_member_active`, `is_business_settings_admin`.
- `notification_logs` i mapowanie statusów używane przez panel wiadomości.
- Realtime chat: `support_conversations`, `support_messages`, publication `supabase_realtime`, triggery dotyku `updated_at`.
- Polityki RLS na `bookings/services/clients/support_*` bez pełnych testów ról.

## Prawdopodobne duplikaty

- **Wersjonowanie RPC przez wielokrotne `create or replace`:**
  - `create_online_booking` w: `004`, `005`, `008`, `011`, `031`, `032`, `039`.
  - `get_booking_by_confirmation_token` w: `004`, `011`, `033`.
  - `update_booking_by_confirmation_token` w: `004`, `005`, `011`, `034`, `038`.
  - `get_booked_slots_for_public_booking` w: `005`, `008`, `035`, `038`.
- **`get_public_staff_for_service`** nadpisywane w: `021_public_staff_for_service_booking`, `022_get_public_staff_service_uuid_normalize`, `023_get_public_staff_staff_member_id`.
- **Support RLS** ewoluujące i częściowo nakładające się: `022`, `024`, `025`, `026`, `030`.
- **Kolumny anulowania**: `037` i `042` (druga to safety/idempotent fallback).

## Podejrzane / stare elementy (do ręcznej decyzji)

- `support_tickets` oraz legacy `support_messages.ticket_id` (model przed `support_conversations`).
- `public.businesses` i `public.appointments` z `schema.sql`/repozytoriów legacy, podczas gdy runtime działa na `business_profiles` i `bookings`.
- `supabase/schema.sql` wygląda jak historyczny bootstrap (nie odzwierciedla finalnego runtime 1:1).
- Niespójności nazewnictwa status source:
  - stare: `auto_reminder_24h`
  - nowe: `automatic_24h_reminder`
  - obecnie obsłużone migracjami, ale łatwo o regresję przy ręcznych SQL.

## Bezpieczne poprawki porządkowe (bez zmian danych)

- Dodać dokumentację mapy migracji i "ostatniej obowiązującej wersji" dla każdego RPC.
- Dodać komentarze w migracjach compat (`031-035`, `038`, `041`, `042`) z jednoznacznym celem.
- Dodać `docs/SUPABASE_MIGRATION_LINEAGE.md` (które migracje nadpisują które RPC).
- W kodzie dopisać komentarz przy repozytoriach legacy (`appointments.repository.ts`, `business.repository.ts`) że są nieużywane runtime.
- W SQL Editor (Saved Queries) ręcznie oznaczyć stare zapytania tagami `legacy`, `superseded`, zamiast kasować strukturę DB.

## Proponowana kolejność sprzątania (małe, testowalne kroki)

1. **Krok dokumentacyjny:** dodać linię rodowodu RPC i tabel krytycznych (bez SQL).
2. **Krok operacyjny:** w Saved Queries Supabase schować/oznaczyć zapytania "superseded", bez wykonywania DROP/DELETE.
3. **Krok walidacyjny:** uruchomić checklistę paneli (wizyty/online booking/klienci/grafik/wiadomości/zespół/support).
4. **Krok kompatybilnościowy:** potwierdzić, że produkcja nie używa `businesses`/`appointments`.
5. **Dopiero po potwierdzeniu:** rozważyć archiwizację legacy SQL (bez usuwania tabel/kolumn).

## Czego nie robić

- Nie wykonywać `DROP TABLE`, `TRUNCATE`, `DELETE` danych produkcyjnych.
- Nie usuwać kolumn/constraintów/polityk RLS "na ślepo".
- Nie zmieniać sygnatur RPC używanych przez frontend bez kompatybilnej wersji.
- Nie usuwać historycznych migracji z repo (można tylko oznaczyć jako legacy).
- Nie przywracać usuniętych statusów reschedule do aktywnego runtime.

## Idempotentność migracji – obserwacje

- Wiele nowych migracji jest bezpiecznych (`IF NOT EXISTS`, `DROP ... IF EXISTS`, `DO ... duplicate_object`).
- Najbardziej idempotentne i „ratunkowe”: `041`, `042`.
- Starsze migracje bazowe mają elementy potencjalnie nie-idempotentne przy ponownym ręcznym odpaleniu (np. niektóre `create policy`, `create trigger` bez wcześniejszego `drop if exists`), dlatego powinny być traktowane jako historyczne.

## Ryzyka RLS / business_id

- Runtime jest mocno oparty o `business_id` i helpery `is_business_*`.
- Największe ryzyko regresji to zmiany w policy `bookings_*`, `services_*`, `support_*`, `clients_*`.
- Część kodu ma fallbacki na legacy schematy (`staff_id` vs `staff_member_id`, `business_id` optional w `staff_services`) – to sygnał, że środowiska mogą być niespójne.

## SQL Editor (Saved Queries) – co można ręcznie uprzątnąć bez ryzyka danych

Można ręcznie **usunąć z listy zapisanych zapytań** (UI-only) lub schować:
- stare wersje tych samych RPC oznaczone jako „compat/legacy/hotfix”,
- duplikaty zapytań testowych ad-hoc,
- zapytania diagnostyczne jednorazowe.

To **nie usuwa danych ani obiektów DB**, dotyczy tylko listy zapisanych skryptów w panelu.

## Bezpieczny następny krok

- Zostawić runtime SQL bez zmian.
- Dodać dokument `SUPABASE_MIGRATION_LINEAGE.md` z mapą „active RPC version”.
- Oznaczyć w SQL Editor zapytania: `ACTIVE`, `LEGACY`, `DO_NOT_RUN`.
- Potem wykonać checklistę manualnych testów funkcjonalnych.

## Następny dokument

Szczegółowa mapa aktywnych migracji i RPC znajduje się w:  
`docs/SUPABASE_MIGRATION_LINEAGE.md`
