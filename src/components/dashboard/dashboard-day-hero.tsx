"use client"

import { CalendarDays } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { formatTodayAppointmentsLabel } from "@/lib/dashboard/today-appointments-label"
import type { Language } from "@/lib/i18n/dictionaries"
import { useTranslations } from "@/lib/i18n/use-translations"

type DashboardDayHeroProps = {
  statsContextState: "login_required" | "no_data" | null
  statsReady: boolean
  statsError: string | null
  visitsTodayCount: number
  language: Language
  statsSlot: React.ReactNode
  layout?: "stacked" | "split"
}

export function DashboardDayHero({
  statsContextState,
  statsReady,
  statsError,
  visitsTodayCount,
  language,
  statsSlot,
  layout = "split",
}: DashboardDayHeroProps) {
  const { t } = useTranslations()

  const title = (() => {
    if (statsContextState === "login_required") {
      return <span className="text-muted-foreground">{t("dashboard.signInToSeePlan")}</span>
    }
    if (statsContextState === "no_data") {
      return <span className="text-muted-foreground">{t("dashboard.noDataInBrowser")}</span>
    }
    if (!statsReady) {
      return statsError ? (
        <span className="text-destructive">{t("dashboard.summaryLoadFailed")}</span>
      ) : (
        <span className="text-muted-foreground">{t("dashboard.statsLoading")}</span>
      )
    }
    if (visitsTodayCount === 0) {
      return t("dashboard.noAppointmentsTodayLong")
    }
    return formatTodayAppointmentsLabel(visitsTodayCount, language)
  })()

  const subtitle =
    statsContextState || !statsReady || statsError ? (
      <p className="mt-1.5 text-sm text-muted-foreground">
        {statsContextState
          ? null
          : statsError
            ? t("dashboard.summaryLoadFailed")
            : t("dashboard.statsLoading")}
      </p>
    ) : null

  return (
    <Card className="rounded-2xl border border-border bg-[color:var(--nav-active-bg)] shadow-sm shadow-slate-900/5">
      <CardContent
        className={
          layout === "split"
            ? "grid gap-4 py-5 sm:py-6 lg:grid-cols-[1fr_minmax(18rem,0.95fr)] lg:items-center"
            : "flex flex-col gap-4 py-5"
        }
      >
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full bg-card/70 px-3 py-1 text-xs font-semibold text-primary">
            <CalendarDays className="size-4" aria-hidden />
            {t("dashboard.heroTitle")}
          </p>
          <h2 className="mt-3 text-xl font-semibold leading-tight text-foreground sm:text-2xl">{title}</h2>
          {subtitle}
        </div>
        <div className="min-w-0 w-full">{statsSlot}</div>
      </CardContent>
    </Card>
  )
}
