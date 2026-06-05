"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  CalendarDays,
  ListTodo,
  Sparkles,
} from "lucide-react"

import { AddAppointmentHeaderButton } from "@/components/appointments/add-appointment-header-button"
import { OnboardingDashboardCard } from "@/components/onboarding/onboarding-dashboard-card"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { AppointmentStaffCaption } from "@/components/shared/appointment-staff-caption"
import { BookingSourceBadge } from "@/components/shared/booking-source-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { APPOINTMENT_ROW_STATUS_ORDER } from "@/lib/appointments/appointment-status-order"
import { isAppointmentVisitLocked } from "@/lib/appointments/appointment-visit-lock"
import {
  getAppointmentsForToday,
  updateAppointmentStatus,
  useAppointmentsStore,
} from "@/lib/appointments/appointments-store"
import { useBusinessBookingPagePath } from "@/lib/business/use-business-booking-page-path"
import {
  appointmentShowsNeedsActionStatus,
  isPlannedVisitForDashboardStats,
} from "@/lib/appointments/stats-rules"
import { getTodayDashboardStats, type TodayDashboardStats } from "@/lib/dashboard/today-dashboard-stats"
import { formatTodayAppointmentsLabel } from "@/lib/dashboard/today-appointments-label"
import { getAppToday } from "@/lib/date/current-date"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { AppointmentStatus } from "@/types/domain"

const DASHBOARD_TIP_COUNT = 16

function MiniStat({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex h-full min-h-[5.25rem] flex-col rounded-2xl border border-border bg-card px-3.5 py-3 shadow-sm shadow-slate-900/5 outline-none transition-colors hover:border-primary/40 hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-muted text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </Link>
  )
}

