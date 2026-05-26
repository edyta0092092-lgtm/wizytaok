"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { getAppNavForRole } from "@/config/navigation"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { getAppointmentsForToday, useAppointmentsStore } from "@/lib/appointments/appointments-store"
import { isPlannedVisitForDashboardStats } from "@/lib/appointments/stats-rules"
import { getAppToday } from "@/lib/date/current-date"
import { formatTodayAppointmentsLabel } from "@/lib/dashboard/today-appointments-label"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

type AppSidebarProps = {
  className?: string
  onNavigate?: () => void
}

export function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { t, language, setLanguage, theme, setTheme } = useTranslations()
  const { ready, effectiveRole, businessId } = useBusinessAccess()
  const [showLogout, setShowLogout] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(() => new Date())
  const {
    appointments: allAppointments,
    ready: appointmentsReady,
    loadError: appointmentsLoadError,
  } = useAppointmentsStore(ready ? businessId : undefined)
  const appToday = React.useMemo(() => getAppToday(), [])

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  React.useEffect(() => {
    if (!isSupabaseConfigured()) {
      queueMicrotask(() => setShowLogout(false))
      return
    }
    const client = getBrowserClient()
    if (!client) {
      queueMicrotask(() => setShowLogout(false))
      return
    }
    void client.auth.getSession().then(({ data: { session } }) => {
      setShowLogout(Boolean(session))
    })
    const { data } = client.auth.onAuthStateChange((_e, session) => {
      setShowLogout(Boolean(session))
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    const client = getBrowserClient()
    if (client) await client.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [language]
  )

  const todayLabel = React.useMemo(() => dateFmt.format(appToday), [appToday, dateFmt])
  const todayAppointments = React.useMemo(
    () => getAppointmentsForToday(allAppointments, appToday),
    [allAppointments, appToday]
  )
  const totalToday = todayAppointments.filter((a) =>
    isPlannedVisitForDashboardStats(a, currentTime)
  ).length

  const statsReady = appointmentsReady && !appointmentsLoadError

  const navItems = React.useMemo(() => {
    if (!ready) return getAppNavForRole("admin")
    return getAppNavForRole(effectiveRole === "staff" ? "staff" : "admin")
  }, [ready, effectiveRole])

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-5 px-3.5 pb-7 pt-5 lg:px-4",
        className
      )}
    >
      <div className="shrink-0 space-y-1">
        <Logo href="/dashboard" className="px-0" />
        {ready && effectiveRole ? (
          <p className="px-1 text-[0.65rem] font-medium text-muted-foreground">
            {effectiveRole === "admin" ? t("roles.administrator") : t("roles.staff")}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 rounded-2xl border border-border bg-card/80 px-3 py-3 text-xs shadow-sm shadow-slate-900/5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("dashboard.trialToday")}
        </p>
        <p className="mt-0.5 min-h-[1.2rem] capitalize text-sm font-semibold text-foreground">
          {todayLabel || "\u00a0"}
        </p>
        <p className="mt-1 text-[0.75rem] leading-relaxed text-muted-foreground">
          {!statsReady ? (
            appointmentsLoadError ? t("dashboard.statsLoadError") : t("dashboard.statsLoading")
          ) : totalToday === 0
            ? t("dashboard.noAppointmentsTodayLong")
            : formatTodayAppointmentsLabel(totalToday, language)}
        </p>
      </div>

      <nav
        className="premium-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5 pt-0.5"
        aria-label={t("sidebar.menuAria")}
      >
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2 text-[0.8125rem] font-medium leading-tight transition-colors",
                active
                  ? "border border-primary/15 bg-[color:var(--nav-active-bg)] text-primary shadow-sm shadow-primary/10"
                  : "text-muted-foreground hover:bg-card/50 hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-2xl border border-transparent [stroke-width:1.65]",
                  active
                    ? "border-primary/20 bg-card text-primary shadow-sm shadow-slate-900/5"
                    : "bg-card/80 text-muted-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">{t(item.labelKey)}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mb-4 shrink-0 rounded-2xl border border-border/90 bg-card/85 p-3 text-xs shadow-sm shadow-slate-900/5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("settings.language")}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={language === "pl" ? "default" : "outline"}
              className="h-7 rounded-xl px-2 text-[0.7rem]"
              onClick={() => setLanguage("pl")}
            >
              PL
            </Button>
            <Button
              type="button"
              size="sm"
              variant={language === "en" ? "default" : "outline"}
              className="h-7 rounded-xl px-2 text-[0.7rem]"
              onClick={() => setLanguage("en")}
            >
              EN
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("settings.theme")}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={theme === "light" ? "default" : "outline"}
              className="h-7 rounded-xl px-2 text-[0.7rem]"
              onClick={() => setTheme("light")}
            >
              {t("settings.light")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={theme === "dark" ? "default" : "outline"}
              className="h-7 rounded-xl px-2 text-[0.7rem]"
              onClick={() => setTheme("dark")}
            >
              {t("settings.dark")}
            </Button>
          </div>
        </div>
        {showLogout ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-9 w-full rounded-xl text-[0.75rem]"
            onClick={() => void handleLogout()}
          >
            {t("auth.logOut")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
