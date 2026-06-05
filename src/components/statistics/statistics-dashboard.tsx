"use client"

import * as React from "react"
import { AlertCircle, BarChart3 } from "lucide-react"

import { StatisticsBookingsCard } from "@/components/statistics/statistics-bookings-card"
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
    heroTitle: "Statystyki",
    heroDescription:
      "Przegląd wizyt, rezerwacji, zespołu i powiadomień — w jednym miejscu, bez przeładowania danymi.",
    heroBadge: "Analityka biznesu",
    rangeLabel: "Wizyty w zakresie",
    loadError: "Nie udało się pobrać części danych. Pokazuję dostępne statystyki.",
    kpis: {
      visitsToday: "Wizyty dzisiaj",
      visitsThisMonth: "Wizyty w tym miesiącu",
      completed: "Zrealizowane",
      cancelled: "Anulowane",
      noShow: "Nieobecność klienta",
      newClients: "Nowi klienci",
      onlineBookings: "Rezerwacje online",
      manualBookings: "Wizyty ręczne",
      avgDailyVisits: "Średnia wizyt / dzień",
    },
    chart: {
      title: "Trend wizyt",
      subtitle:
        "Utworzone wizyty w czasie z podziałem na statusy (wg daty wizyty).",
      ranges: {
        "7d": "7 dni",
        "30d": "30 dni",
        "90d": "90 dni",
        "12m": "12 mies.",
      },
      series: {
        created: "Utworzone wizyty",
        scheduled: "Potwierdzone / zaplanowane",
        completed: "Zrealizowane",
        cancelled: "Anulowane",
        noShow: "Nieobecność klienta",
      },
      total: "Razem",
      monthPlaceholder: "Miesiąc…",
      yearPlaceholder: "Rok…",
      monthHint: "Każdy słupek to jeden dzień wybranego miesiąca.",
      yearHint: "Każdy słupek to jeden miesiąc wybranego roku.",
      empty: "Brak wizyt w tym zakresie.",
      axes: {
        x: "Okres",
        y: "Liczba wizyt",
      },
      periodHint: {
        "7d": "Ostatnie 7 dni — jeden słupek na dzień.",
        "30d": "Ostatnie 30 dni — jeden słupek na dzień.",
        "90d": "Ostatnie 90 dni — jeden słupek na tydzień.",
        "12m": "Ostatnie 12 miesięcy — jeden słupek na miesiąc.",
      },
    },
    services: {
      title: "Top usługi",
      subtitle: "Najczęściej wybierane usługi i udział w wizytach.",
      empty: "Brak usług w wybranym zakresie.",
    },
    staff: {
      title: "Top pracownicy",
      subtitle: "Liczba wizyt, zrealizowane i udział w obłożeniu.",
      empty: "Brak przypisanych wizyt w wybranym zakresie.",
      completed: "zrealizowane",
    },
    bookings: {
      title: "Rezerwacje online",
      subtitle: "Podział wizyt w wybranym zakresie trendu.",
      online: "Online",
      manual: "Ręczne",
      onlineShare: "Udział online",
      empty: "Brak wizyt w wybranym zakresie.",
    },
    notifications: {
      title: "Powiadomienia",
      subtitle: "SMS, e-mail i przypomnienia (notification_logs, appointment_reminders).",
      labels: {
        sms: "Wysłane SMS",
        email: "Wysłane e-maile",
        failed: "Błędy wysyłki",
        failedHint: "Nieudane próby wysyłki w wybranym zakresie.",
        successRate: "Skuteczność przypomnień",
        successRateHint: "Udział udanych wysyłek wśród wszystkich prób.",
      },
    },
    heatmap: {
      title: "Obłożenie",
      subtitle: "Najbardziej zajęte dni tygodnia i godziny (% wizyt w zakresie).",
      busyDays: "Dni tygodnia",
      busyHours: "Godziny",
      busyDaysHint: "Udział wizyt przypadający na dany dzień tygodnia.",
      busyHoursHint: "Udział wizyt przypadający na daną godzinę.",
      averageLabel: "% wizyt",
      hoursValueLabel: "% wizyt",
    },
  },
  en: {
    heroTitle: "Statistics",
    heroDescription:
      "Visits, bookings, team workload, and notifications — one clear view.",
    heroBadge: "Business analytics",
    rangeLabel: "Visits in range",
    loadError: "Could not load some data. Showing available statistics.",
    kpis: {
      visitsToday: "Visits today",
      visitsThisMonth: "Visits this month",
      completed: "Completed",
      cancelled: "Cancelled",
      noShow: "Client did not attend",
      newClients: "New clients",
      onlineBookings: "Online bookings",
      manualBookings: "Manual visits",
      avgDailyVisits: "Avg visits / day",
    },
    chart: {
      title: "Visit trend",
      subtitle: "Created visits over time with status breakdown (by visit date).",
      ranges: {
        "7d": "7 days",
        "30d": "30 days",
        "90d": "90 days",
        "12m": "12 mo.",
      },
      series: {
        created: "Created visits",
        scheduled: "Confirmed / scheduled",
        completed: "Completed",
        cancelled: "Cancelled",
        noShow: "Client did not attend",
      },
      total: "Total",
      monthPlaceholder: "Month…",
      yearPlaceholder: "Year…",
      monthHint: "Each bar is one day of the selected month.",
      yearHint: "Each bar is one month of the selected year.",
      empty: "No visits in this range.",
      axes: {
        x: "Period",
        y: "Visit count",
      },
      periodHint: {
        "7d": "Last 7 days — one bar per day.",
        "30d": "Last 30 days — one bar per day.",
        "90d": "Last 90 days — one bar per week.",
        "12m": "Last 12 months — one bar per month.",
      },
    },
    services: {
      title: "Top services",
      subtitle: "Most selected services and visit share.",
      empty: "No services in the selected range.",
    },
    staff: {
      title: "Top staff",
      subtitle: "Visits, completed count, and workload share.",
      empty: "No assigned visits in the selected range.",
      completed: "completed",
    },
    bookings: {
      title: "Online bookings",
      subtitle: "Visit sources in the selected trend range.",
      online: "Online",
      manual: "Manual",
      onlineShare: "Online share",
      empty: "No visits in the selected range.",
    },
    notifications: {
      title: "Notifications",
      subtitle: "SMS, email, and reminders (notification_logs, appointment_reminders).",
      labels: {
        sms: "Sent SMS",
        email: "Sent emails",
        failed: "Send failures",
        failedHint: "Failed send attempts in the selected range.",
        successRate: "Reminder success rate",
        successRateHint: "Share of successful sends among all attempts.",
      },
    },
    heatmap: {
      title: "Occupancy",
      subtitle: "Busiest weekdays and hours (% of visits in range).",
      busyDays: "Weekdays",
      busyHours: "Hours",
      busyDaysHint: "Share of visits on each weekday.",
      busyHoursHint: "Share of visits at each hour.",
      averageLabel: "% of visits",
      hoursValueLabel: "% of visits",
    },
  },
} as const

