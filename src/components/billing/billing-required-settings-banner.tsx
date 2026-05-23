"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import {
  hasStripeCustomerId,
  resolveBillingActivationScenario,
  type BusinessBillingRow,
} from "@/lib/billing/business-billing-state"
import { openCustomerPortal } from "@/lib/billing/customer-portal-client"
import { hasActiveBusinessAccess, resolveEffectiveSubscriptionStatus } from "@/lib/billing/subscription-status"
import { fetchTrialStartEligibility } from "@/lib/billing/trial-eligibility-client"
import { startPaidStripeCheckout } from "@/lib/billing/paid-checkout-client"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

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

export function BillingRequiredSettingsBanner() {
  const { t } = useTranslations()
  const { businessId } = useBusinessAccess()
  const [billingRow, setBillingRow] = React.useState<BusinessBillingRow | null>(null)
  const [paidBusy, setPaidBusy] = React.useState(false)
  const [portalBusy, setPortalBusy] = React.useState(false)
  const [paidError, setPaidError] = React.useState<string | null>(null)
  const [portalNotice, setPortalNotice] = React.useState<string | null>(null)
  const [trialGloballyBlocked, setTrialGloballyBlocked] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (new URLSearchParams(window.location.search).get("portal") === "return") {
      setPortalNotice(t("access.portalReturnNotice"))
    }
  }, [t])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!businessId) {
        if (!cancelled) setBillingRow(null)
        return
      }
      const row = await fetchBusinessBillingRow(businessId)
      if (!cancelled) setBillingRow(row)
    })()
    return () => {
      cancelled = true
    }
  }, [businessId])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await fetchTrialStartEligibility()
      if (!cancelled) setTrialGloballyBlocked(result.blocked)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const scenario = resolveBillingActivationScenario(billingRow, false)
  const hasCustomer = hasStripeCustomerId(billingRow)
  const status = billingRow
    ? resolveEffectiveSubscriptionStatus(
        billingRow.subscription_status,
        billingRow.stripe_subscription_status,
      )
    : null
  const panelUnlocked = hasActiveBusinessAccess(status)

  const showUpdatePayment = hasCustomer && scenario === "payment_past_due"
  const showManageOnly =
    hasCustomer && (panelUnlocked || scenario === "subscription_active") && !showUpdatePayment
  const showManageWithPay =
    hasCustomer && scenario === "subscription_canceled" && !showUpdatePayment
  const showPayAccess =
    !panelUnlocked &&
    !showUpdatePayment &&
    (scenario === "trial_never_used" ||
      scenario === "trial_consumed" ||
      scenario === "subscription_canceled" ||
      (scenario === "payment_past_due" && !hasCustomer))
  const showTrialLink = scenario === "trial_never_used" && !trialGloballyBlocked

  const handlePayForAccess = async () => {
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
  }

  const handleOpenPortal = async () => {
    setPaidError(null)
    setPortalBusy(true)
    try {
      const result = await openCustomerPortal("settings")
      if (result.ok) {
        window.location.href = result.url
        return
      }
      setPaidError(result.message)
    } finally {
      setPortalBusy(false)
    }
  }

  const actionBusy = paidBusy || portalBusy

  return (
    <div
      className="mb-6 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-4 shadow-sm shadow-slate-900/5"
      role="status"
    >
      <p className="text-sm font-semibold text-foreground">{t("access.activateTitle")}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {t("access.billingRequiredOnSettingsHint")}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{t("access.activatePriceLine")}</p>
      {portalNotice ? (
        <p className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground">
          {portalNotice}
        </p>
      ) : (
        <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted-foreground">
          <RefreshCw className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{t("access.activatePaymentPending")}</span>
        </p>
      )}
      {paidError ? (
        <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {paidError}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {showUpdatePayment ? (
          <Button
            type="button"
            size="sm"
            className="h-10 rounded-xl"
            disabled={actionBusy}
            onClick={() => void handleOpenPortal()}
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
        {showManageOnly ? (
          <Button
            type="button"
            size="sm"
            className="h-10 rounded-xl"
            disabled={actionBusy}
            onClick={() => void handleOpenPortal()}
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
        {showPayAccess ? (
          <Button
            type="button"
            size="sm"
            className="h-10 rounded-xl"
            variant={showManageWithPay ? "default" : showManageOnly || showUpdatePayment ? "outline" : "default"}
            disabled={actionBusy}
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
        {showManageWithPay ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10 rounded-xl"
            disabled={actionBusy}
            onClick={() => void handleOpenPortal()}
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
        {showTrialLink ? (
          <Button type="button" size="sm" variant="outline" className="h-10 rounded-xl" asChild>
            <Link href="/start-trial">{t("access.activateTrialCta")}</Link>
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" className="h-10 rounded-xl" asChild>
          <Link href="/activate-access">{t("access.activateBackToSummary")}</Link>
        </Button>
      </div>
    </div>
  )
}
