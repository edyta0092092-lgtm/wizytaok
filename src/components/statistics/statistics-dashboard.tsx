"use client"

import * as React from "react"
import { AlertCircle, BarChart3 } from "lucide-react"

import { StatisticsHeatmap } from "@/components/statistics/statistics-heatmap"
import { StatisticsKpiGrid } from "@/components/statistics/statistics-kpi-grid"
import {
  StatisticsLineChart,
  type StatisticsMonthOption,
} from "@/components/statistics/statistics-line-chart"
import { StatisticsNotificationsCard } from "@/components/statistics/statistics-notifications-card"
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
      "Lekki dashboard do szybkiej oceny wizyt, klientów, zespołu i powiadomień.",
    heroBadge: "MVP analityki",
    rangeLabel: "Zakres",
    loadError: "Nie udało się pobrać części danych. Pokazuję dostępne statystyki.",
    noData: "Brak danych w wybranym zakresie.",
    kpis: {
      visitsToday: "Wizyty dzisiaj",
      visitsThisMonth: "Wizyty w tym miesiącu",
      completed: "Zrealizowane",
      cancelled: "Anulowane",
      noShow: "Nieobecność klienta",
      newClients: "Nowi klienci",
    },
    chart: {
      title: "Trend wizyt",
      subtitle:
        "Łączna liczba wizyt dziennie (wg daty wizyty) w wybranym zakresie. Najedź na słupek, aby zobaczyć podział na statusy.",
      ranges: {
        "7d": "7 dni",
        "30d": "30 dni",
        "90d": "90 dni",
        "12m": "12 mies.",
      },
      series: {
        confirmed: "Potwierdzone",
        completed: "Zrealizowane",
        cancelled: "Anulowane",
        noShow: "Nieobecność klienta",
      },
      total: "Razem",
      monthPlaceholder: "Miesiąc…",
      monthHint: "Każdy słupek to jeden dzień wybranego miesiąca.",
      empty: "Brak wizyt w tym zakresie.",
      axes: {
        x: "Data",
        y: "Liczba wizyt",
      },
      periodHint: {
        "7d": "Każdy słupek to jeden dzień (ostatnie 7 dni).",
        "30d": "Każdy słupek to jeden dzień (ostatnie 30 dni).",
        "90d": "Każdy słupek to jeden tydzień (ostatnie 90 dni).",
        "12m": "Każdy słupek to jeden miesiąc (ostatnie 12 miesięcy).",
      },
    },
    services: {
      title: "Top usługi",
      subtitle: "Najczęściej wybierane usługi i ich udział w wizytach.",
      empty: "Brak usług w wybranym zakresie.",
    },
    staff: {
      title: "Top pracownicy",
      subtitle: "Liczba wizyt, zrealizowanych wizyt i udział w obłożeniu.",
      empty: "Brak przypisanych wizyt w wybranym zakresie.",
      completed: "zrealizowane",
    },
    notifications: {
      title: "Powiadomienia",
      subtitle: "Wysłane SMS, e-maile i przypomnienia w wybranym zakresie.",
      labels: {
        sms: "Wysłane SMS",
        email: "Wysłane e-maile",
        failed: "Błędy wysyłki",
        failedHint: "Ile prób wysyłki zakończyło się błędem (SMS/e-mail).",
        successRate: "Skuteczność dostarczenia",
        successRateHint: "Odsetek udanych wysyłek wśród wszystkich prób.",
      },
    },
    heatmap: {
      title: "Obłożenie",
      subtitle:
        "Kiedy masz najwięcej pracy. Dni tygodnia – łączna liczba zrealizowanych wizyt; godziny – średnia liczba wizyt na dzień roboczy.",
      busyDays: "Najbardziej zajęte dni tygodnia",
      busyHours: "Najbardziej zajęte godziny",
      busyDaysHint:
        "Łączna liczba zrealizowanych wizyt w danym dniu tygodnia w wybranym zakresie.",
      busyHoursHint:
        "Średnia liczba zrealizowanych wizyt o danej godzinie, liczona tylko z dni, w których o tej godzinie były wizyty.",
      averageLabel: "wizyt",
      hoursValueLabel: "śr. wizyt/dzień",
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
      completed: "Completed",
      cancelled: "Cancelled",
      noShow: "Client did not attend",
      newClients: "New clients",
    },
    chart: {
      title: "Visit trend",
      subtitle: "Total visits per day (by visit date) in the selected range. Hover a bar to see the status breakdown.",
      ranges: {
        "7d": "7 days",
        "30d": "30 days",
        "90d": "90 days",
        "12m": "12 mo.",
      },
      series: {
        confirmed: "Confirmed",
        completed: "Completed",
        cancelled: "Cancelled",
        noShow: "Client did not attend",
      },
      total: "Total",
      monthPlaceholder: "Month…",
      monthHint: "Each bar is one day of the selected month.",
      empty: "No visits in this range.",
      axes: {
        x: "Date",
        y: "Visit count",
      },
      periodHint: {
        "7d": "Each bar is one day (last 7 days).",
        "30d": "Each bar is one day (last 30 days).",
        "90d": "Each bar is one week (last 90 days).",
        "12m": "Each bar is one month (last 12 months).",
      },
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
    notifications: {
      title: "Notifications",
      subtitle: "Data from notification_logs, appointment_reminders, and local sends.",
      labels: {
        sms: "Sent SMS",
        email: "Sent emails",
        failed: "Send failures",
        failedHint: "How many send attempts ended with an error (SMS/email).",
        successRate: "Delivery success rate",
        successRateHint: "Share of successful sends among all attempts.",
      },
    },
    heatmap: {
      title: "Heatmap / workload",
      subtitle:
        "When you are busiest. Weekdays – total completed visits; hours – average visits per working day.",
      busyDays: "Busiest weekdays",
      busyHours: "Busiest hours",
      busyDaysHint:
        "Total completed visits on a given weekday in the selected range.",
      busyHoursHint:
        "Average completed visits in a given hour, counted only from days that had visits in that hour.",
      averageLabel: "visits",
      hoursValueLabel: "avg visits/day",
    },
  },
} as const

