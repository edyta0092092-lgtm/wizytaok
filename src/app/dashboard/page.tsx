"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Ban,
  CheckCircle2,
  CalendarDays,
  ListTodo,
  Sparkles,
} from "lucide-react"

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
import {
  getAppointmentsForToday,
  updateAppointmentStatus,
  useAppointmentsStore,
} from "@/lib/appointments/appointments-store"
import {
  isConfirmedVisitStatus,
  isPlannedVisitForDashboardStats,
} from "@/lib/appointments/stats-rules"
import { getTodayDashboardStats, type TodayDashboardStats } from "@/lib/dashboard/today-dashboard-stats"
import { getAppToday } from "@/lib/date/current-date"
import { useTranslations } from "@/lib/i18n/use-translations"
import { normalizeBusinessMemberPanelRole } from "@/lib/auth/permissions"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Appointment, AppointmentStatus } from "@/types/domain"

const DASHBOARD_TIP_COUNT = 16

const DASHBOARD_STATUS_OPTIONS: AppointmentStatus[] = ["confirmed", "cancelled"]

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
        <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground sm:line-clamp-2">
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

type OnboardingChecklistState = {
  visible: boolean
  loading: boolean
  completed: boolean
  hasServices: boolean
  hasTeam: boolean
  hasAvailability: boolean
  bookingUrl: string | null
}

const EMPTY_ONBOARDING: OnboardingChecklistState = {
  visible: false,
  loading: true,
  completed: false,
  hasServices: false,
  hasTeam: false,
  hasAvailability: false,
  bookingUrl: null,
}

