"use client"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { StatisticsDashboard } from "@/components/statistics/statistics-dashboard"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function StatisticsPage() {
  const { t, language } = useTranslations()
  const description =
    language === "en"
      ? "KPIs, trends, services, team workload, bookings, notifications, and occupancy."
      : "KPI, trendy, usługi, obłożenie zespołu, rezerwacje, powiadomienia i zajętość."

  return (
    <AppShell title={t("navigation.statistics")} pageDescription={description}>
      <PageShell>
        <StatisticsDashboard />
      </PageShell>
    </AppShell>
  )
}
