import type { AppointmentStatus } from "@/types/domain"

/** Status końcowy — bez edycji wizyty i ręcznej zmiany statusu w panelu. */
export function isAppointmentVisitLocked(status: AppointmentStatus | string): boolean {
  const s = String(status)
  return s === "cancelled" || s === "completed" || s === "no_show"
}
