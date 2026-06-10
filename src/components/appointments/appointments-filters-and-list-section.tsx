"use client"

import { AppointmentsFiltersBar, type AppointmentsFiltersBarProps } from "@/components/appointments/appointments-filters-bar"
import {
  AppointmentsListWithRows,
  type AppointmentsListWithRowsProps,
} from "@/components/appointments/appointments-list-with-rows"
import {
  AppointmentsMobileList,
  type AppointmentsMobileListProps,
} from "@/components/appointments/appointments-mobile-list"
import { AppointmentsListSkeleton } from "@/components/appointments/appointments-list-skeleton"

export type AppointmentsFiltersAndListSectionProps = {
  filters: AppointmentsFiltersBarProps
  list: AppointmentsListWithRowsProps
  mobileList: AppointmentsMobileListProps
  isLoading?: boolean
}

export function AppointmentsFiltersAndListSection({
  filters,
  list,
  mobileList,
  isLoading = false,
}: AppointmentsFiltersAndListSectionProps) {
  return (
    <div data-tour="appointments-statuses" className="flex flex-col gap-5">
      <div className="hidden lg:block">
        <AppointmentsFiltersBar {...filters} />
      </div>
      <div className="space-y-6">
        {isLoading ? (
          <AppointmentsListSkeleton />
        ) : (
          <>
            <div className="lg:hidden">
              <AppointmentsMobileList {...mobileList} />
            </div>
            <div className="hidden lg:block">
              <AppointmentsListWithRows {...list} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
