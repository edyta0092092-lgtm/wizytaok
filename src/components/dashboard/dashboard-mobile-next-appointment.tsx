"use client"

import Link from "next/link"
import { Phone } from "lucide-react"

import { AppointmentStaffCaption } from "@/components/shared/appointment-staff-caption"
import { BookingSourceBadge } from "@/components/shared/booking-source-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { appointmentShowsNeedsActionStatus } from "@/lib/appointments/stats-rules"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { Appointment } from "@/types/domain"

type DashboardMobileNextAppointmentProps = {
  appointment: Appointment | null
  currentTime: Date
  loading?: boolean
  timeFmt: Intl.DateTimeFormat
}

function minutesUntil(startsAt: string, now: Date): number {
  return Math.max(0, Math.round((new Date(startsAt).getTime() - now.getTime()) / 60_000))
}

export function DashboardMobileNextAppointment({
  appointment,
  currentTime,
  loading,
  timeFmt,
}: DashboardMobileNextAppointmentProps) {
  const { t } = useTranslations()

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">{t("dashboard.nearestAppointment")}</h2>
      <Card className="rounded-2xl border-2 border-primary/25 bg-[color:var(--nav-active-bg)] shadow-md shadow-primary/10">
        <CardContent className="space-y-4 p-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.statsLoading")}</p>
          ) : !appointment ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.nextAppointmentEmpty")}</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold tabular-nums leading-none text-primary">
                    {timeFmt.format(new Date(appointment.startsAt))}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-muted-foreground">
                    {t("dashboard.nextAppointmentIn").replace(
                      "{minutes}",
                      String(minutesUntil(appointment.startsAt, currentTime)),
                    )}
                  </p>
                </div>
                <StatusBadge
                  status={appointment.status}
                  needsAction={appointmentShowsNeedsActionStatus(appointment, currentTime)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-xl font-semibold leading-tight text-foreground">
                    {appointment.clientName}
                  </p>
                  <BookingSourceBadge source={appointment.source} variant="short" />
                </div>
                <p className="text-base text-muted-foreground">{appointment.serviceLabel}</p>
                <AppointmentStaffCaption appointment={appointment} variant="compact" className="text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {appointment.phone?.trim() ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 touch-manipulation rounded-xl"
                    asChild
                  >
                    <a href={`tel:${appointment.phone.replace(/\s/g, "")}`}>
                      <Phone className="mr-1.5 size-4" aria-hidden />
                      {t("customers.profile.actionCall")}
                    </a>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="h-11 touch-manipulation rounded-xl"
                  asChild
                >
                  <Link href="/appointments">{t("dashboard.nextAppointmentOpen")}</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
