"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CreditCard, Loader2, LogOut, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import {
  hasStripeCustomerId,
  resolveBillingActivationScenario,
  type BusinessBillingRow,
} from "@/lib/billing/business-billing-state"
import { openCustomerPortal } from "@/lib/billing/customer-portal-client"
import { hasActiveBusinessAccess, resolveEffectiveSubscriptionStatus } from "@/lib/billing/subscription-status"
import { startPaidStripeCheckout } from "@/lib/billing/paid-checkout-client"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

import { StaffBillingAccessPaywall } from "@/components/billing/staff-billing-access-paywall"

type BillingAccessPaywallProps = {
  variant: "owner" | "staff"
}

async function fetchBusinessBillingRow(businessId: string): Promise<BusinessBillingRow | null> {
  if (!isSupabaseConfigured()) return null
  const client = getBrowserClient()
  if (!client) return null
  const { data, error } = await client
    .from("business_profiles")
    .select(
      "subscription_status, stripe_subscription_status, trial_used_at, trial_started_at, stripe_subscription_id, stripe_customer_id"
    )
    .eq("id", businessId)
    .maybeSingle()
  if (error || !data) return null
  return {
    subscription_status: data.subscription_status ?? null,
    stripe_subscription_status: data.stripe_subscription_status ?? null,
    trial_used_at: data.trial_used_at ?? null,
    trial_started_at: data.trial_started_at ?? null,
    stripe_subscription_id: data.stripe_subscription_id ?? null,
    stripe_customer_id: data.stripe_customer_id ?? null,
  }
}

