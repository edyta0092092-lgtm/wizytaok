import type { Appointment, BookingSource } from "@/types/domain"

export type AppointmentsSourceFilter = "all" | "online" | "manual"

export const APPOINTMENTS_SOURCE_FILTERS: AppointmentsSourceFilter[] = [
  "all",
  "online",
  "manual",
]

export function isManualBookingSource(source: BookingSource | undefined): boolean {
  return (
    source === "manual" ||
    source === "manual_admin" ||
    source === "manual_staff"
  )
}

export function appointmentMatchesSourceFilter(
  row: Appointment,
  filter: AppointmentsSourceFilter,
): boolean {
  if (filter === "all") return true
  if (filter === "online") return row.source === "online"
  return isManualBookingSource(row.source)
}

export function appointmentsSourceFilterLabel(
  value: AppointmentsSourceFilter,
  t: (key: string) => string,
): string {
  if (value === "all") return t("appointments.bookingSource.filterAll")
  if (value === "online") return t("appointments.bookingSource.filterOnline")
  return t("appointments.bookingSource.filterManual")
}

export function appointmentSourceLabel(
  source: BookingSource | undefined,
  t: (key: string) => string,
): string {
  if (source === "online") return t("appointments.bookingSource.shortOnline")
  return t("appointments.bookingSource.shortManual")
}

export type AppointmentSourceTone = "online" | "manual"

export function appointmentSourceTone(source: BookingSource | undefined): AppointmentSourceTone {
  return source === "online" ? "online" : "manual"
}
