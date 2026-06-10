"use client"

import { BadgeCheck, Ban, CheckCircle2 } from "lucide-react"

import { DashboardDayStatTile } from "@/components/dashboard/dashboard-day-stat-tile"
import { useTranslations } from "@/lib/i18n/use-translations"

type DashboardDayStatsRowProps = {
  statsContextState: "login_required" | "no_data" | null
  statsReady: boolean
  statsError: string | null
  confirmed: number
  cancelled: number
  completed: number
  className?: string
}

export function DashboardDayStatsRow({
  statsContextState,
  statsReady,
  statsError,
  confirmed,
  cancelled,
  completed,
  className,
}: DashboardDayStatsRowProps) {
  const { t } = useTranslations()

  if (statsContextState) {
    return (
      <div
        className={`flex items-center rounded-2xl border border-border bg-muted/25 px-3 py-3 text-sm text-muted-foreground ${className ?? ""}`}
      >
        {statsContextState === "login_required"
          ? t("dashboard.signInToSeePlan")
          : t("dashboard.noDataInBrowser")}
      </div>
    )
  }

  if (!statsReady) {
    return (
      <div
        className={`flex items-center rounded-2xl border border-border bg-muted/25 px-3 py-3 text-sm text-muted-foreground ${className ?? ""}`}
      >
        {statsError ? t("dashboard.summaryLoadFailed") : t("dashboard.statsLoading")}
      </div>
    )
  }

  return (
    <div className={`grid grid-cols-3 gap-2 ${className ?? ""}`}>
      <DashboardDayStatTile
        label={t("dashboard.confirmed")}
        value={confirmed}
        icon={CheckCircle2}
        href="/appointments?status=confirmed&date=today"
      />
      <DashboardDayStatTile
        label={t("dashboard.cancelled")}
        value={cancelled}
        icon={Ban}
        href="/appointments?status=cancelled&date=today"
      />
      <DashboardDayStatTile
        label={t("dashboard.completed")}
        value={completed}
        icon={BadgeCheck}
        href="/appointments?status=completed&date=today"
      />
    </div>
  )
}
