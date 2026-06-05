"use client"

import { LoyaltyPage } from "@/components/loyalty/loyalty-page"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function LojalnoscRoutePage() {
  const { t } = useTranslations()

  return (
    <AppShell title={t("navigation.loyalty")} pageDescription={t("loyaltyPanel.description")}>
      <PageShell>
        <LoyaltyPage />
      </PageShell>
    </AppShell>
  )
}
