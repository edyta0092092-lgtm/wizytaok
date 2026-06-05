"use client"

import { ShieldAlert } from "lucide-react"

import { useTranslations } from "@/lib/i18n/use-translations"

export function MarketingLegalNotice() {
  const { t } = useTranslations()
  return (
    <div className="flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{t("marketingPanel.legalConsent")}</p>
    </div>
  )
}