const DEFAULT_RANGE: StatisticsRange = "30d"

export function StatisticsDashboard() {
  const { language, t } = useTranslations()
  const [range, setRange] = React.useState<StatisticsRange>(DEFAULT_RANGE)
  const [statusRange, setStatusRange] = React.useState<StatisticsRange>(DEFAULT_RANGE)
  const [heatmapRange, setHeatmapRange] = React.useState<StatisticsRange>(DEFAULT_RANGE)
  const copy = COPY[language] ?? COPY.pl
  const { ready, loadError, dataset, statuses, busyDays, busyHours, availableMonths, availableYears } =
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

  const yearOptions = React.useMemo<StatisticsMonthOption[]>(
    () =>
      availableYears.map((year) => ({
        value: `year:${year}` as StatisticsRange,
        label: year,
      })),
    [availableYears],
  )

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm shadow-slate-900/[0.04]">
        <div className="relative px-5 py-6 sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.07] to-transparent" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
                <BarChart3 className="size-3.5" aria-hidden />
                {copy.heroBadge}
              </div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {copy.heroTitle}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {copy.heroDescription}
              </p>
            </div>
            {dataset ? (
              <div className="shrink-0 rounded-xl border border-border/60 bg-background/90 px-5 py-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {copy.rangeLabel}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {dataset.totalInRange}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {loadError ? (
        <Card className="rounded-2xl border-amber-500/25 bg-amber-500/8 text-amber-950 dark:text-amber-100">
          <CardContent className="flex items-start gap-3 px-4 py-4">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-sm">{copy.loadError}</p>
          </CardContent>
        </Card>
      ) : null}

      {!ready || !dataset ? (
        <StatisticsSkeleton />
      ) : (
        <div className="space-y-8">
          <StatisticsKpiGrid kpis={dataset.kpis} copy={copy.kpis} />

          <StatisticsLineChart
            points={dataset.chart}
            range={range}
            onRangeChange={setRange}
            monthOptions={monthOptions}
            yearOptions={yearOptions}
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

          <div className="grid gap-6 xl:grid-cols-2">
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
              yearOptions={yearOptions}
              yearPlaceholder={copy.chart.yearPlaceholder}
            />
            <StatisticsBookingsCard
              title={copy.bookings.title}
              subtitle={copy.bookings.subtitle}
              channels={dataset.bookingChannels}
              labels={copy.bookings}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
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
              yearOptions={yearOptions}
              yearPlaceholder={copy.chart.yearPlaceholder}
            />
          </div>
        </div>
      )}
    </div>
  )
}
