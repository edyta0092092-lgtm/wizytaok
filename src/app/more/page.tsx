"use client"

import { AppShell } from "@/components/layout/app-shell"
import { MobileMoreMenu } from "@/components/layout/mobile-more-menu"
import { PageShell } from "@/components/layout/page-shell"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function MorePage() {
  const { t } = useTranslations()

  return (
    <AppShell title={t("more.title")} pageDescription={t("more.description")}>
      <PageShell>
        <MobileMoreMenu />
      </PageShell>
    </AppShell>
  )
}
