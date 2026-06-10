"use client"

import Link from "next/link"
import { ListTodo } from "lucide-react"

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
import { appointmentsManualCreateHref } from "@/lib/appointments/appointments-manual-create-path"
import { appointmentShowsNeedsActionStatus } from "@/lib/appointments/stats-rules"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { Appointment, AppointmentStatus } from "@/types/domain"

type DashboardTodayListProps = {
  rows: Appointment[]
  loading?: boolean
  loadError?: boolean
  currentTime: Date
  timeFmt: Intl.DateTimeFormat
  onChangeStatus: (
    appointmentId: string,
    currentStatus: AppointmentStatus,
    nextStatus: AppointmentStatus,
  ) => void
}

export function DashboardTodayList({
  rows,
  loading,
  loadError,
  currentTime,
  timeFmt,
  onChangeStatus,
}: DashboardTodayListProps) {
  const { t } = useTranslations()

  return (
    <Card
      data-tour="dashboard-today"
      className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ListTodo className="size-4 text-primary" aria-hidden />
          <CardTitle className="text-sm font-semibold">{t("dashboard.todaysAppointments")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {loading ? (
            <li className="px-4 py-5 text-sm text-muted-foreground">
              {loadError ? t("dashboard.statsLoadError") : t("dashboard.statsLoading")}
            </li>
          ) : rows.length === 0 ? (
            <li className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">{t("dashboard.noAppointmentsTodayShort")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.emptyTodayHint")}</p>
              <Button asChild className="mt-4 h-10 rounded-xl" size="sm">
                <Link href={appointmentsManualCreateHref()}>{t("dashboard.emptyTodayCta")}</Link>
              </Button>
            </li>
          ) : (
            rows.map((row) => {
              const when = new Date(row.startsAt)
              const visitLocked = isAppointmentVisitLocked(row.status)
              const statusOptions = APPOINTMENT_ROW_STATUS_ORDER.filter((s) => s !== row.status)
              return (
                <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3.5 sm:py-3">
                  <div className="flex min-w-0 gap-3">
                    <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-muted px-3 text-xs font-semibold tabular-nums text-primary">
                      {timeFmt.format(when)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-semibold text-foreground">{row.clientName}</p>
                        <BookingSourceBadge source={row.source} variant="short" />
                      </div>
                      <p className="text-sm text-muted-foreground">{row.serviceLabel}</p>
                      <AppointmentStaffCaption appointment={row} variant="compact" className="mt-0.5" />
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
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-10 min-w-[2.75rem] rounded-xl px-3 text-xs sm:h-8"
                          >
                            {t("appointments.changeStatusAction")}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {statusOptions.map((status) => (
                            <DropdownMenuItem
                              key={status}
                              onClick={() => onChangeStatus(row.id, row.status, status)}
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
  )
}
