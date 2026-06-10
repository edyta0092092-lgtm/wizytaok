"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Sparkles } from "lucide-react"

import { AddAppointmentHeaderButton } from "@/components/appointments/add-appointment-header-button"
import { DashboardDayStatsStrip } from "@/components/dashboard/dashboard-day-stats-strip"
import { DashboardMobileView } from "@/components/dashboard/dashboard-mobile-view"
import { DashboardNextAppointment } from "@/components/dashboard/dashboard-next-appointment"
import { DashboardRecentActivity } from "@/components/dashboard/dashboard-recent-activity"
import { DashboardSmsAlert } from "@/components/dashboard/dashboard-sms-alert"
import { DashboardTodayList } from "@/components/dashboard/dashboard-today-list"
import { OnboardingDashboardCard } from "@/components/onboarding/onboarding-dashboard-card"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  APPOINTMENTS_PANEL_DISMISSED_EVENT,
  filterDismissedAppointments,
} from "@/lib/appointments/appointments-panel-dismissed"
import {
  getAppointmentsForToday,
  updateAppointmentStatus,
  useAppointmentsStore,
} from "@/lib/appointments/appointments-store"
import { appointmentsManualCreateHref } from "@/lib/appointments/appointments-manual-create-path"
import { isPlannedVisitForDashboardStats } from "@/lib/appointments/stats-rules"
import { getTodayDashboardStats, type TodayDashboardStats } from "@/lib/dashboard/today-dashboard-stats"
import { formatTodayAppointmentsLabel } from "@/lib/dashboard/today-appointments-label"
import { getAppToday } from "@/lib/date/current-date"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { AppointmentStatus } from "@/types/domain"

const DASHBOARD_TIP_COUNT = 16
const TERMINAL_STATUSES = new Set<AppointmentStatus>(["cancelled", "completed", "no_show"])

