"use client"

import { CustomersPage } from "@/components/customers/customers-page"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function KlienciPage() {
  const { t } = useTranslations()

  return (
    <AppShell title={t("navigation.clients")} pageDescription={t("customers.description")}>
      <PageShell>
        <CustomersPage />
      </PageShell>
    </AppShell>
  )
}
