"use client"

import Link from "next/link"
import { CalendarDays, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { AppointmentsListFilter } from "@/lib/appointments/appointments-list-filters"
import type { AppointmentsDayGroupFilter } from "@/lib/appointments/appointments-grouping"
import type { AppointmentsSourceFilter } from "@/lib/appointments/appointments-source-filter"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { StaffAppointmentFilterValue } from "@/lib/staff/staff-display"

type AppointmentsListEmptyProps = {
  staffFilter: StaffAppointmentFilterValue
  listFilter: AppointmentsListFilter
  dayGroupFilter: AppointmentsDayGroupFilter
  sourceFilter: AppointmentsSourceFilter
  hasActiveFilters: boolean
  bookingPagePath: string
  onClearFilters?: () => void
}

export function AppointmentsListEmpty({
  staffFilter,
  listFilter,
  dayGroupFilter,
  sourceFilter,
  hasActiveFilters,
  bookingPagePath,
  onClearFilters,
}: AppointmentsListEmptyProps) {
  const { t } = useTranslations()

  const message =
    staffFilter === "unassigned"
      ? t("appointments.emptyStaffUnassigned")
      : staffFilter !== "all"
        ? t("appointments.emptyStaffFiltered")
        : dayGroupFilter !== "all"
          ? t("appointments.emptyDayGroupFilter")
          : sourceFilter !== "all"
            ? t("appointments.emptySourceFilter")
            : listFilter === "needs_action"
              ? t("appointments.emptyFilterNeedsAction")
              : hasActiveFilters
                ? t("appointments.emptyWithFilters")
                : t("appointments.emptyAllVisits")

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardContent className="px-5 py-10 text-center">
        <CalendarDays className="mx-auto size-9 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-medium text-foreground">{message}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("appointments.emptyHint")}</p>
        <div className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          {hasActiveFilters && onClearFilters ? (
            <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={onClearFilters}>
              {t("appointments.clearFiltersAction")}
            </Button>
          ) : null}
          <Button asChild className="h-10 rounded-xl">
            <Link href={bookingPagePath}>
              <Plus className="mr-1.5 size-4" aria-hidden />
              {t("appointments.emptyCtaAdd")}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
