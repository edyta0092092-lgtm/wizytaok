"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { subscriptionStatusBlocksNewCheckout } from "@/lib/billing/subscription-status"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

type StartTrialState =
  | "loading"
  | "error"
  | "nip_exists"
  | "subscription_active"
  | "trial_used"

type PrepareBusinessProfileResponse = {
  ok?: boolean
  error?: string
  supabaseMessage?: string
  subscriptionStatus?: string | null
}

type PrepareErrorCode =
  | "missing_account_type"
  | "missing_company_tax_id"
  | "missing_contact_phone"
  | "missing_slug_or_business_name"
  | "missing_service_role_key"
  | "nip_company_already_exists"
  | "business_profile_insert_failed"
  | "business_profile_update_failed"
  | "membership_insert_failed"
  | "missing_required_column"
  | "rls_blocked"
  | "unauthorized"
  | "no_server"
  | "supabase_unconfigured"

function polishMessageForPrepareError(code: string): string {
  switch (code) {
    case "missing_account_type":
      return "Brak typu działalności w koncie (account_type). Zarejestruj się ponownie lub skontaktuj się z pomocą."
    case "missing_company_tax_id":
      return "Brak NIP w danych konta. Zarejestruj firmę z NIP lub skontaktuj się z pomocą."
    case "missing_contact_phone":
      return "Brak numeru telefonu w danych konta. Zarejestruj się z poprawnym telefonem lub skontaktuj się z pomocą."
    case "missing_slug_or_business_name":
      return "Brak nazwy firmy lub identyfikatora (slug) w koncie. Zarejestruj się ponownie."
    case "missing_service_role_key":
      return "Błąd konfiguracji serwera: brak SUPABASE_SERVICE_ROLE_KEY. Dodaj klucz w Vercel i wdróż ponownie."
    case "business_profile_insert_failed":
      return "Nie udało się utworzyć profilu firmy w bazie (business_profile_insert_failed)."
    case "business_profile_update_failed":
      return "Nie udało się zaktualizować profilu firmy (business_profile_update_failed)."
    case "membership_insert_failed":
      return "Nie udało się utworzyć członkostwa właściciela (membership_insert_failed)."
    case "missing_required_column":
      return [
        "Baza w Supabase nie ma wymaganych kolumn (np. account_type, contact_phone_normalized).",
        "Naprawa: Supabase Dashboard → SQL Editor → wklej i uruchom plik migracji z repozytorium:",
        "supabase/migrations/048_business_profiles_trial_identity_guards.sql",
        "oraz supabase/migrations/050_business_profiles_identity_columns_idempotent.sql",
        "(albo: supabase db push / link migracji z GitHuba do surowego SQL).",
      ].join("\n")
    case "rls_blocked":
      return "Zapis profilu zablokowany przez RLS (rls_blocked). Sprawdź polityki lub użyj service role na serwerze."
    case "no_server":
      return "Brak konfiguracji Supabase po stronie serwera."
    case "supabase_unconfigured":
      return "Aplikacja nie ma skonfigurowanego Supabase."
    default:
      return "Nie udało się przygotować profilu firmy przed płatnością."
  }
}

export default function StartTrialPage() {
  return (
    <Suspense fallback={<StartTrialFallback />}>
      <StartTrialContent />
    </Suspense>
  )
}

function StartTrialContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = React.useState<StartTrialState>("loading")
  const [error, setError] = React.useState<string | null>(null)
  const [trialHeadline, setTrialHeadline] = React.useState<string | null>(null)
  const [loadingKind, setLoadingKind] = React.useState<"trial" | "paid">("trial")

  const beginPaidCheckout = React.useCallback(async () => {
    setError(null)
    setLoadingKind("paid")
    setState("loading")

    const checkoutRes = await fetch("/api/billing/checkout-paid", {
      method: "POST",
      credentials: "same-origin",
    })

    const rawBody = await checkoutRes.text()
    type PaidCheckoutJson = {
      url?: string
      reason?: string
      error?: string
      message?: string
    }
    let payload: PaidCheckoutJson | null = null
    if (rawBody.trim().length > 0) {
      try {
        payload = JSON.parse(rawBody) as PaidCheckoutJson
      } catch {
        payload = null
      }
    }

    const reason = payload?.reason?.trim() ?? ""

    if (!checkoutRes.ok || !payload?.url) {
      if (reason === "subscription_already_active") {
        setState("subscription_active")
        setTrialHeadline(null)
        return
      }
      setState("trial_used")
      const msg =
        payload?.message?.trim() ||
        payload?.error?.trim() ||
        "Nie udało się uruchomić płatnej subskrypcji. Spróbuj ponownie."
      setError(msg)
      return
    }

    window.location.href = payload.url
  }, [])

  const beginCheckout = React.useCallback(async () => {
    setError(null)
    setTrialHeadline(null)
    setLoadingKind("trial")
    setState("loading")

    if (!isSupabaseConfigured()) {
      if (process.env.NODE_ENV === "development") {
        console.info("[start-trial]", { reason: "supabase_not_configured" })
      }
      setState("error")
      setError(polishMessageForPrepareError("supabase_unconfigured"))
      return
    }

    const client = getBrowserClient()
    if (!client) {
      if (process.env.NODE_ENV === "development") {
        console.info("[start-trial]", { reason: "browser_client_missing" })
      }
      setState("error")
      setError("Nie mozna uruchomic sesji. Odswiez strone i sprobuj ponownie.")
      return
    }

    const {
      data: { user },
    } = await client.auth.getUser()

    if (!user) {
      if (process.env.NODE_ENV === "development") {
        console.info("[start-trial]", { reason: "login_required" })
      }
      router.replace("/login?next=%2Fstart-trial")
      return
    }

    const prepareRes = await fetch("/api/start-trial/prepare-business-profile", {
      method: "POST",
      credentials: "same-origin",
    })

    let prepareJson: PrepareBusinessProfileResponse | null = null
    try {
      prepareJson = (await prepareRes.json()) as PrepareBusinessProfileResponse
    } catch {
      prepareJson = null
    }

    if (!prepareRes.ok || prepareJson?.ok !== true) {
      if (prepareRes.status === 401) {
        router.replace("/login?next=%2Fstart-trial")
        return
      }
      const code = (prepareJson?.error ?? "").trim() as PrepareErrorCode | string
      const base = polishMessageForPrepareError(code || "unknown")
      const isDev = process.env.NODE_ENV !== "production"
      const showDbDetail =
        Boolean(prepareJson?.supabaseMessage) &&
        (isDev ||
          code === "missing_required_column" ||
          code === "business_profile_insert_failed" ||
          code === "business_profile_update_failed" ||
          code === "membership_insert_failed")
      const devSuffix =
        isDev && code
          ? `\n(dev: ${code}${prepareJson?.supabaseMessage ? ` — ${prepareJson.supabaseMessage}` : ""})`
          : showDbDetail && !isDev && prepareJson?.supabaseMessage
            ? `\n\nSzczegół: ${prepareJson.supabaseMessage}`
            : ""
      if (process.env.NODE_ENV === "development") {
        console.info("[start-trial] prepare-business-profile failed", {
          status: prepareRes.status,
          code,
          supabaseMessage: prepareJson?.supabaseMessage,
        })
      }
      if (code === "nip_company_already_exists") {
        setState("nip_exists")
        setError(null)
        return
      }
      setState("error")
      setError(`${base}${devSuffix}`)
      return
    }

    if (subscriptionStatusBlocksNewCheckout(prepareJson.subscriptionStatus)) {
      if (process.env.NODE_ENV === "development") {
        console.info("[start-trial]", { reason: "subscription_already_active" })
      }
      setState("subscription_active")
      return
    }

    const source = searchParams.get("source")?.trim() || "landing_trial_signup"
    const checkoutRes = await fetch("/api/test-billing/checkout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source }),
    })

    const rawBody = await checkoutRes.text()
    let payload: {
      url?: string
      hint?: string
      error?: string
      message?: string
      reason?: string
      details?: string[]
      debug?: { hasStripePriceId?: boolean }
    } | null = null
    if (rawBody.trim().length > 0) {
      try {
        payload = JSON.parse(rawBody) as {
          url?: string
          hint?: string
          error?: string
          message?: string
          reason?: string
          details?: string[]
          debug?: { hasStripePriceId?: boolean }
        }
      } catch {
        payload = null
      }
    }

    if (!checkoutRes.ok || !payload?.url) {
      const reason =
        payload?.reason?.trim() ||
        payload?.error?.trim() ||
        (!payload?.url ? "checkout_url_missing" : "checkout_failed")
      if (process.env.NODE_ENV === "development") {
        console.info("[start-trial]", {
          reason,
          status: checkoutRes.status,
          payload,
          rawBodyPreview: rawBody.slice(0, 500),
        })
      }

      if (
        reason === "subscription_already_exists" ||
        reason === "subscription_already_active"
      ) {
        setState("subscription_active")
        setError(null)
        return
      }

      if (reason === "trial_already_used") {
        const headline =
          typeof payload?.message === "string" && payload.message.trim().length > 0
            ? payload.message.trim()
            : "Darmowy okres próbny został już wykorzystany dla tej firmy."
        setTrialHeadline(headline)
        setState("trial_used")
        setError(null)
        return
      }

      setState("error")
      const rawErr = typeof payload?.error === "string" ? payload.error.trim() : ""
      const detailsJoined =
        Array.isArray(payload?.details) && payload.details.length > 0
          ? payload.details.filter((s) => typeof s === "string" && s.trim().length > 0).join(" ")
          : ""
      const backendMessage =
        payload?.message?.trim() ||
        payload?.hint?.trim() ||
        detailsJoined ||
        (rawErr === "unauthorized"
          ? "Sesja wygasła lub nie jesteś zalogowany. Odśwież stronę i zaloguj się ponownie."
          : rawErr === "no_business"
            ? "Nie znaleziono profilu firmy powiązanego z kontem."
            : rawErr === "test_billing_disabled"
              ? "Brak konfiguracji Stripe dla okresu próbnego (sprawdź zmienne na serwerze)."
              : rawErr.length > 0
                ? rawErr
                : !payload && rawBody.trim().length > 0
                  ? `Odpowiedź serwera (${checkoutRes.status}): ${rawBody.slice(0, 280)}${rawBody.length > 280 ? "…" : ""}`
                  : "")
      const isDev = process.env.NODE_ENV !== "production"
      const devCheckout =
        isDev && (payload?.reason || payload?.error)
          ? `\n(dev: ${payload?.reason ?? payload?.error ?? reason})`
          : ""
      setError(
        (backendMessage.length > 0
          ? backendMessage
          : checkoutRes.status >= 500
            ? `Błąd serwera (${checkoutRes.status}). Spróbuj za chwilę lub skontaktuj się z pomocą.`
            : "Nie udało się rozpocząć okresu próbnego. Spróbuj ponownie.") + devCheckout
      )
      return
    }

    window.location.href = payload.url
  }, [router, searchParams])

  React.useEffect(() => {
    queueMicrotask(() => {
      void beginCheckout()
    })
  }, [beginCheckout])

  const paidCtaDescription =
    "Możesz kontynuować korzystanie z WizytaOK w ramach abonamentu 149 zł / miesiąc."

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>
            {state === "loading"
              ? loadingKind === "paid"
                ? "Przekierowujemy do bezpiecznej płatności Stripe..."
                : "Przygotowujemy Twój 14-dniowy okres próbny..."
              : state === "nip_exists"
                ? "Firma z tym NIP już istnieje w WizytaOK."
                : state === "subscription_active"
                  ? "Subskrypcja jest już aktywna."
                  : state === "trial_used"
                    ? trialHeadline ?? "Darmowy okres próbny został już wykorzystany dla tej firmy."
                    : "Nie udało się rozpocząć okresu próbnego. Spróbuj ponownie."}
          </CardTitle>
          <CardDescription>
            {state === "loading"
              ? loadingKind === "paid"
                ? "Otwieramy stronę Stripe z subskrypcją miesięczną (bez okresu próbnego)."
                : "Sprawdzamy konto i przekierowujemy do bezpiecznego checkoutu Stripe."
              : state === "nip_exists"
                ? "Zaloguj się na konto właściciela lub poproś o dostęp do tej firmy."
                : state === "subscription_active"
                  ? "Możesz przejść do panelu i kontynuować pracę."
                  : state === "trial_used"
                    ? paidCtaDescription
                    : "Możesz spróbować ponownie albo przejść do panelu."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state === "error" ? (
            <p className="whitespace-pre-wrap text-sm text-destructive">{error}</p>
          ) : null}
          {state === "error" ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void beginCheckout()}>
                Spróbuj ponownie
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
                Przejdź do panelu
              </Button>
            </div>
          ) : null}
          {state === "trial_used" ? (
            <>
              {error ? <p className="whitespace-pre-wrap text-sm text-destructive">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void beginPaidCheckout()}>
                  Wykup subskrypcję
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
                  Przejdź do panelu
                </Button>
              </div>
            </>
          ) : null}
          {state === "subscription_active" ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => router.push("/dashboard")}>
                Przejdź do panelu
              </Button>
            </div>
          ) : null}
          {state === "nip_exists" ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => router.push("/login?next=%2Fdashboard")}>
                Zaloguj się
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/support")}>
                Poproś o dostęp
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}

function StartTrialFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Uruchamianie checkout...</CardTitle>
          <CardDescription>Przygotowujemy bezpieczne przekierowanie do Stripe.</CardDescription>
        </CardHeader>
      </Card>
    </main>
  )
}
