"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/use-translations"
import { startPaidStripeCheckout } from "@/lib/billing/paid-checkout-client"

export function BillingRequiredSettingsBanner() {
  const { t } = useTranslations()
  const [paidBusy, setPaidBusy] = React.useState(false)
  const [paidError, setPaidError] = React.useState<string | null>(null)

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
      <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted-foreground">
        <RefreshCw className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t("access.activatePaymentPending")}</span>
      </p>
      {paidError ? (
        <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {paidError}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="h-10 rounded-xl"
          disabled={paidBusy}
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
        <Button type="button" size="sm" variant="outline" className="h-10 rounded-xl" asChild>
          <Link href="/start-trial">{t("access.activateTrialCta")}</Link>
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-10 rounded-xl" asChild>
          <Link href="/activate-access">{t("access.activateBackToSummary")}</Link>
        </Button>
      </div>
    </div>
  )
}
