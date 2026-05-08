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

  const isPanelAdmin = Boolean(ready && (isOwner || effectiveRole === "admin"))

  const loadBillingRow = React.useCallback(async () => {
    if (!businessId || !isSupabaseConfigured()) {
      setBillingRow(null)
      return
    }
    const client = getBrowserClient()
    if (!client) {
      setBillingRow(null)
      return
    }
    const { data, error } = await client
      .from("business_profiles")
      .select(
        "stripe_subscription_id, stripe_subscription_status, stripe_subscription_current_period_end"
      )
      .eq("id", businessId)
      .maybeSingle()
    if (error || !data) {
      setBillingRow(null)
      return
    }
    setBillingRow({
      stripe_subscription_id: data.stripe_subscription_id ?? null,
      stripe_subscription_status: data.stripe_subscription_status ?? null,
      stripe_subscription_current_period_end: data.stripe_subscription_current_period_end ?? null,
    })
  }, [businessId])

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
    void loadBillingRow()
  }, [loadBillingRow])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const p = new URLSearchParams(window.location.search).get("stripe_test")
    if (p === "success") {
      toast.success(t("settings.testBillingSuccess"))
      void loadBillingRow()
    }
    if (p === "cancel") {
      toast(t("settings.testBillingCancel"))
    }
  }, [loadBillingRow, t])

  if (!ready) return null

  if (!isPanelAdmin) return null

  if (!serverFlags?.testBillingEnabled) return null

  const uiStatus = mapStripeSubscriptionToUiStatus(
    billingRow?.stripe_subscription_id,
    billingRow?.stripe_subscription_status
  )
  const statusLabel = t(`settings.${uiStatusTranslationKey(uiStatus)}` as "settings.testSubStatusNone")

  const periodEndRaw = billingRow?.stripe_subscription_current_period_end?.trim()
  const periodEndLabel = periodEndRaw
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(periodEndRaw))
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
              {t("settings.testBillingPeriodEnd")}: {periodEndLabel}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{t("settings.testBillingStripeNote")}</p>
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const res = await fetch("/api/test-billing/checkout", { method: "POST" })
                const data = (await res.json()) as {
                  ok?: boolean
                  url?: string
                  error?: string
                  hint?: string
                  details?: string[]
                }
                if (res.ok && data.url) {
                  window.location.href = data.url
                  return
                }
                const msg =
                  Array.isArray(data.details) && data.details.length > 0
                    ? data.details.join(" ")
                    : data.hint || data.error || t("settings.testBillingFailed")
                toast.error(msg)
              } catch {
                toast.error(t("settings.testBillingFailed"))
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
