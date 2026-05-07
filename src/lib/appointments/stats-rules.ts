import { bookingNeedsAction } from "@/lib/bookings/booking-needs-action"
import type { Appointment, AppointmentStatus } from "@/types/domain"

const EXCLUDED_FROM_PLANNED: AppointmentStatus[] = ["cancelled", "no_show", "completed"]

/**
 * "Zaplanowane wizyty" w statystykach dnia: aktywne terminy, bez anulacji i zakończonych.
 * Spójne z /dashboard i paskiem bocznym.
 */
export function isPlannedVisitForDashboardStats(a: Appointment): boolean {
  return !EXCLUDED_FROM_PLANNED.includes(a.status)
}

/**
 * Wizyty wymagające reakcji firmy (kafelek, filtr /appointments, helper booking-needs-action).
 */
export function appointmentRequiresBusinessContact(a: Appointment): boolean {
  return bookingNeedsAction(a)
}
