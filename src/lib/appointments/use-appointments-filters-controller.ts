"use client"

import * as React from "react"

import type { AppointmentsListFilter } from "@/lib/appointments/appointments-list-filters"
import type { AppointmentsDayGroupFilter } from "@/lib/appointments/appointments-grouping"
import type { AppointmentsSourceFilter } from "@/lib/appointments/appointments-source-filter"
import type { StaffAppointmentFilterValue } from "@/lib/staff/staff-display"
import type { StaffMember } from "@/types/domain"

export type UseAppointmentsFiltersControllerParams = {
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
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function useAppointmentsFiltersController({
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
  hasActiveFilters,
}: UseAppointmentsFiltersControllerParams) {
  return React.useMemo(
    () => ({
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
      hasActiveFilters,
    }),
    [
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
      hasActiveFilters,
    ],
  )
}