function TipCard() {
  const { t } = useTranslations()
  const [tipIndex, setTipIndex] = React.useState(
    () => new Date().getDate() % DASHBOARD_TIP_COUNT
  )

  const tipKey = `dashboard.tipItems.${tipIndex}`

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="flex flex-row items-start gap-2 pb-1">
        <Sparkles
          className="mt-0.5 size-4 shrink-0 text-primary"
          aria-hidden
        />
        <CardTitle className="text-sm font-semibold">{t("dashboard.tip")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t(tipKey)}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
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

  const bookingPagePath = useBusinessBookingPagePath()

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
    () => getAppointmentsForToday(allAppointments, appToday),
    [allAppointments, appToday]
  )
  const plannedToday = React.useMemo(
    () => todaysList.filter((a) => isPlannedVisitForDashboardStats(a, currentTime)),
    [currentTime, todaysList]
  )
  const todaysListSorted = React.useMemo(
    () =>
      [...todaysList].sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ),
    [todaysList],
  )
  const fallbackStats = React.useMemo<TodayDashboardStats>(() => {
    const confirmedTodayCount = plannedToday.length
    const cancelledTodayCount = todaysList.filter((a) => a.status === "cancelled").length
    const completedTodayCount = todaysList.filter((a) => a.status === "completed").length
    return {
      todayAppointmentsCount: confirmedTodayCount,
      confirmedTodayCount,
      cancelledTodayCount,
      completedTodayCount,
      pendingTodayCount: 0,
      requiresActionCount: 0,
      reminderErrorsCount: 0,
    }
  }, [plannedToday.length, todaysList])
  const visitsTodayComputed = plannedToday.length
  const confirmedToday = plannedToday.length
  const cancelledToday = stats.cancelledTodayCount
  const completedToday = todaysList.filter((a) => a.status === "completed").length

  const timeFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [language]
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
    if (isAppointmentVisitLocked(currentStatus) || currentStatus === nextStatus) return
    void (async () => {
      const ok = await updateAppointmentStatus(appointmentId, nextStatus, {
        lastUpdatedBy: "business",
        lastStatusChangeSource: "manual",
      })
      if (!ok) return
      setStatusNotice(t("appointments.statusUpdated"))
    })()
  }

  return (
    <AppShell
      title={t("dashboard.title")}
      pageDescription={t("dashboard.pageDescription")}
      primaryAction={
        <AddAppointmentHeaderButton href={bookingPagePath} />
      }
    >
      <PageShell>
        {statusNotice ? (
          <div className="mb-4 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
            {statusNotice}
          </div>
        ) : null}
        <Card className="rounded-2xl border border-border bg-[color:var(--nav-active-bg)] shadow-sm shadow-slate-900/5">
          <CardContent className="grid gap-4 px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full bg-card/70 px-3 py-1 text-xs font-semibold text-primary">
                <CalendarDays className="size-4" aria-hidden />
                {t("dashboard.heroTitle")}
              </p>
              <h2 className="mt-3 text-xl font-semibold leading-tight text-foreground sm:text-2xl">
                {statsContextState === "login_required" ? (
                  <span className="text-muted-foreground">{t("dashboard.signInToSeePlan")}</span>
                ) : statsContextState === "no_data" ? (
                  <span className="text-muted-foreground">{t("dashboard.noDataInBrowser")}</span>
                ) : !statsReady ? (
                  statsError ? (
                    <span className="text-destructive">{t("dashboard.summaryLoadFailed")}</span>
                  ) : (
                    <span className="text-muted-foreground">{t("dashboard.statsLoading")}</span>
                  )
                ) : visitsTodayComputed === 0 ? (
                  t("dashboard.noAppointmentsTodayLong")
                ) : (
                  formatTodayAppointmentsLabel(visitsTodayComputed, language)
                )}
              </h2>
              {statsContextState || !statsReady || statsError ? (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {statsContextState
                    ? null
                    : statsError
                      ? t("dashboard.summaryLoadFailed")
                      : t("dashboard.statsLoading")}
                </p>
              ) : null}
            </div>
            <div className="grid min-h-[5.25rem] grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              {statsContextState ? (
                <div className="sm:col-span-3 flex items-center rounded-2xl border border-border bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
                  {statsContextState === "login_required"
                    ? t("dashboard.signInToSeePlan")
                    : t("dashboard.noDataInBrowser")}
                </div>
              ) : !statsReady ? (
                <div className="sm:col-span-3 flex items-center rounded-2xl border border-border bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
                  {statsError ? t("dashboard.summaryLoadFailed") : t("dashboard.statsLoading")}
                </div>
              ) : (
                <>
                  <MiniStat
                    label={t("dashboard.confirmed")}
                    value={confirmedToday}
                    icon={CheckCircle2}
                    href="/appointments?status=confirmed&date=today"
                  />
                  <MiniStat
                    label={t("dashboard.cancelled")}
                    value={cancelledToday}
                    icon={Ban}
                    href="/appointments?status=cancelled&date=today"
                  />
                  <MiniStat
                    label={t("dashboard.completed")}
                    value={completedToday}
                    icon={BadgeCheck}
                    href="/appointments?status=completed&date=today"
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
          <div className="min-w-0 space-y-6">

            <Card
              data-tour="dashboard-today"
              className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5"
            >
              <CardHeader className="pb-0">
                <div className="flex items-center gap-2">
                  <ListTodo className="size-4 text-primary" aria-hidden />
                  <CardTitle className="text-sm font-semibold">
                    {t("dashboard.todaysAppointments")}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                  {!statsReady ? (
                    <li className="px-4 py-5 text-sm text-muted-foreground">
                      {appointmentsLoadError ? t("dashboard.statsLoadError") : t("dashboard.statsLoading")}
                    </li>
                  ) : todaysListSorted.length === 0 ? (
                    <li className="px-4 py-5 text-sm text-muted-foreground">
                      {t("dashboard.noAppointmentsTodayShort")}
                    </li>
                  ) : (
                    todaysListSorted.map((row) => {
                    const when = new Date(row.startsAt)
                    const visitLocked = isAppointmentVisitLocked(row.status)
                    const statusOptions = APPOINTMENT_ROW_STATUS_ORDER.filter((s) => s !== row.status)
                    return (
                      <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="flex min-w-0 gap-3">
                          <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-muted px-3 text-xs font-semibold tabular-nums text-primary">
                            {timeFmt.format(when)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="font-semibold text-foreground">
                                {row.clientName}
                              </p>
                              <BookingSourceBadge source={row.source} variant="short" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {row.serviceLabel}
                            </p>
                            <AppointmentStaffCaption
                              appointment={row}
                              variant="compact"
                              className="mt-0.5"
                            />
                          </div>
                        </div>
                        <div className="flex shrink-0 items-start gap-2 pt-0.5">
                          <StatusBadge
                            status={row.status}
                            needsAction={appointmentShowsNeedsActionStatus(row, currentTime)}
                          />
                          {!visitLocked && statusOptions.length > 0 ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="sm" className="h-8">
                                  {t("appointments.changeStatusAction")}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                {statusOptions.map((status) => (
                                  <DropdownMenuItem
                                    key={status}
                                    onClick={() =>
                                      changeStatusFromDashboard(row.id, row.status, status)
                                    }
                                  >
                                    {t(`labels.appointmentStatus.${status}` as "labels.appointmentStatus.booked")}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      </li>
                    )
                    })
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>

          <aside className="min-w-0 space-y-6 lg:sticky lg:top-6">
            <OnboardingDashboardCard />
            <TipCard />
          </aside>
        </div>
      </PageShell>
    </AppShell>
  )
}
