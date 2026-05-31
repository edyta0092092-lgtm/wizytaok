"use client"

import { CalendarDays } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { AppointmentsListFilter } from "@/lib/appointments/appointments-list-filters"
import type { AppointmentsDayGroupFilter } from "@/lib/appointments/appointments-grouping"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { StaffAppointmentFilterValue } from "@/lib/staff/staff-display"

type AppointmentsListEmptyProps = {
  staffFilter: StaffAppointmentFilterValue
  listFilter: AppointmentsListFilter
  dayGroupFilter: AppointmentsDayGroupFilter
}

export function AppointmentsListEmpty({
  staffFilter,
  listFilter,
  dayGroupFilter,
}: AppointmentsListEmptyProps) {
  const { t } = useTranslations()

  const message =
    staffFilter === "unassigned"
      ? t("appointments.emptyStaffUnassigned")
      : staffFilter !== "all"
        ? t("appointments.emptyStaffFiltered")
        : dayGroupFilter !== "all"
          ? t("appointments.emptyDayGroupFilter")
          : listFilter === "needs_action"
            ? t("appointments.emptyFilterNeedsAction")
            : t("appointments.emptyFilter")

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardContent className="px-5 py-10 text-center">
        <CalendarDays className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-medium text-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