export function BillingAccessPaywall({ variant }: BillingAccessPaywallProps) {
  const { t } = useTranslations()
  const searchParams = useSearchParams()
  const { ready, businessId } = useBusinessAccess()

  const [billingRow, setBillingRow] = React.useState<BusinessBillingRow | null>(null)
  const [billingLoading, setBillingLoading] = React.useState(variant === "owner")
  const [paidBusy, setPaidBusy] = React.useState(false)
  const [portalBusy, setPortalBusy] = React.useState(false)
  const [paidError, setPaidError] = React.useState<string | null>(null)
  const [stripeReturnNotice, setStripeReturnNotice] = React.useState<string | null>(null)

  const refreshBillingRow = React.useCallback(async () => {
    if (!businessId) {
      setBillingRow(null)
      setBillingLoading(false)
      return
    }
    setBillingLoading(true)
    const row = await fetchBusinessBillingRow(businessId)
    setBillingRow(row)
    setBillingLoading(false)
  }, [businessId])

  React.useEffect(() => {
    if (variant !== "owner") return
    void refreshBillingRow()
  }, [variant, refreshBillingRow])

  React.useEffect(() => {
    if (variant !== "owner") return
    const paid = searchParams.get("stripe_paid")
    const test = searchParams.get("stripe_test")
    const portal = searchParams.get("portal")
    if (portal === "return") {
      setStripeReturnNotice(t("access.portalReturnNotice"))
      void refreshBillingRow()
    } else if (paid === "success" || test === "success") {
      setStripeReturnNotice(t("access.activatePaymentProcessing"))
      void refreshBillingRow()
    } else if (paid === "cancel" || test === "cancel") {
      setStripeReturnNotice(null)
    }
  }, [searchParams, refreshBillingRow, t, variant])

  const logout = async () => {
    const client = getBrowserClient()
    if (client) await client.auth.signOut()
    window.location.href = "/login"
  }

  const handlePayForAccess = React.useCallback(async () => {
    setPaidError(null)
    setPaidBusy(true)
    try {
      const result = await startPaidStripeCheckout()
      if (result.ok) {
        window.location.href = result.url
        return
      }
      setPaidError(result.message)
    } finally {
      setPaidBusy(false)
    }
  }, [])

  const handleOpenCustomerPortal = React.useCallback(async () => {
    setPaidError(null)
    setPortalBusy(true)
    try {
      const result = await openCustomerPortal("activate-access")
      if (result.ok) {
        window.location.href = result.url
        return
      }
      setPaidError(result.message)
    } finally {
      setPortalBusy(false)
    }
  }, [])

  if (variant === "staff") {
    return <StaffBillingAccessPaywall />
  }

  const scenario =
    !ready || billingLoading
      ? "loading"
      : resolveBillingActivationScenario(billingRow, billingLoading)

  const effectiveStatus = billingRow
    ? resolveEffectiveSubscriptionStatus(
        billingRow.subscription_status,
        billingRow.stripe_subscription_status,
      )
    : null
  const panelUnlocked = hasActiveBusinessAccess(effectiveStatus)

  let title = t("access.activateTitle")
  let description = t("access.activateDescription")
  const hasCustomer = hasStripeCustomerId(billingRow)

  let showTrialCta = false
  let showPayCta = true
  let showAfterPayNote = false
  let showPastDueHint = false
  let primaryPortalUpdate = false
  let showManagePortal = false

  switch (scenario) {
    case "subscription_active":
      title = t("access.activateAlreadyActiveTitle")
      description = t("access.activateAlreadyActiveDescription")
      showTrialCta = false
      showPayCta = false
      showManagePortal = hasCustomer
      break
    case "trial_never_used":
      title = t("access.activateTitle")
      description = t("access.activateDescription")
      showTrialCta = true
      showPayCta = true
      showAfterPayNote = false
      break
    case "trial_consumed":
      title = t("access.activateContinueTitle")
      description = t("access.activateContinueDescription")
      showTrialCta = false
      showPayCta = true
      showAfterPayNote = true
      break
    case "payment_past_due":
      title = t("access.activatePaymentPastDueTitle")
      description = t("access.activatePaymentPastDueDescription")
      showTrialCta = false
      showPastDueHint = !hasCustomer
      if (hasCustomer) {
        primaryPortalUpdate = true
        showPayCta = false
      } else {
        showPayCta = true
      }
      break
    case "subscription_canceled":
      title = t("access.activateCanceledTitle")
      description = t("access.activateCanceledDescription")
      showTrialCta = false
      showPayCta = true
      showManagePortal = hasCustomer
      break
    default:
      break
  }

  const actionBusy = paidBusy || portalBusy

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
            {scenario === "loading" ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <CreditCard className="size-5" aria-hidden />
            )}
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
            {scenario !== "subscription_active" && scenario !== "loading" ? (
              <p className="pt-2 text-sm font-medium text-foreground">{t("access.activatePriceLine")}</p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {stripeReturnNotice ? (
            <p
              className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground"
              role="status"
            >
              {stripeReturnNotice}
            </p>
          ) : null}
          {paidError ? (
            <p
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {paidError}
            </p>
          ) : null}
          {showPastDueHint ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("access.activatePaymentPastDueHint")}
            </p>
          ) : null}

          {scenario === "subscription_active" || panelUnlocked ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="button" className="h-11 rounded-xl" asChild>
                <Link href="/dashboard">{t("access.activateGoToPanel")}</Link>
              </Button>
              {showManagePortal ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl"
                  disabled={actionBusy || scenario === "loading"}
                  onClick={() => void handleOpenCustomerPortal()}
                >
                  {portalBusy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      {t("settings.testBillingBusy")}
                    </>
                  ) : (
                    t("access.manageSubscriptionCta")
                  )}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {primaryPortalUpdate ? (
                <Button
                  type="button"
                  className="h-11 rounded-xl"
                  disabled={actionBusy || scenario === "loading"}
                  onClick={() => void handleOpenCustomerPortal()}
                >
                  {portalBusy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      {t("settings.testBillingBusy")}
                    </>
                  ) : (
                    t("access.updatePaymentCta")
                  )}
                </Button>
              ) : null}
              {showTrialCta ? (
                <Button
                  type="button"
                  className="h-11 rounded-xl"
                  variant={scenario === "trial_never_used" ? "default" : "outline"}
                  asChild
                >
                  <Link href="/start-trial">{t("access.activateTrialCta")}</Link>
                </Button>
              ) : null}
              {showPayCta ? (
                <Button
                  type="button"
                  variant={
                    primaryPortalUpdate || scenario === "trial_never_used" || showManagePortal
                      ? "outline"
                      : "default"
                  }
                  className="h-11 rounded-xl"
                  disabled={actionBusy || scenario === "loading"}
                  onClick={() => void handlePayForAccess()}
                >
                  {paidBusy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      {t("settings.testBillingBusy")}
                    </>
                  ) : (
                    t("access.activatePayCta")
                  )}
                </Button>
              ) : null}
              {showManagePortal && !primaryPortalUpdate ? (
                <Button
                  type="button"
                  variant={showPayCta || showTrialCta ? "outline" : "default"}
                  className="h-11 rounded-xl"
                  disabled={actionBusy || scenario === "loading"}
                  onClick={() => void handleOpenCustomerPortal()}
                >
                  {portalBusy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      {t("settings.testBillingBusy")}
                    </>
                  ) : (
                    t("access.manageSubscriptionCta")
                  )}
                </Button>
              ) : null}
            </div>
          )}

          {showAfterPayNote && !panelUnlocked ? (
            <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
              <RefreshCw className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{t("access.activateAfterPayNote")}</span>
            </p>
          ) : null}

          {!panelUnlocked && scenario !== "subscription_active" ? (
            <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
              <RefreshCw className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{t("access.activatePaymentPending")}</span>
            </p>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            className="h-10 px-0 text-muted-foreground"
            onClick={() => void logout()}
          >
            <LogOut className="mr-2 size-4" aria-hidden />
            {t("auth.logOut")}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
