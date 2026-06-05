"use client"

import { AppointmentsFiltersBar, type AppointmentsFiltersBarProps } from "@/components/appointments/appointments-filters-bar"
import {
  AppointmentsListWithRows,
  type AppointmentsListWithRowsProps,
} from "@/components/appointments/appointments-list-with-rows"
import { AppointmentsListSkeleton } from "@/components/appointments/appointments-list-skeleton"

export type AppointmentsFiltersAndListSectionProps = {
  filters: AppointmentsFiltersBarProps
  list: AppointmentsListWithRowsProps
  isLoading?: boolean
}

export function AppointmentsFiltersAndListSection({
  filters,
  list,
  isLoading = false,
}: AppointmentsFiltersAndListSectionProps) {
  return (
    <div data-tour="appointments-statuses" className="flex flex-col gap-5">
      <AppointmentsFiltersBar {...filters} />
      <div className="space-y-6">
        {isLoading ? <AppointmentsListSkeleton /> : <AppointmentsListWithRows {...list} />}
      </div>
    </div>
  )
}
