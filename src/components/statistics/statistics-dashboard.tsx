"use client"

import * as React from "react"
import { AlertCircle, BarChart3 } from "lucide-react"

import { StatisticsHeatmap } from "@/components/statistics/statistics-heatmap"
import { StatisticsKpiGrid } from "@/components/statistics/statistics-kpi-grid"
import { StatisticsLineChart } from "@/components/statistics/statistics-line-chart"
import { StatisticsNotificationsCard } from "@/components/statistics/statistics-notifications-card"
import { StatisticsOnlineCard } from "@/components/statistics/statistics-online-card"
import { StatisticsProgressList } from "@/components/statistics/statistics-progress-list"
import { StatisticsSkeleton } from "@/components/statistics/statistics-skeleton"
import { StatisticsStatusChart } from "@/components/statistics/statistics-status-chart"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useStatisticsData } from "@/lib/statistics/use-statistics-data"
import type { StatisticsRange } from "@/lib/statistics/statistics-types"

const COPY = {
  pl: {
    heroTitle: "Statystyki WizytaOK",
    heroDescription:
      "Lekki dashboard do szybkiej oceny wizyt, klientów, rezerwacji online, zespołu i powiadomień.",
    heroBadge: "MVP analityki",
    rangeLabel: "Zakres",
    loadError: "Nie udało się pobrać części danych. Pokazuję dostępne statystyki.",
    noData: "Brak danych w wybranym zakresie.",
    kpis: {
      visitsToday: "Wizyty dzisiaj",
      visitsThisMonth: "Wizyty w tym miesiącu",
      completed: "completed",
      cancelled: "cancelled",
      noShow: "no_show",
      newClients: "Nowi klienci",
      onlineVsManual: "Online / manual",
      averageDailyVisits: "Śr. wizyt dziennie",
      onlineShare: "{percent} online w tym miesiącu",
    },
    chart: {
      title: "Trend wizyt",
      subtitle: "Created bookings, completed, cancelled i no_show w wybranym zakresie.",
      ranges: {
        "7d": "7 dni",
        "30d": "30 dni",
        "90d": "90 dni",
        "12m": "12 mies.",
      },
      series: {
        created: "created bookings",
        completed: "completed",
        cancelled: "cancelled",
        noShow: "no_show",
      },
      empty: "Brak wizyt w tym zakresie.",
    },
    services: {
      title: "Top usługi",
      subtitle: "Najczęściej wybierane usługi i ich udział w wizytach.",
      empty: "Brak usług w wybranym zakresie.",
    },
    staff: {
      title: "Top pracownicy",
      subtitle: "Liczba wizyt, completed i udział w obłożeniu.",
      empty: "Brak przypisanych wizyt w wybranym zakresie.",
      completed: "completed",
    },
    statuses: {
      title: "Statusy wizyt",
      subtitle: "Podział statusów w bieżącym miesiącu.",
      labels: {
        confirmed: "confirmed",
        completed: "completed",
        cancelled: "cancelled",
        no_show: "no_show",
      },
    },
    online: {
      title: "Rezerwacje online",
      subtitle: "Porównanie rezerwacji z formularza online i wizyt dodanych ręcznie.",
      labels: {
        online: "Online bookings",
        manual: "Manual bookings",
        percentOnline: "procent online",
      },
    },
    notifications: {
      title: "Powiadomienia",
      subtitle: "Dane z notification_logs, appointment_reminders i lokalnych wysyłek.",
      labels: {
        sms: "Wysłane SMS",
        email: "Wysłane e-maile",
        failed: "Failed notifications",
        successRate: "Reminder success rate",
      },
    },
    heatmap: {
      title: "Heatmap / obłożenie",
      subtitle: "Najbardziej zajęte dni i godziny w wybranym zakresie.",
      busyDays: "Najbardziej zajęte dni",
      busyHours: "Najbardziej zajęte godziny",
    },
  },
  en: {
    heroTitle: "WizytaOK Statistics",
    heroDescription:
      "A lightweight dashboard for visits, clients, online bookings, team workload, and notifications.",
    heroBadge: "Analytics MVP",
    rangeLabel: "Range",
    loadError: "Could not load some data. Showing available statistics.",
    noData: "No data in the selected range.",
    kpis: {
      visitsToday: "Visits today",
      visitsThisMonth: "Visits this month",
      completed: "completed",
      cancelled: "cancelled",
      noShow: "no_show",
      newClients: "New clients",
      onlineVsManual: "Online / manual",
      averageDailyVisits: "Avg. visits daily",
      onlineShare: "{percent} online this month",
    },
    chart: {
      title: "Visit trend",
      subtitle: "Created bookings, completed, cancelled, and no_show in the selected range.",
      ranges: {
        "7d": "7 days",
        "30d": "30 days",
        "90d": "90 days",
        "12m": "12 mo.",
      },
      series: {
        created: "created bookings",
        completed: "completed",
        cancelled: "cancelled",
        noShow: "no_show",
      },
      empty: "No visits in this range.",
    },
    services: {
      title: "Top services",
      subtitle: "Most selected services and their visit share.",
      empty: "No services in the selected range.",
    },
    staff: {
      title: "Top staff",
      subtitle: "Visits, completed count, and workload share.",
      empty: "No assigned visits in the selected range.",
      completed: "completed",
    },
    statuses: {
      title: "Visit statuses",
      subtitle: "Status breakdown for the current month.",
      labels: {
        confirmed: "confirmed",
        completed: "completed",
        cancelled: "cancelled",
        no_show: "no_show",
      },
    },
    online: {
      title: "Online bookings",
      subtitle: "Comparison of online form bookings and manually added visits.",
      labels: {
        online: "Online bookings",
        manual: "Manual bookings",
        percentOnline: "online percentage",
      },
    },
    notifications: {
      title: "Notifications",
      subtitle: "Data from notification_logs, appointment_reminders, and local sends.",
      labels: {
        sms: "Sent SMS",
        email: "Sent emails",
        failed: "Failed notifications",
        successRate: "Reminder success rate",
      },
    },
    heatmap: {
      title: "Heatmap / workload",
      subtitle: "Busiest days and hours in the selected range.",
      busyDays: "Busiest days",
      busyHours: "Busiest hours",
    },
  },
} as const

