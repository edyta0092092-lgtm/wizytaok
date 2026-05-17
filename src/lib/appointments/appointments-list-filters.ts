import type { AppointmentSourceFilter } from "@/lib/bookings/booking-source"
import type { AppointmentStatus } from "@/types/domain"

export type AppointmentsListFilter =
  | "all"
  | AppointmentStatus
  | "unconfirmed"
  | "needs_action"

export const APPOINTMENTS_SOURCE_FILTERS: AppointmentSourceFilter[] = [
  "all",
  "online",
  "manual",
]

/** Widoczne przyciski statusu na liście wizyt (pozostałe statusy tylko w danych / starych linkach). */
export const APPOINTMENTS_STATUS_FILTERS: AppointmentsListFilter[] = [
  "all",
  "confirmed",
  "cancelled",
]

export function normalizeAppointmentsStatusFilterFromUrl(
  raw: string | null | undefined,
): AppointmentsListFilter {
  const value = String(raw ?? "").trim()
  if (value === "confirmed" || value === "cancelled" || value === "all") {
    return value
  }
  return "all"
}
