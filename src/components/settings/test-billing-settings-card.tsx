"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import {
  mapStripeSubscriptionToUiStatus,
  type SubscriptionUiStatus,
} from "@/lib/stripe/business-subscription-sync"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

type ServerIntegrationFlags = {
  testBillingEnabled: boolean
  testNotificationsEnabled: boolean
}

type BillingRow = {
  stripe_subscription_id: string | null
  stripe_subscription_status: string | null
  stripe_subscription_current_period_end: string | null
  stripe_subscription_trial_ends_at: string | null
}

async function fetchBillingRowForBusiness(
  businessId: string
): Promise<BillingRow | null> {
  if (!isSupabaseConfigured()) return null
  const client = getBrowserClient()
  if (!client) return null
  const { data, error } = await client
    .from("business_profiles")
    .select(
      "stripe_subscription_id, stripe_subscription_status, stripe_subscription_current_period_end, stripe_subscription_trial_ends_at"
    )
    .eq("id", businessId)
    .maybeSingle()
  if (error || !data) return null
  return {
    stripe_subscription_id: data.stripe_subscription_id ?? null,
    stripe_subscription_status: data.stripe_subscription_status ?? null,
    stripe_subscription_current_period_end: data.stripe_subscription_current_period_end ?? null,
    stripe_subscription_trial_ends_at: data.stripe_subscription_trial_ends_at ?? null,
  }
}

function parseIntegrationResponse(data: unknown): ServerIntegrationFlags {
  if (!data || typeof data !== "object") {
    return { testBillingEnabled: false, testNotificationsEnabled: false }
  }
  const r = data as Record<string, unknown>
  const billing =
    r.testBillingEnabled === true ||
    r.enableTestBilling === true
  const notifications =
    r.testNotificationsEnabled === true ||
    r.enableTestNotifications === true
  return {
    testBillingEnabled: billing,
    testNotificationsEnabled: notifications,
  }
}

function uiStatusTranslationKey(s: SubscriptionUiStatus): string {
  switch (s) {
    case "none":
      return "testSubStatusNone"
    case "trialing":
      return "testSubStatusTrialing"
    case "active":
      return "testSubStatusActive"
    case "payment_required":
      return "testSubStatusPaymentRequired"
    case "canceled":
      return "testSubStatusCanceled"
    default:
      return "testSubStatusUnknown"
  }
}

export function TestBillingSettingsCard() {
  const { t } = useTranslations()
  const { ready, isOwner, effectiveRole, businessId } = useBusinessAccess()
  const [serverFlags, setServerFlags] = React.useState<ServerIntegrationFlags | null>(null)
  const [billingRow, setBillingRow] = React.useState<BillingRow | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null)

  const isPanelAdmin = Boolean(ready && (isOwner || effectiveRole === "admin"))

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/config/test-integrations", { cache: "no-store" })
        const data: unknown = await res.json()
        if (!cancelled) {
          setServerFlags(parseIntegrationResponse(data))
        }
      } catch {
        if (!cancelled) {
          setServerFlags({ testBillingEnabled: false, testNotificationsEnabled: false })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const row = businessId ? await fetchBillingRowForBusiness(businessId) : null
      if (!cancelled) setBillingRow(row)
    })()
    return () => {
      cancelled = true
    }
  }, [businessId])

  const stripeRefreshHandledRef = React.useRef(false)
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const p = new URLSearchParams(window.location.search).get("stripe_test")
    if (p !== "success") return
    if (!businessId) return
    if (stripeRefreshHandledRef.current) return
    stripeRefreshHandledRef.current = true

    let cancelled = false
    void (async () => {
      const row = await fetchBillingRowForBusiness(businessId)
      if (!cancelled) setBillingRow(row)
    })()

    return () => {
      cancelled = true
    }
  }, [businessId])

  if (!ready) return null

  if (!isPanelAdmin) return null

  if (!serverFlags?.testBillingEnabled) return null

  const uiStatus = mapStripeSubscriptionToUiStatus(
    billingRow?.stripe_subscription_id,
    billingRow?.stripe_subscription_status
  )
  const statusLabel = t(`settings.${uiStatusTranslationKey(uiStatus)}` as "settings.testSubStatusNone")

  const periodEndRaw = billingRow?.stripe_subscription_current_period_end?.trim()
  const trialEndRaw = billingRow?.stripe_subscription_trial_ends_at?.trim()
  const showTrialEnd = uiStatus === "trialing" && Boolean(trialEndRaw)
  const relevantEndRaw = showTrialEnd ? trialEndRaw : periodEndRaw
  const endHeading = showTrialEnd
    ? t("settings.testBillingTrialEnds")
    : t("settings.testBillingPeriodEnd")
  const endLabel = relevantEndRaw
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(relevantEndRaw))
    : "—"

  return (
    <div className="mb-6 space-y-3">
      <p
        className="rounded-lg border border-dashed border-primary/35 bg-primary/5 px-3 py-2 text-xs font-medium text-foreground"
        role="status"
        data-testid="test-billing-flag-diagnostic"
      >
        {t("settings.testBillingDiagnosticFlagOn")}
      </p>
      <Card className="rounded-2xl border border-dashed border-violet-500/35 bg-violet-50/30 shadow-sm dark:bg-violet-950/20">
        <CardHeader className="border-b border-border/70 py-4">
          <CardTitle className="text-sm font-semibold">{t("settings.testBillingTitle")}</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {t("settings.testBillingLead")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-1 rounded-xl border border-border/80 bg-muted/25 px-3 py-3 text-xs">
            <p className="font-medium text-foreground">{t("settings.testBillingPlanLine")}</p>
            <p className="text-muted-foreground">{t("settings.testBillingTrialLine")}</p>
          </div>
          <div className="space-y-1 text-xs">
            <p className="font-medium text-foreground">{t("settings.testBillingStatusLabel")}</p>
            <p className="text-foreground">{statusLabel}</p>
            <p className="text-muted-foreground">
              {endHeading}: {endLabel}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{t("settings.testBillingStripeNote")}</p>
          {checkoutError ? (
            <p
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              role="alert"
            >
              {checkoutError}
            </p>
          ) : null}
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={busy}
            onClick={async () => {
              setCheckoutError(null)
              setBusy(true)
              try {
                const res = await fetch("/api/test-billing/checkout", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { Accept: "application/json" },
                })
                type CheckoutJson = {
                  ok?: boolean
                  url?: string
                  error?: string
                  hint?: string
                  details?: string[]
                }
                let data: CheckoutJson = {}
                try {
                  data = (await res.json()) as CheckoutJson
                } catch {
                  data = {}
                }
                const fallbackMsg = t("settings.testBillingCheckoutUnavailable")
                if (res.ok && typeof data.url === "string" && data.url.length > 0) {
                  window.location.href = data.url
                  return
                }
                const detailMsg =
                  Array.isArray(data.details) && data.details.length > 0
                    ? data.details.join(" ")
                    : null
                const hintMsg =
                  typeof data.hint === "string" && data.hint.trim().length > 0
                    ? data.hint.trim()
                    : null
                const errorMsg =
                  typeof data.error === "string" && data.error.trim().length > 0
                    ? data.error.trim()
                    : null
                const msg = detailMsg ?? hintMsg ?? errorMsg ?? fallbackMsg
                setCheckoutError(msg)
                toast.error(msg)
              } catch {
                const msg = t("settings.testBillingCheckoutUnavailable")
                setCheckoutError(msg)
                toast.error(msg)
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? t("settings.testBillingBusy") : t("settings.testBillingCta")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
