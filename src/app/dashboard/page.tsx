"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
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
  bookingNeedsAction,
  countBookingsNeedingAction,
  getBookingActionReason,
} from "@/lib/bookings/booking-needs-action"
import { isPlannedVisitForDashboardStats } from "@/lib/appointments/stats-rules"
import {
  countAppointmentReminderIssues,
  countPendingConfirmationAppointments,
} from "@/lib/dashboard/todo-metrics"
import { getAppToday } from "@/lib/date/current-date"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { Appointment, AppointmentStatus } from "@/types/domain"

const DASHBOARD_TIP_COUNT = 10

const DASHBOARD_STATUS_OPTIONS: AppointmentStatus[] = [
  "booked",
  "pending",
  "confirmed",
  "cancelled",
  "no_show",
]

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

function TodoPanel({
  appointmentsReady,
  appointmentsError,
  needsActionCount,
  pendingConfirmationCount,
  reminderIssuesCount,
}: {
  appointmentsReady: boolean
  appointmentsError: boolean
  needsActionCount: number
  pendingConfirmationCount: number
  reminderIssuesCount: number
}) {
  const { t } = useTranslations()

  if (appointmentsError) {
    return (
      <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold">{t("dashboard.todo")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-sm text-destructive">{t("dashboard.todoLoadError")}</p>
        </CardContent>
      </Card>
    )
  }

  if (!appointmentsReady) {
    return (
      <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold">{t("dashboard.todo")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-sm text-muted-foreground">{t("dashboard.todoLoadingTasks")}</p>
        </CardContent>
      </Card>
    )
  }

  const total = needsActionCount + pendingConfirmationCount + reminderIssuesCount
  const rowClass =
    "group flex min-h-[2.75rem] items-center justify-between gap-3 rounded-xl border border-transparent px-2 py-2 text-sm outline-none transition-colors hover:border-border/80 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-semibold">{t("dashboard.todo")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-2">
        <ul className="space-y-0.5">
          <li>
            <Link href="/appointments?filter=needs_action" className={rowClass}>
              <span className="min-w-0 text-muted-foreground group-hover:text-foreground">
                {t("dashboard.todoNeedsActionLabel")}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                <span className="font-semibold text-foreground">{needsActionCount}</span>
                <ChevronRight className="size-4 text-muted-foreground opacity-60 group-hover:opacity-100" aria-hidden />
              </span>
            </Link>
          </li>
          <li>
            <Link href="/appointments?status=pending" className={rowClass}>
              <span className="min-w-0 text-muted-foreground group-hover:text-foreground">
                {t("dashboard.todoNotConfirmedLabel")}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                <span className="font-semibold text-foreground">{pendingConfirmationCount}</span>
                <ChevronRight className="size-4 text-muted-foreground opacity-60 group-hover:opacity-100" aria-hidden />
              </span>
            </Link>
          </li>
          <li>
            <Link href="/messages" className={rowClass}>
              <span className="min-w-0 text-muted-foreground group-hover:text-foreground">
                {t("dashboard.todoReminderIssuesLabel")}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                <span className="font-semibold text-foreground">{reminderIssuesCount}</span>
                <ChevronRight className="size-4 text-muted-foreground opacity-60 group-hover:opacity-100" aria-hidden />
              </span>
            </Link>
          </li>
        </ul>
        {total === 0 ? (
          <p className="border-t border-border/60 px-2 pt-3 text-xs text-muted-foreground">
            {t("dashboard.todoAllClear")}
          </p>
        ) : null}
      </CardContent>
    </Card>
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

function FirstStepsCard() {
  const { t } = useTranslations()
  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-semibold">
          {t("dashboard.firstSteps")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>- {t("dashboard.stepBusiness")}</li>
          <li>- {t("dashboard.stepAppointment")}</li>
          <li>- {t("dashboard.stepMessages")}</li>
          <li>- {t("dashboard.stepGuide")}</li>
        </ul>
        <Button size="sm" className="mt-3 h-9 w-full" asChild>
          <Link href="/guide">{t("dashboard.openGuide")}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { t, language } = useTranslations()
  const {
    appointments: allAppointments,
    ready: appointmentsReady,
    loadError: appointmentsLoadError,
  } = useAppointmentsStore()
  const appToday = React.useMemo(() => getAppToday(), [])
  const [statusNotice, setStatusNotice] = React.useState("")

  const statsReady = appointmentsReady && !appointmentsLoadError

  const todaysList = React.useMemo(
    () => getAppointmentsForToday(allAppointments, appToday),
    [allAppointments, appToday]
  )
  const plannedToday = React.useMemo(
    () => todaysList.filter((a) => isPlannedVisitForDashboardStats(a)),
    [todaysList]
  )
  const visitsTodayComputed = plannedToday.length
  const confirmedToday = todaysList.filter((a) => a.status === "confirmed").length
  const toConfirm = todaysList.filter((a) => a.status === "pending").length
  const needsActionAll = React.useMemo(() => {
    const rows = allAppointments.filter((a) => bookingNeedsAction(a))
    rows.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    return rows
  }, [allAppointments])
  const needsAttention = React.useMemo(() => needsActionAll.slice(0, 12), [needsActionAll])
  const needsActionCount = React.useMemo(
    () => countBookingsNeedingAction(allAppointments),
    [allAppointments]
  )
  const pendingConfirmationAll = countPendingConfirmationAppointments(allAppointments)
  const reminderIssuesAll = countAppointmentReminderIssues(allAppointments)

  const timeFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [language]
  )

  const supabaseReminderStatusLine = (a: Appointment): string | null => {
    if (!a.id.startsWith("sb-")) return null
    const rs = a.reminderStatus
    if (rs === "sent") return t("appointments.reminderStatusSent")
    if (rs === "failed") return t("appointments.reminderStatusFailed")
    if (rs === "skipped") return t("appointments.reminderStatusSkipped")
    if (rs === "not_configured" || rs === "simulated_dev") return t("appointments.reminderStatusNotConfigured")
    return t("appointments.reminderStatusScheduled")
  }

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
                {!statsReady ? (
                  appointmentsLoadError ? (
                    <span className="text-destructive">{t("dashboard.statsLoadError")}</span>
                  ) : (
                    <span className="text-muted-foreground">{t("dashboard.statsLoading")}</span>
                  )
                ) : visitsTodayComputed === 0 ? (
                  t("dashboard.noAppointmentsTodayLong")
                ) : (
                  t("dashboard.youHaveToday").replace("{count}", String(visitsTodayComputed))
                )}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {statsReady ? (
                  t("dashboard.needsActionSummary").replace("{count}", String(needsActionCount))
                ) : appointmentsLoadError ? null : (
                  t("dashboard.statsLoading")
                )}
              </p>
            </div>
            <div className="grid min-h-[5.25rem] grid-cols-3 gap-2 sm:gap-3">
              {!statsReady ? (
                <div className="col-span-3 flex items-center rounded-2xl border border-border bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
                  {appointmentsLoadError ? t("dashboard.statsLoadError") : t("dashboard.statsLoading")}
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
                    label={t("dashboard.toConfirm")}
                    value={toConfirm}
                    icon={Clock}
                    href="/appointments?status=pending&date=today"
                  />
                  <MiniStat
                    label={t("dashboard.requiresContact")}
                    value={needsActionCount}
                    icon={AlertCircle}
                    href="/appointments?filter=needs_action"
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
          <div className="min-w-0 space-y-6">
            <Card
              data-tour="dashboard-attention"
              className="rounded-2xl border border-border bg-[color:var(--accent-soft)] shadow-sm shadow-slate-900/5"
            >
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold">
                  {t("dashboard.needsAttention")}
                </CardTitle>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t("dashboard.needsActionSectionLead")}
                </p>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-2.5">
                  {!statsReady ? (
                    <p className="text-sm text-muted-foreground">
                      {appointmentsLoadError ? t("dashboard.statsLoadError") : t("dashboard.statsLoading")}
                    </p>
                  ) : needsAttention.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("dashboard.attentionCalm")}
                    </p>
                  ) : (
                    needsAttention.map((row) => {
                      const when = new Date(row.startsAt)
                      const reminderLine = supabaseReminderStatusLine(row)
                      return (
                        <div
                          key={row.id}
                          className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
                              <span>
                                {row.clientName}{" "}
                                <span className="font-normal tabular-nums text-muted-foreground">
                                  {timeFmt.format(when)}
                                </span>
                              </span>
                              <BookingSourceBadge source={row.source} variant="short" />
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{row.serviceLabel}</p>
                            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200/95">
                              {getBookingActionReason(row, language)}
                            </p>
                            {reminderLine ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t("appointments.reminderAutoCaption")}: {reminderLine}
                              </p>
                            ) : null}
                            <AppointmentStaffCaption
                              appointment={row}
                              variant="compact"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                  {needsActionAll.length > needsAttention.length ? (
                    <div className="pt-1">
                      <Button variant="link" asChild className="h-auto px-0 py-1 text-sm font-medium">
                        <Link href="/appointments?filter=needs_action">
                          {t("dashboard.needsActionViewAll")}
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

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
            <FirstStepsCard />
            <TodoPanel
              appointmentsReady={appointmentsReady}
              appointmentsError={appointmentsLoadError}
              needsActionCount={needsActionCount}
              pendingConfirmationCount={pendingConfirmationAll}
              reminderIssuesCount={reminderIssuesAll}
            />
            <TipCard />
          </aside>
        </div>
      </PageShell>
    </AppShell>
  )
}