export function StatisticsDashboard() {
  const { language } = useTranslations()
  const [range, setRange] = React.useState<StatisticsRange>("30d")
  const copy = COPY[language]
  const { ready, loadError, dataset } = useStatisticsData({
    range,
    locale: language,
  })

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-border/80 bg-card shadow-sm shadow-slate-900/5">
        <div className="relative px-5 py-6 sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/10 to-transparent" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <BarChart3 className="size-3.5" aria-hidden />
                {copy.heroBadge}
              </div>
              <h1 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {copy.heroTitle}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {copy.heroDescription}
              </p>
            </div>
            {dataset ? (
              <div className="rounded-2xl border border-border/80 bg-background/80 px-4 py-3 text-sm shadow-sm">
                <p className="text-xs text-muted-foreground">{copy.rangeLabel}</p>
                <p className="mt-1 font-semibold tabular-nums text-foreground">
                  {dataset.totalInRange} {language === "en" ? "visits" : "wizyt"}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {loadError ? (
        <Card className="rounded-3xl border-amber-500/30 bg-amber-500/10 text-amber-950 shadow-sm dark:text-amber-100">
          <CardContent className="flex items-start gap-3 px-4 py-4">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-sm">{copy.loadError}</p>
          </CardContent>
        </Card>
      ) : null}

      {!ready || !dataset ? (
        <StatisticsSkeleton />
      ) : (
        <>
          <StatisticsKpiGrid kpis={dataset.kpis} copy={copy.kpis} />
          <StatisticsLineChart
            points={dataset.chart}
            range={range}
            onRangeChange={setRange}
            copy={copy.chart}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <StatisticsProgressList
              title={copy.services.title}
              subtitle={copy.services.subtitle}
              items={dataset.topServices}
              empty={copy.services.empty}
            />
            <StatisticsProgressList
              title={copy.staff.title}
              subtitle={copy.staff.subtitle}
              items={dataset.topStaff}
              empty={copy.staff.empty}
              completedLabel={copy.staff.completed}
            />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <StatisticsStatusChart
              title={copy.statuses.title}
              subtitle={copy.statuses.subtitle}
              items={dataset.statuses}
              labels={copy.statuses.labels}
            />
            <StatisticsOnlineCard
              title={copy.online.title}
              subtitle={copy.online.subtitle}
              kpis={dataset.kpis}
              labels={copy.online.labels}
            />
          </div>
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <StatisticsNotificationsCard
              title={copy.notifications.title}
              subtitle={copy.notifications.subtitle}
              stats={dataset.notifications}
              labels={copy.notifications.labels}
            />
            <StatisticsHeatmap
              title={copy.heatmap.title}
              subtitle={copy.heatmap.subtitle}
              days={dataset.busyDays}
              hours={dataset.busyHours}
              busyDaysTitle={copy.heatmap.busyDays}
              busyHoursTitle={copy.heatmap.busyHours}
            />
          </div>
        </>
      )}
    </div>
  )
}
