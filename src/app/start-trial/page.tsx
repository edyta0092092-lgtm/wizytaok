"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

type StartTrialState = "loading" | "error"

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
      setState("error")
      setError("Konfiguracja aplikacji jest niepelna. Sprobuj ponownie za chwile.")
      return
    }

    const client = getBrowserClient()
    if (!client) {
      setState("error")
      setError("Nie mozna uruchomic sesji. Odswiez strone i sprobuj ponownie.")
      return
    }

    const {
      data: { user },
    } = await client.auth.getUser()

    if (!user) {
      router.replace("/signup?startTrial=true")
      return
    }

    const { data: profile } = await client
      .from("business_profiles")
      .select("id, subscription_status")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (!profile?.id) {
      router.replace("/settings?setup=business")
      return
    }

    if (isActiveSubscriptionStatus(profile.subscription_status)) {
      router.replace("/settings")
      return
    }

    const source =
      searchParams.get("source")?.trim() ||
      (user ? "landing_trial_existing_user" : "landing_trial_signup")
    const checkoutRes = await fetch("/api/test-billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source }),
    })

    let payload: { url?: string; hint?: string; error?: string } | null = null
    try {
      payload = (await checkoutRes.json()) as { url?: string; hint?: string; error?: string }
    } catch {
      payload = null
    }

    if (checkoutRes.status === 409) {
      router.replace("/settings")
      return
    }

    if (!checkoutRes.ok || !payload?.url) {
      setState("error")
      setError(
        payload?.hint?.trim() ||
          "Nie udalo sie uruchomic Stripe Checkout. Sprawdz konfiguracje testowego billingu i sprobuj ponownie."
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
          <CardTitle>{state === "loading" ? "Uruchamianie checkout..." : "Nie udalo sie uruchomic triala"}</CardTitle>
          <CardDescription>
            {state === "loading"
              ? "Sprawdzamy konto i przekierowujemy do bezpiecznego checkoutu Stripe."
              : "Mozesz sprobowac ponownie albo przejsc do ustawien subskrypcji."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state === "error" ? <p className="text-sm text-destructive">{error}</p> : null}
          {state === "error" ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void beginCheckout()}>
                Sprobuj ponownie
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/settings")}>
                Przejdz do ustawien
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

