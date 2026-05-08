"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ensureBusinessProfileFromUserMetadata } from "@/lib/supabase/ensure-profile-from-metadata"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

type StartTrialState = "loading" | "error" | "active"

function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? "").trim().toLowerCase()
  return normalized === "trialing" || normalized === "active"
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
      setError("Konfiguracja aplikacji jest niepelna. Sprobuj ponownie za chwile.")
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

    const loadProfile = async () =>
      client
        .from("business_profiles")
        .select("id, subscription_status, stripe_customer_id, stripe_subscription_id")
        .eq("owner_id", user.id)
        .maybeSingle()

    let { data: profile } = await loadProfile()

    let businessProfileCreated = false
    let membershipCreated = false
    if (!profile?.id) {
      try {
        const ensureResult = await ensureBusinessProfileFromUserMetadata(client, {
          allowFallbackProfile: true,
        })
        businessProfileCreated = ensureResult.businessProfileCreated
        membershipCreated = ensureResult.membershipCreated
      } catch {
        // best effort fallback for flows that skipped auth/callback profile creation
      }
      let retry = await loadProfile()
      profile = retry.data ?? null
    }

    if (!profile?.id) {
      const serverEnsure = await fetch("/api/auth/ensure-business-profile", {
        method: "POST",
        credentials: "same-origin",
      })
      let serverPayload: { ok?: boolean; error?: string } | null = null
      try {
        serverPayload = (await serverEnsure.json()) as { ok?: boolean; error?: string }
      } catch {
        serverPayload = null
      }
      if (serverEnsure.ok && serverPayload?.ok === true) {
        const afterServer = await loadProfile()
        profile = afterServer.data ?? null
      } else {
        if (serverEnsure.status === 401) {
          router.replace("/login?next=%2Fstart-trial")
          return
        }
        const code = typeof serverPayload?.error === "string" ? serverPayload.error.trim() : ""
        if (process.env.NODE_ENV === "development") {
          console.info("[start-trial]", {
            reason: "business_profile_missing_after_retry",
            businessProfileCreated,
            membershipCreated,
            serverEnsure: serverEnsure.status,
            serverError: code,
          })
        }
        setState("error")
        if (code === "service_role_required") {
          setError(
            "Serwer nie może utworzyć profilu firmy. Dodaj zmienną SUPABASE_SERVICE_ROLE_KEY w ustawieniach Vercel (Project → Settings → Environment Variables) i wdróż ponownie."
          )
        } else if (code === "incomplete_user_metadata") {
          setError(
            "Konto nie ma danych rejestracji (slug / nazwa firmy). Zarejestruj się ponownie lub skontaktuj się z pomocą."
          )
        } else if (code === "profile_insert_failed") {
          setError(
            "Nie udało się zapisać profilu firmy w bazie. Spróbuj ponownie za chwilę lub skontaktuj się z pomocą."
          )
        } else {
          setError(
            "Nie znaleziono profilu firmy po zalogowaniu. Spróbuj wylogować się i zalogować ponownie albo skontaktuj się z pomocą."
          )
        }
        return
      }
    }

    if (!profile?.id) {
      setState("error")
      setError(
        "Nie znaleziono profilu firmy po zalogowaniu. Spróbuj wylogować się i zalogować ponownie albo skontaktuj się z pomocą."
      )
      return
    }

    if (isActiveSubscriptionStatus(profile.subscription_status)) {
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
        setError(
          backendMessage.length > 0
            ? backendMessage
            : checkoutRes.status >= 500
              ? `Błąd serwera (${checkoutRes.status}). Spróbuj za chwilę lub skontaktuj się z pomocą.`
              : "Nie udało się rozpocząć okresu próbnego. Spróbuj ponownie."
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
          {state === "error" ? <p className="text-sm text-destructive">{error}</p> : null}
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

