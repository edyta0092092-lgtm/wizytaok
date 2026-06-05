"use client"

import { Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import {
  APPOINTMENTS_STATUS_FILTERS,
  appointmentsStatusFilterLabel,
  type AppointmentsListFilter,
} from "@/lib/appointments/appointments-list-filters"
import {
  APPOINTMENTS_DAY_GROUP_FILTERS,
  appointmentsDayGroupFilterLabel,
  type AppointmentsDayGroupFilter,
} from "@/lib/appointments/appointments-grouping"
import {
  APPOINTMENTS_SOURCE_FILTERS,
  appointmentsSourceFilterLabel,
  type AppointmentsSourceFilter,
} from "@/lib/appointments/appointments-source-filter"
import { type StaffAppointmentFilterValue } from "@/lib/staff/staff-display"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import type { StaffMember } from "@/types/domain"

export type { AppointmentsListFilter } from "@/lib/appointments/appointments-list-filters"
export { APPOINTMENTS_STATUS_FILTERS } from "@/lib/appointments/appointments-list-filters"

export type AppointmentsFiltersBarProps = {
  staffFilter: StaffAppointmentFilterValue
  onStaffFilterChange: (next: StaffAppointmentFilterValue) => void
  staffLoading: boolean
  staffLoadError: boolean
  staffSelectOptions: StaffMember[]
  filter: AppointmentsListFilter
  onFilterChange: (next: AppointmentsListFilter) => void
  restrictToToday: boolean
  clientNameFilter: string
  onClientNameFilterChange: (next: string) => void
  serviceFilter: string
  onServiceFilterChange: (next: string) => void
  serviceOptions: string[]
  dayGroupFilter: AppointmentsDayGroupFilter
  onDayGroupFilterChange: (next: AppointmentsDayGroupFilter) => void
  sourceFilter: AppointmentsSourceFilter
  onSourceFilterChange: (next: AppointmentsSourceFilter) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (next: string) => void
  onDateToChange: (next: string) => void
  onClearFilters?: () => void
  hasActiveFilters?: boolean
}

export function AppointmentsFiltersBar({
  staffFilter,
  onStaffFilterChange,
  staffLoading,
  staffLoadError,
  staffSelectOptions,
  filter,
  onFilterChange,
  restrictToToday,
  clientNameFilter,
  onClientNameFilterChange,
  serviceFilter,
  onServiceFilterChange,
  serviceOptions,
  dayGroupFilter,
  onDayGroupFilterChange,
  sourceFilter,
  onSourceFilterChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClearFilters,
  hasActiveFilters = false,
}: AppointmentsFiltersBarProps) {
  const { t } = useTranslations()

  return (
    <Card className="rounded-2xl border border-border shadow-sm shadow-slate-900/5">
      <CardHeader className="space-y-1 px-4 pb-2 pt-4 sm:px-5">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Filter className="size-4 text-muted-foreground" aria-hidden />
          {t("appointments.filtersTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 px-4 pb-5 sm:px-5">
        <div className="flex min-w-0 flex-wrap gap-2">
          {APPOINTMENTS_STATUS_FILTERS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filter === value ? "default" : "outline"}
              className={cn(
                "h-9 rounded-full px-4 text-sm",
                filter === value && "shadow-sm",
              )}
              onClick={() => onFilterChange(value)}
            >
              {appointmentsStatusFilterLabel(value, t)}
            </Button>
          ))}
        </div>

        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0">
            <label
              htmlFor="appointments-staff-filter"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t("appointments.staffFilterLabel")}
            </label>
            <NativeSelect
              id="appointments-staff-filter"
              wrapperClassName="w-full"
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm shadow-slate-900/5"
              disabled={staffLoading || staffLoadError}
              value={staffFilter}
              onChange={(e) =>
                onStaffFilterChange(e.target.value as StaffAppointmentFilterValue)
              }
            >
              <option value="all">{t("appointments.staffFilterAll")}</option>
              <option value="unassigned">{t("appointments.staffFilterUnassigned")}</option>
              {staffSelectOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.role?.trim() ? ` - ${m.role.trim()}` : ""}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="min-w-0">
            <label
              htmlFor="appointments-date-from"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t("appointments.dateFromLabel")}
            </label>
            <Input
              id="appointments-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="h-9 rounded-xl"
            />
          </div>
          <div className="min-w-0">
            <label
              htmlFor="appointments-date-to"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t("appointments.dateToLabel")}
            </label>
            <Input
              id="appointments-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="h-9 rounded-xl"
            />
          </div>
        </div>

        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label
              htmlFor="appointments-client-filter"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t("appointments.clientNameFilterLabel")}
            </label>
            <Input
              id="appointments-client-filter"
              value={clientNameFilter}
              onChange={(e) => onClientNameFilterChange(e.target.value)}
              placeholder={t("appointments.clientNameFilterPlaceholder")}
              className="h-9 rounded-xl"
            />
          </div>
          <div className="min-w-0">
            <label
              htmlFor="appointments-service-filter"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t("appointments.serviceFilterLabel")}
            </label>
            <NativeSelect
              id="appointments-service-filter"
              value={serviceFilter}
              onChange={(e) => onServiceFilterChange(e.target.value)}
              wrapperClassName="w-full"
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm shadow-slate-900/5"
            >
              <option value="">{t("appointments.serviceFilterAll")}</option>
              {serviceOptions.map((serviceName) => (
                <option key={serviceName} value={serviceName}>
                  {serviceName}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("appointments.bookingSource.filterLabel")}
          </p>
          <div className="flex min-w-0 flex-wrap gap-2">
            {APPOINTMENTS_SOURCE_FILTERS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={sourceFilter === value ? "default" : "outline"}
                className="h-9 rounded-full px-4 text-sm"
                onClick={() => onSourceFilterChange(value)}
              >
                {appointmentsSourceFilterLabel(value, t)}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 sm:max-w-xs">
            <label
              htmlFor="appointments-day-group-filter"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t("appointments.dayGroupFilterLabel")}
            </label>
            <NativeSelect
              id="appointments-day-group-filter"
              value={dayGroupFilter}
              onChange={(e) =>
                onDayGroupFilterChange(e.target.value as AppointmentsDayGroupFilter)
              }
              wrapperClassName="w-full"
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm shadow-slate-900/5"
            >
              {APPOINTMENTS_DAY_GROUP_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {appointmentsDayGroupFilterLabel(value, t)}
                </option>
              ))}
            </NativeSelect>
          </div>
          {hasActiveFilters && onClearFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 self-start rounded-xl sm:self-end"
              onClick={onClearFilters}
            >
              {t("appointments.clearFiltersAction")}
            </Button>
          ) : null}
        </div>

        {filter !== "all" ? (
          <p className="text-xs leading-relaxed text-muted-foreground" role="status">
            {filter === "confirmed"
              ? restrictToToday
                ? t("appointments.filterHintConfirmedToday")
                : t("appointments.filterHintConfirmed")
              : filter === "needs_action"
                ? t("appointments.filterHintNeedsAction")
                : filter === "completed"
                  ? t("appointments.filterHintCompleted")
                  : filter === "no_show"
                    ? t("appointments.filterHintNoShow")
                    : t("appointments.filterHintCancelled")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
