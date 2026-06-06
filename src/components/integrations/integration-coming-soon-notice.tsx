"use client"

import { Badge } from "@/components/ui/badge"
import { useTranslations } from "@/lib/i18n/use-translations"

export function IntegrationComingSoonNotice() {
  const { t } = useTranslations()

  return (
    <div className="space-y-2">
      <Badge
        variant="outline"
        className="w-fit rounded-lg border-primary/30 bg-primary/5 text-primary"
      >
        {t("integrationsPage.comingSoonBadge")}
      </Badge>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("integrationsPage.comingSoonDescription")}
      </p>
    </div>
  )
}
