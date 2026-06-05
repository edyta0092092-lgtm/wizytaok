"use client"

import { CalendarCheck, Clock, History, Scissors } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { ClientPortalDashboard } from "@/lib/client-portal/types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function ClientPortalDashboardView({ dashboard }: { dashboard: ClientPortalDashboard }) {
  const { t } = useTranslations()
  const next = dashboard.nextBooking
  const last = dashboard.lastBooking

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Kpi
          icon={CalendarCheck}
          label={t("clientPortal.kpiVisits")}
          value={String(dashboard.visitCount)}
        />
        <Kpi
          icon={Clock}
          label={t("clientPortal.kpiNextVisit")}
          value={
            next
              ? `${next.appointmentDate} ${next.appointmentTime.slice(0, 5)}`
              : t("clientPortal.noUpcoming")
          }
          small
        />
        <Kpi
          icon={History}
          label={t("clientPortal.kpiLastVisit")}
          value={
            last
              ? `${last.appointmentDate} ${last.appointmentTime.slice(0, 5)}`
              : t("clientPortal.noHistory")
          }
          small
        />
        <Kpi
          icon={Scissors}
          label={t("clientPortal.kpiLastService")}
          value={dashboard.lastServiceName ?? "—"}
          small
        />
      </div>

      <Card className="rounded-2xl border border-primary/15 bg-primary/5 shadow-sm">
        <CardContent className="px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {t("clientPortal.nextAppointmentTitle")}
          </p>
          {next ? (
            <div className="mt-2 space-y-1">
              <p className="text-base font-semibold">{next.serviceName}</p>
              <p className="text-sm text-muted-foreground">
                {next.appointmentDate} · {next.appointmentTime.slice(0, 5)} · {next.businessName}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t("clientPortal.noUpcoming")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  small,
}: {
  icon: typeof CalendarCheck
  label: string
  value: string
  small?: boolean
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="flex items-start gap-3 px-3 py-3 sm:px-4 sm:py-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary sm:size-9">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground sm:text-[0.6875rem]">
            {label}
          </p>
          <p
            className={`mt-1 font-semibold leading-snug ${small ? "text-xs sm:text-sm" : "text-xl tabular-nums sm:text-2xl"}`}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
