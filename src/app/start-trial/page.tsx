"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

type StartTrialState = "loading" | "error"
type StartTrialDiagnostic = {
  currentUserId: string | null
  userEmail: string | null
  businessId: string | null
  businessProfileExists: boolean
  subscriptionStatus: string | null
  stripeSubscriptionStatus: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  enableTestBilling: boolean | null
  hasStripePriceId: boolean | null
  checkoutEndpointCalled: boolean
  checkoutResponseStatus: number | null
  checkoutResponseBody: Record<string, unknown> | null
  reason: string | null
}

const EMPTY_DIAGNOSTIC: StartTrialDiagnostic = {
  currentUserId: null,
  userEmail: null,
  businessId: null,
  businessProfileExists: false,
  subscriptionStatus: null,
  stripeSubscriptionStatus: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  enableTestBilling: null,
  hasStripePriceId: null,
  checkoutEndpointCalled: false,
  checkoutResponseStatus: null,
  checkoutResponseBody: null,
  reason: null,
}

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
  const [diagnostic, setDiagnostic] = React.useState<StartTrialDiagnostic>(EMPTY_DIAGNOSTIC)

  const beginCheckout = React.useCallback(async () => {
    setError(null)
    setState("loading")
    setDiagnostic(EMPTY_DIAGNOSTIC)

    if (!isSupabaseConfigured()) {
      const next = { ...EMPTY_DIAGNOSTIC, reason: "supabase_not_configured" }
      setDiagnostic(next)
      console.info("[start-trial.diagnostic]", next)
      setState("error")
      setError("Konfiguracja aplikacji jest niepelna. Sprobuj ponownie za chwile.")
      return
    }

    const client = getBrowserClient()
    if (!client) {
      const next = { ...EMPTY_DIAGNOSTIC, reason: "browser_client_missing" }
      setDiagnostic(next)
      console.info("[start-trial.diagnostic]", next)
      setState("error")
      setError("Nie mozna uruchomic sesji. Odswiez strone i sprobuj ponownie.")
      return
    }

    let enableTestBilling: boolean | null = null
    try {
      const cfgRes = await fetch("/api/config/test-integrations", { method: "GET" })
      const cfgPayload = (await cfgRes.json()) as { enableTestBilling?: boolean } | null
      enableTestBilling = cfgPayload?.enableTestBilling === true
    } catch {
      enableTestBilling = null
    }

    const {
      data: { user },
    } = await client.auth.getUser()

    if (!user) {
      const next = {
        ...EMPTY_DIAGNOSTIC,
        enableTestBilling,
        reason: "login_required",
      }
      setDiagnostic(next)
      console.info("[start-trial.diagnostic]", next)
      router.replace("/login?next=%2Fstart-trial")
      return
    }

    const { data: profile } = await client
      .from("business_profiles")
      .select("id, subscription_status, stripe_customer_id, stripe_subscription_id")
      .eq("owner_id", user.id)
      .maybeSingle()

    const currentDiagnostic: StartTrialDiagnostic = {
      ...EMPTY_DIAGNOSTIC,
      currentUserId: user.id,
      userEmail: user.email ?? null,
      businessId: profile?.id ?? null,
      businessProfileExists: Boolean(profile?.id),
      subscriptionStatus: profile?.subscription_status?.trim() || null,
      stripeSubscriptionStatus: null,
      stripeCustomerId: profile?.stripe_customer_id?.trim() || null,
      stripeSubscriptionId: profile?.stripe_subscription_id?.trim() || null,
      enableTestBilling,
      hasStripePriceId: null,
      checkoutEndpointCalled: false,
      checkoutResponseStatus: null,
      checkoutResponseBody: null,
      reason: null,
    }

    if (!profile?.id) {
      const next = {
        ...currentDiagnostic,
        reason: "business_profile_missing",
      }
      setDiagnostic(next)
      console.info("[start-trial.diagnostic]", next)
      setState("error")
      setError("Nie udało się rozpocząć okresu próbnego.")
      return
    }

    if (isActiveSubscriptionStatus(profile.subscription_status)) {
      const next = {
        ...currentDiagnostic,
        reason: "subscription_already_active",
      }
      setDiagnostic(next)
      console.info("[start-trial.diagnostic]", next)
      router.replace("/settings")
      return
    }

    const source = searchParams.get("source")?.trim() || "landing_trial_signup"
    const checkoutRes = await fetch("/api/test-billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source }),
    })

    let payload: {
      url?: string
      hint?: string
      error?: string
      reason?: string
      debug?: { hasStripePriceId?: boolean }
    } | null = null
    try {
      payload = (await checkoutRes.json()) as {
        url?: string
        hint?: string
        error?: string
        reason?: string
        debug?: { hasStripePriceId?: boolean }
      }
    } catch {
      payload = null
    }

    if (!checkoutRes.ok || !payload?.url) {
      const reason =
        payload?.reason?.trim() ||
        payload?.error?.trim() ||
        (!payload?.url ? "checkout_url_missing" : "checkout_failed")
      const next = {
        ...currentDiagnostic,
        checkoutEndpointCalled: true,
        checkoutResponseStatus: checkoutRes.status,
        checkoutResponseBody: payload as Record<string, unknown> | null,
        hasStripePriceId:
          payload?.debug && typeof payload.debug.hasStripePriceId === "boolean"
            ? payload.debug.hasStripePriceId
            : null,
        reason,
      }
      setDiagnostic(next)
      console.info("[start-trial.diagnostic]", next)
      setState("error")
      setError(
        payload?.hint?.trim() ||
          "Nie udało się rozpocząć triala. Spróbuj ponownie."
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{state === "loading" ? "Przygotowujemy Twój 30-dniowy okres próbny..." : "Nie udało się rozpocząć triala."}</CardTitle>
          <CardDescription>
            {state === "loading"
              ? "Sprawdzamy konto i przekierowujemy do bezpiecznego checkoutu Stripe."
              : "Możesz spróbować ponownie albo przejść do ustawień subskrypcji."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state === "error" ? <p className="text-sm text-destructive">{error}</p> : null}
          {state === "error" ? (
            <pre className="overflow-x-auto rounded border bg-muted/20 p-3 text-xs text-muted-foreground">
              {JSON.stringify(diagnostic, null, 2)}
            </pre>
          ) : null}
          {state === "error" ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void beginCheckout()}>
                Spróbuj ponownie
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/settings")}>
                Przejdź do ustawień
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

