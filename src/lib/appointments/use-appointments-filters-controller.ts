"use client"

import * as React from "react"

import type { AppointmentsListFilter } from "@/lib/appointments/appointments-list-filters"
import type { AppointmentSourceFilter } from "@/lib/bookings/booking-source"
import type { StaffAppointmentFilterValue } from "@/lib/staff/staff-display"
import type { StaffMember } from "@/types/domain"

export type UseAppointmentsFiltersControllerParams = {
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
}

export function useAppointmentsFiltersController({
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
}: UseAppointmentsFiltersControllerParams) {
  return React.useMemo(
    () => ({
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
    }),
    [
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
    ],
  )
}
