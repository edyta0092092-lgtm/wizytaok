"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { DashboardMobileNextAppointment } from "@/components/dashboard/dashboard-mobile-next-appointment"
import { DashboardMobileStatTiles } from "@/components/dashboard/dashboard-mobile-stat-tiles"
import { DashboardMobileUpcomingList } from "@/components/dashboard/dashboard-mobile-upcoming-list"
import { useDashboardUnreadMessagesCount } from "@/lib/dashboard/use-dashboard-unread-messages-count"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { Appointment } from "@/types/domain"

type DashboardMobileViewProps = {
  businessId: string | null | undefined
  daySummary: string
  problemsCount: number
  statsReady: boolean
  todayCount: number
  nextAppointment: Appointment | null
  todaysListSorted: Appointment[]
  currentTime: Date
  timeFmt: Intl.DateTimeFormat
}

export function DashboardMobileView({
  businessId,
  daySummary,
  problemsCount,
  statsReady,
  todayCount,
  nextAppointment,
  todaysListSorted,
  currentTime,
  timeFmt,
}: DashboardMobileViewProps) {
  const { t } = useTranslations()
  const { count: unreadMessagesCount, loading: messagesLoading } =
    useDashboardUnreadMessagesCount(businessId)

  return (
    <div className="flex flex-col gap-4 pb-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("navigation.today")}</h1>
        <p className="text-sm text-muted-foreground">{daySummary}</p>
      </header>

      {statsReady && problemsCount > 0 ? (
        <Link
          href="/appointments?filter=needs_action"
          className="flex min-h-11 touch-manipulation items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>{t("dashboard.daySummaryProblems").replace("{count}", String(problemsCount))}</span>
        </Link>
      ) : null}

      <DashboardMobileNextAppointment
        appointment={nextAppointment}
        currentTime={currentTime}
        loading={!statsReady}
        timeFmt={timeFmt}
      />

      <DashboardMobileStatTiles
        todayCount={todayCount}
        unreadMessagesCount={unreadMessagesCount}
        statsLoading={!statsReady}
        messagesLoading={messagesLoading}
      />

      <DashboardMobileUpcomingList
        rows={todaysListSorted}
        excludeId={nextAppointment?.id}
        currentTime={currentTime}
        loading={!statsReady}
        timeFmt={timeFmt}
      />
    </div>
  )
}
