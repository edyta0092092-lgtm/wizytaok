"use client"

import { DashboardDayHero } from "@/components/dashboard/dashboard-day-hero"
import { DashboardDayStatsRow } from "@/components/dashboard/dashboard-day-stats-row"
import { DashboardTodayList } from "@/components/dashboard/dashboard-today-list"
import { DashboardTipCard } from "@/components/dashboard/dashboard-tip-card"
import { OnboardingDashboardCard } from "@/components/onboarding/onboarding-dashboard-card"
import type { Language } from "@/lib/i18n/dictionaries"
import type { Appointment, AppointmentStatus } from "@/types/domain"

type DashboardMobileViewProps = {
  statsContextState: "login_required" | "no_data" | null
  statsReady: boolean
  statsError: string | null
  visitsTodayCount: number
  language: Language
  confirmedToday: number
  cancelledToday: number
  completedToday: number
  todaysListSorted: Appointment[]
  loadError: boolean
  currentTime: Date
  timeFmt: Intl.DateTimeFormat
  onChangeStatus: (
    appointmentId: string,
    currentStatus: AppointmentStatus,
    nextStatus: AppointmentStatus,
  ) => void
}

export function DashboardMobileView({
  statsContextState,
  statsReady,
  statsError,
  visitsTodayCount,
  language,
  confirmedToday,
  cancelledToday,
  completedToday,
  todaysListSorted,
  loadError,
  currentTime,
  timeFmt,
  onChangeStatus,
}: DashboardMobileViewProps) {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <DashboardDayHero
        statsContextState={statsContextState}
        statsReady={statsReady}
        statsError={statsError}
        visitsTodayCount={visitsTodayCount}
        language={language}
        layout="stacked"
        statsSlot={
          <DashboardDayStatsRow
            statsContextState={statsContextState}
            statsReady={statsReady}
            statsError={statsError}
            confirmed={confirmedToday}
            cancelled={cancelledToday}
            completed={completedToday}
          />
        }
      />

      <DashboardTodayList
        rows={todaysListSorted}
        loading={!statsReady}
        loadError={loadError}
        currentTime={currentTime}
        timeFmt={timeFmt}
        onChangeStatus={onChangeStatus}
      />

      <OnboardingDashboardCard />
      <DashboardTipCard />
    </div>
  )
}