function OnboardingChecklistCard({
  state,
}: {
  state: OnboardingChecklistState
}) {
  if (!state.visible) return null

  const openBookingHref = state.bookingUrl ?? "/settings"

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Witaj w WizytaOK</CardTitle>
        <p className="text-sm text-muted-foreground">
          Skonfiguruj system w kilku krokach i zacznij przyjmowac rezerwacje online.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {state.loading ? (
          <p className="text-sm text-muted-foreground">Sprawdzamy konfiguracje Twojej firmy...</p>
        ) : state.completed ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
            Konfiguracja podstawowa gotowa.
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
            <p className="text-sm text-foreground">Dodaj pierwsza usluge</p>
            <Button size="sm" variant={state.hasServices ? "outline" : "default"} asChild>
              <Link href="/services">{state.hasServices ? "Edytuj uslugi" : "Dodaj usluge"}</Link>
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
            <p className="text-sm text-foreground">Dodaj czlonka zespolu</p>
            <Button size="sm" variant={state.hasTeam ? "outline" : "default"} asChild>
              <Link href="/team">{state.hasTeam ? "Edytuj zespol" : "Dodaj osobe"}</Link>
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
            <p className="text-sm text-foreground">Ustaw dostepnosc</p>
            <Button size="sm" variant={state.hasAvailability ? "outline" : "default"} asChild>
              <Link href="/availability">{state.hasAvailability ? "Edytuj dostepnosc" : "Ustaw dostepnosc"}</Link>
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
            <p className="text-sm text-foreground">Otworz strone rezerwacji</p>
            <Button size="sm" variant="outline" asChild>
              <Link href={openBookingHref} target="_blank" rel="noreferrer">
                Otworz link
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { t, language } = useTranslations()
  const {
    appointments: allAppointments,
    ready: appointmentsReady,
    loadError: appointmentsLoadError,
  } = useAppointmentsStore()
  const appToday = React.useMemo(() => getAppToday(), [])
  const [statusNotice, setStatusNotice] = React.useState("")
  const [statsLoading, setStatsLoading] = React.useState(true)
  const [statsError, setStatsError] = React.useState<string | null>(null)
  const [statsContextState, setStatsContextState] = React.useState<"login_required" | "no_data" | null>(null)
  const [stats, setStats] = React.useState<TodayDashboardStats>({
    todayAppointmentsCount: 0,
    confirmedTodayCount: 0,
    cancelledTodayCount: 0,
    pendingTodayCount: 0,
    requiresActionCount: 0,
    reminderErrorsCount: 0,
  })
  const [onboarding, setOnboarding] = React.useState<OnboardingChecklistState>(EMPTY_ONBOARDING)

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
    () => getAppointmentsForToday(allAppointments, appToday),
    [allAppointments, appToday]
  )
  const plannedToday = React.useMemo(
    () => todaysList.filter((a) => isPlannedVisitForDashboardStats(a)),
    [todaysList]
  )
  const fallbackStats = React.useMemo<TodayDashboardStats>(() => {
    const confirmedTodayCount = todaysList.filter((a) => isConfirmedVisitStatus(a.status)).length
    const cancelledTodayCount = todaysList.filter((a) => a.status === "cancelled").length
    return {
      todayAppointmentsCount: confirmedTodayCount + cancelledTodayCount,
      confirmedTodayCount,
      cancelledTodayCount,
      pendingTodayCount: 0,
      requiresActionCount: 0,
      reminderErrorsCount: 0,
    }
  }, [todaysList])
  const visitsTodayComputed = stats.todayAppointmentsCount
  const confirmedToday = stats.confirmedTodayCount
  const cancelledToday = stats.cancelledTodayCount

  const timeFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [language]
  )

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

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setOnboarding({ ...EMPTY_ONBOARDING, loading: false })
        return
      }
      const client = getBrowserClient()
      if (!client) {
        if (!cancelled) setOnboarding({ ...EMPTY_ONBOARDING, loading: false })
        return
      }
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user?.id) {
        if (!cancelled) setOnboarding({ ...EMPTY_ONBOARDING, loading: false })
        return
      }

      let businessId: string | null = null
      let isAdmin = false

      const { data: owned } = await client
        .from("business_profiles")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle()
      if (owned?.id) {
        businessId = owned.id
        isAdmin = true
      } else {
        const { data: member } = await client
          .from("business_members")
          .select("business_id, role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle()
        const panelRole = normalizeBusinessMemberPanelRole(member?.role)
        if (member?.business_id && panelRole === "admin") {
          businessId = member.business_id
          isAdmin = true
        }
      }

      if (!isAdmin || !businessId) {
        if (!cancelled) {
          setOnboarding({
            visible: false,
            loading: false,
            completed: false,
            hasServices: false,
            hasTeam: false,
            hasAvailability: false,
            bookingUrl: null,
          })
        }
        return
      }

      const [{ count: servicesCount }, { count: teamCount }, { data: availabilityRow }, { data: bp }] =
        await Promise.all([
          client
            .from("services")
            .select("id", { count: "exact", head: true })
            .eq("business_id", businessId)
            .eq("is_active", true),
          client
            .from("staff_members")
            .select("id", { count: "exact", head: true })
            .eq("business_id", businessId)
            .eq("is_active", true),
          client
            .from("availability_rules")
            .select("id")
            .eq("business_id", businessId)
            .eq("is_open", true)
            .limit(1)
            .maybeSingle(),
          client.from("business_profiles").select("slug").eq("id", businessId).maybeSingle(),
        ])

      const hasServices = (servicesCount ?? 0) > 0
      const hasTeam = (teamCount ?? 0) > 0
      const hasAvailability = Boolean(availabilityRow?.id)
      const slug = typeof bp?.slug === "string" ? bp.slug.trim() : ""
      const siteBase =
        (process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
          (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "")
      const bookingUrl = slug && siteBase ? `${siteBase}/rezerwacje/${encodeURIComponent(slug)}` : null

      if (!cancelled) {
        setOnboarding({
          visible: true,
          loading: false,
          hasServices,
          hasTeam,
          hasAvailability,
          completed: hasServices && hasTeam && hasAvailability,
          bookingUrl,
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!appointmentsReady || appointmentsLoadError) return
      setStatsLoading(true)
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
        const client = getBrowserClient()
        if (!client) {
          if (!cancelled) {
            setStats(fallbackStats)
            setStatsContextState("login_required")
          }
          return
        }
        const {
          data: { user },
        } = await client.auth.getUser()
        if (!user?.id) {
          if (!cancelled) {
            setStats(fallbackStats)
            setStatsContextState("login_required")
          }
          return
        }
        const businessId = await getCurrentBusinessProfileIdForClient(client)
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
          setStatsLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [appointmentsReady, appointmentsLoadError, fallbackStats])

  React.useEffect(() => {
    if (!statusNotice) return
    const tid = window.setTimeout(() => setStatusNotice(""), 2500)
    return () => window.clearTimeout(tid)
  }, [statusNotice])

  const changeStatusFromDashboard = (appointmentId: string, status: AppointmentStatus) => {
    void (async () => {
      const ok = await updateAppointmentStatus(appointmentId, status, {
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
        <Button size="lg" className="h-10 px-4 text-sm" asChild>
          <Link href="/appointments">{t("common.addAppointment")}</Link>
        </Button>
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
                  t("dashboard.youHaveToday").replace("{count}", String(visitsTodayComputed))
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
            <div className="grid min-h-[5.25rem] grid-cols-2 gap-2 sm:gap-3">
              {statsContextState ? (
                <div className="col-span-2 flex items-center rounded-2xl border border-border bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
                  {statsContextState === "login_required"
                    ? t("dashboard.signInToSeePlan")
                    : t("dashboard.noDataInBrowser")}
                </div>
              ) : !statsReady ? (
                <div className="col-span-2 flex items-center rounded-2xl border border-border bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
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
                  ) : plannedToday.length === 0 ? (
                    <li className="px-4 py-5 text-sm text-muted-foreground">
                      {t("dashboard.noAppointmentsTodayShort")}
                    </li>
                  ) : (
                    plannedToday.map((row) => {
                    const when = new Date(row.startsAt)
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
                          <StatusBadge status={row.status} />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" size="sm" className="h-8">
                                {t("appointments.changeStatusAction")}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <div className="px-2 pt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                                {t("appointments.manualStatusChange")}
                              </div>
                              <div className="px-2 py-1 text-xs text-muted-foreground">
                                {t("appointments.chooseStatus")}
                              </div>
                              {DASHBOARD_STATUS_OPTIONS.map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  onClick={() => changeStatusFromDashboard(row.id, status)}
                                >
                                  {t(
                                    `labels.appointmentStatus.${status}` as "labels.appointmentStatus.booked"
                                  )}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
            <OnboardingChecklistCard state={onboarding} />
            <TipCard />
          </aside>
        </div>
      </PageShell>
    </AppShell>
  )
}