function TipCard() {
  const { t } = useTranslations()
  const [tipIndex, setTipIndex] = React.useState(() => new Date().getDate() % DASHBOARD_TIP_COUNT)
  const tipKey = `dashboard.tipItems.${tipIndex}`

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="flex flex-row items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <CardTitle className="text-sm font-semibold">{t("dashboard.tip")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed text-muted-foreground">{t(tipKey)}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setTipIndex((i) => (i + 1) % DASHBOARD_TIP_COUNT)}
        >
          {t("dashboard.tipShowAnother")}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { t, language } = useTranslations()
  const { ready: accessReady, businessId } = useBusinessAccess()
  const {
    appointments: allAppointments,
    ready: appointmentsReady,
    loadError: appointmentsLoadError,
  } = useAppointmentsStore(accessReady ? businessId : undefined)
  const [dismissTick, setDismissTick] = React.useState(0)
  React.useEffect(() => {
    const onDismissed = () => setDismissTick((n) => n + 1)
    window.addEventListener(APPOINTMENTS_PANEL_DISMISSED_EVENT, onDismissed)
    return () => window.removeEventListener(APPOINTMENTS_PANEL_DISMISSED_EVENT, onDismissed)
  }, [])
  const appointments = React.useMemo(
    () => filterDismissedAppointments(allAppointments, businessId),
    [allAppointments, businessId, dismissTick],
  )
  const appToday = React.useMemo(() => getAppToday(), [])
  const [statusNotice, setStatusNotice] = React.useState("")
  const [statsLoading, setStatsLoading] = React.useState(true)
  const [statsError, setStatsError] = React.useState<string | null>(null)
  const [statsContextState, setStatsContextState] = React.useState<"login_required" | "no_data" | null>(null)
  const [currentTime, setCurrentTime] = React.useState(() => new Date())
  const [stats, setStats] = React.useState<TodayDashboardStats>({
    todayAppointmentsCount: 0,
    confirmedTodayCount: 0,
    cancelledTodayCount: 0,
    completedTodayCount: 0,
    pendingTodayCount: 0,
    requiresActionCount: 0,
    reminderErrorsCount: 0,
  })
  const isActiveSubscriptionStatus = React.useCallback((status: string | null | undefined): boolean => {
    const normalized = String(status ?? "").trim().toLowerCase()
    return normalized === "trialing" || normalized === "active"
  }, [])

  const statsReady = appointmentsReady && !appointmentsLoadError && !statsLoading && !statsError

  const isAuthOrContextError = (message: string): boolean => {
    const text = message.toLowerCase()
    return (
      text.includes("no_business_id") ||
      text.includes("jwt") ||
      text.includes("auth") ||
      text.includes("not authenticated") ||
      text.includes("unauthorized") ||
      text.includes("forbidden")
    )
  }

  const todaysList = React.useMemo(
    () => getAppointmentsForToday(appointments, appToday),
    [appointments, appToday],
  )
  const plannedToday = React.useMemo(
    () => todaysList.filter((a) => isPlannedVisitForDashboardStats(a, currentTime)),
    [currentTime, todaysList],
  )
  const todaysListSorted = React.useMemo(
    () => [...todaysList].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [todaysList],
  )
  const fallbackStats = React.useMemo<TodayDashboardStats>(() => {
    const confirmedTodayCount = plannedToday.length
    const cancelledTodayCount = todaysList.filter((a) => a.status === "cancelled").length
    const completedTodayCount = todaysList.filter((a) => a.status === "completed").length
    const pendingTodayCount = todaysList.filter(
      (a) => a.status === "pending" || a.status === "booked",
    ).length
    return {
      todayAppointmentsCount: confirmedTodayCount,
      confirmedTodayCount,
      cancelledTodayCount,
      completedTodayCount,
      pendingTodayCount,
      requiresActionCount: 0,
      reminderErrorsCount: 0,
    }
  }, [plannedToday.length, todaysList])

  const nextAppointment = React.useMemo(() => {
    const now = currentTime.getTime()
    const upcoming = todaysListSorted.find(
      (a) => !TERMINAL_STATUSES.has(a.status) && new Date(a.startsAt).getTime() >= now,
    )
    if (upcoming) return upcoming
    return todaysListSorted.find((a) => !TERMINAL_STATUSES.has(a.status)) ?? null
  }, [currentTime, todaysListSorted])

  const confirmedCount = statsReady ? stats.confirmedTodayCount : fallbackStats.confirmedTodayCount
  const pendingCount = statsReady ? stats.pendingTodayCount : fallbackStats.pendingTodayCount
  const todayVisitsCount = React.useMemo(
    () => todaysList.filter((a) => a.status !== "cancelled").length,
    [todaysList],
  )
  const upcomingTodaySorted = React.useMemo(
    () => todaysListSorted.filter((a) => !TERMINAL_STATUSES.has(a.status)),
    [todaysListSorted],
  )
  const problemsCount = statsReady ? stats.requiresActionCount : 0

  const timeFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [language],
  )

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isSupabaseConfigured()) return
      if (typeof window === "undefined") return
      const hash = window.location.hash || ""
      if (!hash.includes("error_code=otp_expired")) return
      const trialIntentCookie = document.cookie.includes("wizytaok_trial_intent=1")
      const client = getBrowserClient()
      if (!client) return
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user) return
      const rawTrialIntent = user.user_metadata?.trial_intent
      const wantsTrialFromMetadata =
        rawTrialIntent === true ||
        rawTrialIntent === "true" ||
        rawTrialIntent === 1 ||
        rawTrialIntent === "1"
      if (!trialIntentCookie && !wantsTrialFromMetadata) return
      const { data: profile } = await client
        .from("business_profiles")
        .select("id, subscription_status")
        .eq("owner_id", user.id)
        .maybeSingle()
      if (!profile?.id) return
      if (isActiveSubscriptionStatus(profile.subscription_status)) return
      if (!cancelled) {
        router.replace("/start-trial?source=landing_trial_signup")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isActiveSubscriptionStatus, router])

  const statsLoadedRef = React.useRef(false)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!accessReady || !appointmentsReady || appointmentsLoadError) return
      const showBlocking = !statsLoadedRef.current
      if (showBlocking) setStatsLoading(true)
      setStatsError(null)
      setStatsContextState(null)
      try {
        if (!isSupabaseConfigured()) {
          if (!cancelled) {
            setStats(fallbackStats)
            setStatsContextState("no_data")
          }
          return
        }
        if (!businessId) {
          if (!cancelled) {
            setStats(fallbackStats)
            setStatsContextState("no_data")
          }
          return
        }
        const nextStats = await getTodayDashboardStats(businessId)
        if (!cancelled) {
          setStats(nextStats)
          setStatsContextState(null)
          if (process.env.NODE_ENV === "development") {
            console.info("[dashboard.stats]", nextStats)
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error"
        if (!cancelled) {
          if (isAuthOrContextError(message)) {
            setStats(fallbackStats)
            setStatsContextState("login_required")
            setStatsError(null)
          } else {
            setStatsError(message)
          }
        }
        if (process.env.NODE_ENV === "development") {
          console.info("[dashboard.stats.error]", message)
        }
      } finally {
        if (!cancelled) {
          statsLoadedRef.current = true
          if (showBlocking) setStatsLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accessReady, appointmentsReady, appointmentsLoadError, businessId, fallbackStats])

  React.useEffect(() => {
    if (!statusNotice) return
    const tid = window.setTimeout(() => setStatusNotice(""), 2500)
    return () => window.clearTimeout(tid)
  }, [statusNotice])

  const changeStatusFromDashboard = (
    appointmentId: string,
    currentStatus: AppointmentStatus,
    nextStatus: AppointmentStatus,
  ) => {
    void (async () => {
      const ok = await updateAppointmentStatus(appointmentId, nextStatus, {
        lastUpdatedBy: "business",
        lastStatusChangeSource: "manual",
      })
      if (!ok) return
      setStatusNotice(t("appointments.statusUpdated"))
    })()
  }

  const daySummary = (() => {
    if (statsContextState === "login_required") return t("dashboard.signInToSeePlan")
    if (statsContextState === "no_data") return t("dashboard.noDataInBrowser")
    if (!statsReady) {
      return statsError ? t("dashboard.summaryLoadFailed") : t("dashboard.statsLoading")
    }
    if (plannedToday.length === 0) return t("dashboard.noAppointmentsTodayLong")
    return formatTodayAppointmentsLabel(plannedToday.length, language)
  })()

  return (
    <AppShell
      title={t("dashboard.title")}
      pageDescription={t("dashboard.pageDescription")}
      primaryAction={<AddAppointmentHeaderButton href={appointmentsManualCreateHref()} />}
    >
      <PageShell>
        {statusNotice ? (
          <div className="mb-4 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
            {statusNotice}
          </div>
        ) : null}

        <div className="lg:hidden">
          <DashboardMobileView
            businessId={businessId}
            daySummary={daySummary}
            problemsCount={problemsCount}
            statsReady={statsReady}
            todayCount={todayVisitsCount}
            pendingCount={pendingCount}
            nextAppointment={nextAppointment}
            todaysListSorted={upcomingTodaySorted}
            currentTime={currentTime}
            timeFmt={timeFmt}
          />
        </div>

        <div className="hidden lg:block">
        <p className="text-sm text-muted-foreground">{daySummary}</p>

        {statsReady && problemsCount > 0 ? (
          <Link
            href="/appointments?filter=needs_action"
            className="mt-3 flex min-h-11 touch-manipulation items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            <span>{t("dashboard.daySummaryProblems").replace("{count}", String(problemsCount))}</span>
          </Link>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:mt-6 lg:grid-cols-[2fr_1fr] lg:items-start lg:gap-6">
          <div className="min-w-0 space-y-4 lg:space-y-5">
            <DashboardNextAppointment
              appointment={nextAppointment}
              currentTime={currentTime}
              loading={!statsReady}
              timeFmt={timeFmt}
            />

            <DashboardTodayList
              rows={todaysListSorted}
              loading={!statsReady}
              loadError={Boolean(appointmentsLoadError)}
              currentTime={currentTime}
              timeFmt={timeFmt}
              onChangeStatus={changeStatusFromDashboard}
            />

            <DashboardDayStatsStrip
              confirmed={confirmedCount}
              pending={pendingCount}
              loading={!statsReady}
            />

            <DashboardSmsAlert />

            <DashboardRecentActivity businessId={businessId} appointments={appointments} />
          </div>

          <aside className="hidden min-w-0 space-y-6 lg:sticky lg:top-6 lg:block">
            <OnboardingDashboardCard />
            <TipCard />
          </aside>
        </div>
        </div>
      </PageShell>
    </AppShell>
  )
}
