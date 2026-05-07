"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  APPOINTMENTS_SOURCE_FILTERS,
  APPOINTMENTS_STATUS_FILTERS,
  type AppointmentsListFilter,
} from "@/lib/appointments/appointments-list-filters"
import { type AppointmentSourceFilter } from "@/lib/bookings/booking-source"
import { type StaffAppointmentFilterValue } from "@/lib/staff/staff-display"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import type { StaffMember } from "@/types/domain"

export type { AppointmentsListFilter } from "@/lib/appointments/appointments-list-filters"
export { APPOINTMENTS_SOURCE_FILTERS, APPOINTMENTS_STATUS_FILTERS } from "@/lib/appointments/appointments-list-filters"

export type AppointmentsFiltersBarProps = {
  sourceFilter: AppointmentSourceFilter
  onSourceFilterChange: (next: AppointmentSourceFilter) => void
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
}

export function AppointmentsFiltersBar({
  sourceFilter,
  onSourceFilterChange,
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
}: AppointmentsFiltersBarProps) {
  const { t } = useTranslations()

  return (
    <div className="flex flex-col gap-5">
      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
        <div className="min-w-0">
          <label
            htmlFor="appointments-source-filter"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            {t("appointments.bookingSource.filterLabel")}
          </label>
          <select
            id="appointments-source-filter"
            className="h-9 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm shadow-slate-900/5"
            value={sourceFilter}
            onChange={(e) =>
              onSourceFilterChange(e.target.value as AppointmentSourceFilter)
            }
          >
            {APPOINTMENTS_SOURCE_FILTERS.map((sf) => (
              <option key={sf} value={sf}>
                {sf === "all"
                  ? t("appointments.bookingSource.filterAll")
                  : sf === "online"
                    ? t("appointments.bookingSource.filterOnline")
                    : t("appointments.bookingSource.filterManual")}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label
            htmlFor="appointments-staff-filter"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            {t("appointments.staffFilterLabel")}
          </label>
          <select
            id="appointments-staff-filter"
            className="h-9 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm shadow-slate-900/5"
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
          </select>
          {staffLoading ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("appointments.staffFilterLoading")}
            </p>
          ) : null}
          {staffLoadError ? (
            <p className="mt-1 text-xs text-destructive">
              {t("appointments.staffFilterLoadError")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
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
          <select
            id="appointments-service-filter"
            value={serviceFilter}
            onChange={(e) => onServiceFilterChange(e.target.value)}
            className="h-9 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm shadow-slate-900/5"
          >
            <option value="">{t("appointments.serviceFilterAll")}</option>
            {serviceOptions.map((serviceName) => (
              <option key={serviceName} value={serviceName}>
                {serviceName}
              </option>
            ))}
          </select>
        </div>
      </div>
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
            {value === "all"
              ? t("appointments.all")
              : value === "booked"
                ? t("appointments.booked")
                : value === "pending"
                  ? t("appointments.pending")
                  : value === "confirmed"
                    ? t("appointments.confirmed")
                    : value === "no_show"
                      ? t("appointments.noShow")
                      : value === "needs_action"
                        ? t("appointments.filterNeedsAction")
                        : t("appointments.cancelled")}
          </Button>
        ))}
      </div>
      {filter !== "all" ? (
        <p className="text-xs leading-relaxed text-muted-foreground" role="status">
          {filter === "needs_action"
            ? restrictToToday
              ? t("appointments.filterHintNeedsActionToday")
              : t("appointments.filterHintNeedsAction")
            : filter === "unconfirmed"
              ? t("appointments.filterHintUnconfirmed")
              : filter === "pending"
                ? restrictToToday
                  ? t("appointments.filterHintPendingToday")
                  : t("appointments.filterHintBooked")
                : filter === "booked"
                  ? t("appointments.filterHintBooked")
                  : filter === "confirmed"
                    ? restrictToToday
                      ? t("appointments.filterHintConfirmedToday")
                      : t("appointments.filterHintConfirmed")
                    : filter === "no_show"
                      ? t("appointments.filterHintNoShow")
                      : t("appointments.filterHintCancelled")}
        </p>
      ) : null}
      {staffFilter !== "all" ? (
        <p className="text-xs leading-relaxed text-muted-foreground" role="status">
          {staffFilter === "unassigned"
            ? t("appointments.staffFilterHintUnassigned")
            : t("appointments.staffFilterHintSelected").replace(
                "{name}",
                staffSelectOptions.find((m) => m.id === staffFilter)?.name ?? "",
              )}
        </p>
      ) : null}
    </div>
  )
}
