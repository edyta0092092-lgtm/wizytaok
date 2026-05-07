# Flagi testowych integracji (SMS, e-mail, Stripe)

## Przeznaczenie

Integracje testowe są **wyłącznie opcjonalne** i sterowane zmiennymi środowiskowymi. Można je wyłączyć bez usuwania kodu i bez zmiany głównego przepływu aplikacji.

**Komentarz w kodzie:** _Test integrations are feature-flagged and can be disabled via ENV without removing code._ (np. `src/lib/config/test-integration-flags.ts`)

## `ENABLE_TEST_NOTIFICATIONS`

- **Co robi:** po ustawieniu na `true` włącza w panelu **Wiadomości** sekcję testowej wysyłki **tylko dla administratora** (właściciel lub rola `admin` w `business_members`).
- **UI:** przyciski „Wyślij testowy e-mail” i „Wyślij testowy SMS”.
- **Backend:** endpointy `POST /api/test-notifications/email` i `POST /api/test-notifications/sms` odrzucają żądania, gdy flaga nie jest włączona (odpowiedź `404`).
- **Logi:** każda próba zapisuje wpis w `notification_logs` z typem `integration_test`; status `sent` wyłącznie po faktycznym sukcesie dostawcy (Resend / Twilio), w przeciwnym razie `failed`.
- **Wymagane do realnej wysyłki:** zmienne `RESEND_*` / `TWILIO_*` zgodnie z istniejącą konfiguracją projektu.

## `ENABLE_TEST_BILLING`

- **Co robi:** po ustawieniu na `true` pokazuje w **Ustawieniach** kartę testowej płatności Stripe **tylko dla administratora**.
- **Backend:** `POST /api/test-billing/checkout` akceptuje **wyłącznie** klucz `STRIPE_SECRET_KEY` z prefiksem `sk_test_` (klucze produkcyjne są odrzucane).
- **Produkcja:** domyślnie zostaw **`false`** — prawdziwa sprzedaż i subskrypcje wymagają osobnego wdrożenia i nie są tym trybem objęte.

## Włączanie testów lokalnie

1. Skopiuj `.env.example` do `.env.local` (jeśli jeszcze go nie masz).
2. Ustaw np.:
   ```env
   ENABLE_TEST_NOTIFICATIONS=true
   ENABLE_TEST_BILLING=true
   ```
3. Dla wysyłki: uzupełnij `RESEND_API_KEY`, `RESEND_FROM` i/lub zmienne Twilio.
4. Dla Stripe: `STRIPE_SECRET_KEY=sk_test_...` (tylko testowy).
5. Uruchom `npm run dev`.

## Wyłączanie testów

```env
ENABLE_TEST_NOTIFICATIONS=false
ENABLE_TEST_BILLING=false
```

Albo **usuń** te zmienne — domyślnie zachowują się jak wyłączone (wszystko poza literałem `true` jest traktowane jako wyłączone).

Po zmianie ENV zrestartuj serwer deweloperski / ponownie wdróż aplikację.

## Vercel

1. Project → **Settings** → **Environment Variables**.
2. Dodaj:
   - `ENABLE_TEST_NOTIFICATIONS` = `false` lub `true`
   - `ENABLE_TEST_BILLING` = `false` lub `true`
3. Wybierz środowiska (Production / Preview / Development).
4. **Redeploy**, aby proces Next.js wczytał nowe wartości.

## Produkcja

- **Zalecenie:** na produkcji ustaw obie flagi na **`false`**, dopóki nie chcesz świadomie udostępniać testów w panelu.
- Prawdziwa wysyłka przypomnień i przyszłe płatności wymagają **osobnej konfiguracji** dostawców, kluczy oraz (w razie potrzeby) migracji i polityk RLS — ten mechanizm służy wyłącznie **kontrolowanemu testowaniu** za flagą.

## Baza danych

Migracja `043_notification_logs_booking_id_nullable.sql` zezwala na wpisy `notification_logs` bez powiązanej rezerwacji (`booking_id` opcjonalne), aby logować wysyłki testowe z panelu. Nie usuwa ani nie czyści danych.
