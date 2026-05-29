"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import {
  APPOINTMENTS_STATUS_FILTERS,
  appointmentsStatusFilterLabel,
  type AppointmentsListFilter,
} from "@/lib/appointments/appointments-list-filters"
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
}: AppointmentsFiltersBarProps) {
  const { t } = useTranslations()

  return (
    <div className="flex flex-col gap-5">
      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
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
      </div>
      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:max-w-md sm:items-end">
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
