"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

type StartTrialState = "loading" | "error" | "active"

function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? "").trim().toLowerCase()
  return normalized === "trialing" || normalized === "active"
}

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
      return "Baza jest niezsynchronizowana ze schematem (brak kolumny). Uruchom migracje Supabase."
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

  const beginCheckout = React.useCallback(async () => {
    setError(null)
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
      const devSuffix =
        isDev && code
          ? `\n(dev: ${code}${prepareJson?.supabaseMessage ? ` — ${prepareJson.supabaseMessage}` : ""})`
          : ""
      if (process.env.NODE_ENV === "development") {
        console.info("[start-trial] prepare-business-profile failed", {
          status: prepareRes.status,
          code,
          supabaseMessage: prepareJson?.supabaseMessage,
        })
      }
      setState("error")
      setError(`${base}${devSuffix}`)
      return
    }

    if (isActiveSubscriptionStatus(prepareJson.subscriptionStatus)) {
      if (process.env.NODE_ENV === "development") {
        console.info("[start-trial]", { reason: "subscription_already_active" })
      }
      setState("active")
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
      setState("error")
      if (reason === "trial_already_used") {
        setError("Darmowy okres próbny został już wykorzystany dla tej firmy lub osoby.")
      } else if (reason === "subscription_already_exists" || reason === "subscription_already_active") {
        setError("Twój okres próbny jest aktywny.")
      } else {
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
      }
      return
    }

    window.location.href = payload.url
  }, [router, searchParams])

  React.useEffect(() => {
    queueMicrotask(() => {
      void beginCheckout()
    })
  }, [beginCheckout])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>
            {state === "loading"
              ? "Przygotowujemy Twój 30-dniowy okres próbny..."
              : state === "active"
                ? "Twój okres próbny jest aktywny."
                : "Nie udało się rozpocząć okresu próbnego. Spróbuj ponownie."}
          </CardTitle>
          <CardDescription>
            {state === "loading"
              ? "Sprawdzamy konto i przekierowujemy do bezpiecznego checkoutu Stripe."
              : state === "active"
                ? "Możesz przejść do panelu i kontynuować pracę."
                : "Możesz spróbować ponownie albo przejść do panelu."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state === "error" ? (
            <p className="whitespace-pre-wrap text-sm text-destructive">{error}</p>
          ) : null}
          {state === "error" || state === "active" ? (
            <div className="flex flex-wrap gap-2">
              {state === "error" ? (
                <Button type="button" onClick={() => void beginCheckout()}>
                  Spróbuj ponownie
                </Button>
              ) : null}
              <Button
                type="button"
                variant={state === "error" ? "outline" : "default"}
                onClick={() => router.push("/settings")}
              >
                {error?.includes("wykorzystany") ? "Przejdź do subskrypcji" : "Przejdź do panelu"}
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
