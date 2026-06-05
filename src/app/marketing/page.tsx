"use client"

import { MarketingPage } from "@/components/marketing/marketing-page"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function MarketingRoutePage() {
  const { t } = useTranslations()

  return (
    <AppShell title={t("navigation.marketing")} pageDescription={t("marketingPanel.description")}>
      <PageShell>
        <MarketingPage />
      </PageShell>
    </AppShell>
  )
}
