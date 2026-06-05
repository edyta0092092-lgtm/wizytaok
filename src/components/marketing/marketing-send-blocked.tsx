"use client"

import { Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/use-translations"

export function MarketingSendBlocked() {
  const { t } = useTranslations()
  return (
    <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
      <div className="flex gap-3">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("marketingPanel.sendDisabled")}</p>
          <Button type="button" disabled className="h-10 rounded-xl">
            {t("marketingPanel.sendCampaign")}
          </Button>
        </div>
      </div>
    </div>
  )
}