function currentMonthRange(): StatisticsRange {
  const now = new Date()
  return `month:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function StatisticsDashboard() {
  const { language, t } = useTranslations()
  const [range, setRange] = React.useState<StatisticsRange>(currentMonthRange)
  const [statusRange, setStatusRange] = React.useState<StatisticsRange>(currentMonthRange)
  const [heatmapRange, setHeatmapRange] = React.useState<StatisticsRange>(currentMonthRange)
  const copy = COPY[language] ?? COPY.pl
  const { ready, loadError, dataset, statuses, busyDays, busyHours, availableMonths } =
    useStatisticsData({
      range,
      statusRange,
      heatmapRange,
      locale: language,
    })

  const monthOptions = React.useMemo<StatisticsMonthOption[]>(() => {
    const formatter = new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
      month: "long",
      year: "numeric",
    })
    return availableMonths.map((month) => {
      const [year, monthNumber] = month.split("-").map((value) => Number(value))
      const label = formatter.format(new Date(year, (monthNumber || 1) - 1, 1))
      return {
        value: `month:${month}` as StatisticsRange,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      }
    })
  }, [availableMonths, language])

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
            monthOptions={monthOptions}
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
          <StatisticsStatusChart
            title={t("statistics.statusTitle")}
            subtitle={t("statistics.statusSubtitle")}
            items={statuses ?? dataset.statuses}
            empty={t("statistics.statusEmpty")}
            axisY={t("statistics.statusAxisY")}
            range={statusRange}
            ranges={copy.chart.ranges}
            onRangeChange={setStatusRange}
            monthOptions={monthOptions}
            monthPlaceholder={copy.chart.monthPlaceholder}
          />
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
              days={busyDays ?? dataset.busyDays}
              hours={busyHours ?? dataset.busyHours}
              busyDaysTitle={copy.heatmap.busyDays}
              busyHoursTitle={copy.heatmap.busyHours}
              busyDaysHint={copy.heatmap.busyDaysHint}
              busyHoursHint={copy.heatmap.busyHoursHint}
              averageLabel={copy.heatmap.averageLabel}
              hoursValueLabel={copy.heatmap.hoursValueLabel}
              range={heatmapRange}
              ranges={copy.chart.ranges}
              onRangeChange={setHeatmapRange}
              monthOptions={monthOptions}
              monthPlaceholder={copy.chart.monthPlaceholder}
            />
          </div>
        </>
      )}
    </div>
  )
}
