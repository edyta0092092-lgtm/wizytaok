"use client"

import { AppointmentsFiltersBar, type AppointmentsFiltersBarProps } from "@/components/appointments/appointments-filters-bar"
import {
  AppointmentsListWithRows,
  type AppointmentsListWithRowsProps,
} from "@/components/appointments/appointments-list-with-rows"

export type AppointmentsFiltersAndListSectionProps = {
  filters: AppointmentsFiltersBarProps
  list: AppointmentsListWithRowsProps
}

export function AppointmentsFiltersAndListSection({
  filters,
  list,
}: AppointmentsFiltersAndListSectionProps) {
  return (
    <div data-tour="appointments-statuses" className="flex flex-col gap-5">
      <AppointmentsFiltersBar {...filters} />
      <div className="mt-5 space-y-6">
        <AppointmentsListWithRows {...list} />
      </div>
    </div>
  )
}
