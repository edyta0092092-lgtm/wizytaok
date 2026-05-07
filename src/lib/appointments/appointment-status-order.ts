import type { AppointmentStatus } from "@/types/domain"

/** Kolejność statusów w menu „Zmień status” na liście wizyt. */
export const APPOINTMENT_ROW_STATUS_ORDER: AppointmentStatus[] = [
  "booked",
  "pending",
  "confirmed",
  "no_show",
  "cancelled",
]
