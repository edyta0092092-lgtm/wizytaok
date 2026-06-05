"use client"

import { AiReceptionistPage } from "@/components/ai-receptionist/ai-receptionist-page"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function AiRecepcjonistkaRoutePage() {
  const { t } = useTranslations()

  return (
    <AppShell
      title={t("navigation.aiReceptionist")}
      pageDescription={t("aiReceptionistPanel.description")}
    >
      <PageShell>
        <AiReceptionistPage />
      </PageShell>
    </AppShell>
  )
}
