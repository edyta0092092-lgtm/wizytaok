"use client"

import { CalendarCheck, Clock, Scissors } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { ClientPortalDashboard } from "@/lib/client-portal/types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function ClientPortalDashboardView({ dashboard }: { dashboard: ClientPortalDashboard }) {
  const { t } = useTranslations()
  const next = dashboard.nextBooking

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          icon={CalendarCheck}
          label={t("clientPortal.kpiVisits")}
          value={String(dashboard.visitCount)}
        />
        <Kpi
          icon={Scissors}
          label={t("clientPortal.kpiLastService")}
          value={dashboard.lastServiceName ?? "—"}
          small
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
      </div>

      <Card className="rounded-2xl border border-violet-500/20 bg-violet-500/5 shadow-sm">
        <CardContent className="px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
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
      <CardContent className="flex items-start gap-3 px-4 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={`mt-1 font-semibold ${small ? "text-sm" : "text-2xl tabular-nums"}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
