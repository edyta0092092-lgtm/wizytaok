"use client"

import Link from "next/link"
import { User } from "lucide-react"

import { AppointmentStaffCaption } from "@/components/shared/appointment-staff-caption"
import { BookingSourceBadge } from "@/components/shared/booking-source-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { appointmentShowsNeedsActionStatus } from "@/lib/appointments/stats-rules"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { Appointment } from "@/types/domain"

type DashboardNextAppointmentProps = {
  appointment: Appointment | null
  currentTime: Date
  loading?: boolean
  timeFmt: Intl.DateTimeFormat
}

function minutesUntil(startsAt: string, now: Date): number {
  return Math.max(0, Math.round((new Date(startsAt).getTime() - now.getTime()) / 60_000))
}

export function DashboardNextAppointment({
  appointment,
  currentTime,
  loading,
  timeFmt,
}: DashboardNextAppointmentProps) {
  const { t } = useTranslations()

  return (
    <Card className="rounded-2xl border border-primary/20 bg-[color:var(--nav-active-bg)] shadow-sm shadow-slate-900/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t("dashboard.nextAppointment")}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.statsLoading")}</p>
        ) : !appointment ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.nextAppointmentEmpty")}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 items-center rounded-full bg-card px-3 text-sm font-semibold tabular-nums text-primary">
                {timeFmt.format(new Date(appointment.startsAt))}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {t("dashboard.nextAppointmentIn").replace(
                  "{minutes}",
                  String(minutesUntil(appointment.startsAt, currentTime)),
                )}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-lg font-semibold leading-tight text-foreground">
                    {appointment.clientName}
                  </p>
                  <BookingSourceBadge source={appointment.source} variant="short" />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{appointment.serviceLabel}</p>
                <AppointmentStaffCaption appointment={appointment} variant="compact" className="mt-1" />
              </div>
              <StatusBadge
                status={appointment.status}
                needsAction={appointmentShowsNeedsActionStatus(appointment, currentTime)}
              />
            </div>
            <Link
              href="/appointments"
              className="inline-flex min-h-10 touch-manipulation items-center gap-1.5 text-sm font-medium text-primary"
            >
              <User className="size-4" aria-hidden />
              {t("dashboard.nextAppointmentOpen")}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
