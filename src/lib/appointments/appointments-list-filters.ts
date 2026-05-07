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

export const APPOINTMENTS_STATUS_FILTERS: AppointmentsListFilter[] = [
  "all",
  "booked",
  "pending",
  "confirmed",
  "no_show",
  "cancelled",
  "needs_action",
]
