"use client"

import Link from "next/link"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/use-translations"

export function BillingRequiredSettingsBanner() {
  const { t } = useTranslations()

  return (
    <div
      className="mb-6 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-4 shadow-sm shadow-slate-900/5"
      role="status"
    >
      <p className="text-sm font-semibold text-foreground">{t("access.activateTitle")}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {t("access.billingRequiredOnSettingsHint")}
      </p>
      <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted-foreground">
        <RefreshCw className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t("access.activatePaymentPending")}</span>
      </p>
      <div className="mt-4">
        <Button type="button" size="sm" className="h-10 rounded-xl" asChild>
          <Link href="/start-trial">{t("access.activateTrialCta")}</Link>
        </Button>
      </div>
    </div>
  )
}
