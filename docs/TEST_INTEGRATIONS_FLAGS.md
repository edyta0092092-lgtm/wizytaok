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

- **Co robi:** po ustawieniu na `true` pokazuje w **Ustawieniach** kartę **testowej subskrypcji** Stripe (plan 149 zł / miesiąc, trial 14 dni) **tylko dla administratora / właściciela**.
- **Backend:** `POST /api/test-billing/checkout` — `mode: subscription`, wymaga **`STRIPE_PRICE_ID`** (`price_…`, cena miesięczna skonfigurowana w Stripe), **`STRIPE_SECRET_KEY`** (`sk_test_`), opcjonalnie **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** (jeśli ustawione — musi być `pk_test_`). Powrót z Checkout: **`NEXT_PUBLIC_SITE_URL`** (fallback: `APP_ORIGIN` / `NEXT_PUBLIC_APP_URL` / `VERCEL_URL`).
- **Webhook:** `POST /api/stripe/webhook` — wymaga **`STRIPE_WEBHOOK_SECRET`** (`whsec_…`, tryb testowy w Stripe). Zdarzenia aktualizują pola `stripe_*` w `business_profiles` (status jest **tylko informacyjny** — brak blokady panelu).
- **Produkcja:** domyślnie zostaw **`false`**, dopóki nie chcesz tego świadomie udostępnić.

## Włączanie testów lokalnie

1. Skopiuj `.env.example` do `.env.local` (jeśli jeszcze go nie masz).
2. Ustaw np.:
   ```env
   ENABLE_TEST_NOTIFICATIONS=true
   ENABLE_TEST_BILLING=true
   ```
3. Dla wysyłki: uzupełnij `RESEND_API_KEY`, `RESEND_FROM` i/lub zmienne Twilio.
4. Dla Stripe: `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_PRICE_ID=price_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`, `NEXT_PUBLIC_SITE_URL`, opcjonalnie `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`.
5. Zastosuj migrację `044_business_profiles_stripe_subscription.sql` w Supabase (kolumny `stripe_*` na `business_profiles`).
6. Uruchom `npm run dev`.

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

- Migracja `043_notification_logs_booking_id_nullable.sql` — logi testowych SMS/e-mail bez `booking_id`.
- Migracja `044_business_profiles_stripe_subscription.sql` — pola `stripe_customer_id`, `stripe_subscription_id`, `stripe_subscription_status`, `stripe_subscription_current_period_end` (dodanie kolumn, bez usuwania danych).
