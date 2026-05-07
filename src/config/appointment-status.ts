import type { AppointmentStatus } from "@/types/domain"

/** Wartości statusów dostępne w formularzu nowej wizyty */
export const appointmentFormStatusOrder: AppointmentStatus[] = [
  "booked",
  "pending",
  "confirmed",
  "no_show",
  "cancelled",
  "completed",
]
