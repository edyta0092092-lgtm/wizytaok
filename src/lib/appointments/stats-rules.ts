import {
  bookingNeedsAction,
  bookingRequiresPostVisitStatus,
} from "@/lib/bookings/booking-needs-action"
import type { Appointment, AppointmentStatus } from "@/types/domain"

/** Status traktowany jako potwierdzona wizyta w licznikach dzisiejszego planu. */
export function isConfirmedVisitStatus(status: AppointmentStatus | string): boolean {
  const s = String(status)
  return s === "confirmed"
}

/**
 * "Zaplanowane wizyty" w statystykach dnia: wyłącznie potwierdzone terminy, które jeszcze się nie rozpoczęły.
 * Spójne z /dashboard i paskiem bocznym.
 */
export function isPlannedVisitForDashboardStats(a: Appointment, at: Date = new Date()): boolean {
  if (!isConfirmedVisitStatus(a.status)) return false
  const startsAt = new Date(a.startsAt)
  if (Number.isNaN(startsAt.getTime())) return false
  return startsAt.getTime() > at.getTime()
}

/**
 * Wizyty wymagające reakcji firmy (dashboard, badge wiersza — szersze niż filtr listy).
 */
export function appointmentRequiresBusinessContact(a: Appointment): boolean {
  return bookingNeedsAction(a)
}

/** Minione wizyty bez statusu końcowego — spójne z filtrem „Wymaga działania” na /appointments. */
export function appointmentRequiresPostVisitAction(a: Appointment, at: Date = new Date()): boolean {
  return bookingRequiresPostVisitStatus(a, at)
}

export function countStatisticsNeedsActionVisits(
  appointments: readonly Appointment[],
  at: Date = new Date(),
): number {
  let n = 0
  for (const a of appointments) {
    if (appointmentRequiresPostVisitAction(a, at)) n += 1
  }
  return n
}

/**
 * Wizyty wliczane do KPI „Wszystkie wizyty” (łącznie): zrealizowane, anulowane,
 * nieobecność klienta oraz wizyty wymagające działania (dopóki status się nie zmieni).
 */
export function countsTowardStatisticsTotalVisits(
  a: Appointment,
  at: Date = new Date(),
): boolean {
  const s = a.status
  if (s === "cancelled" || s === "no_show" || s === "completed") return true
  return appointmentRequiresPostVisitAction(a, at)
}
