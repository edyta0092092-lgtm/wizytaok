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
      const retry = await loadProfile()
      profile = retry.data ?? null
    }

    if (!profile?.id) {
      if (process.env.NODE_ENV === "development") {
        console.info("[start-trial]", {
          reason: "business_profile_missing_after_retry",
          businessProfileCreated,
          membershipCreated,
        })
      }
      setState("error")
      setError("Nie udało się rozpocząć okresu próbnego. Spróbuj ponownie.")
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source }),
    })

    let payload: {
      url?: string
      hint?: string
      error?: string
      message?: string
      reason?: string
      debug?: { hasStripePriceId?: boolean }
    } | null = null
    try {
      payload = (await checkoutRes.json()) as {
        url?: string
        hint?: string
        error?: string
        message?: string
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
      if (process.env.NODE_ENV === "development") {
        console.info("[start-trial]", {
          reason,
          status: checkoutRes.status,
          payload,
        })
      }
      setState("error")
      if (reason === "trial_already_used") {
        setError("Darmowy okres próbny został już wykorzystany.")
      } else if (reason === "subscription_already_exists" || reason === "subscription_already_active") {
        setError("Twój okres próbny jest aktywny.")
      } else {
        setError("Nie udało się rozpocząć okresu próbnego. Spróbuj ponownie.")
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
                Przejdź do panelu
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

