import { updateAppointmentStatus } from "@/lib/appointments/appointments-store"
import { unwrapManualAppointmentId, updateManualAppointment } from "@/lib/appointments/manual-appointments"
import { fetchCancelBookingByCompany } from "@/lib/bookings/cancel-booking-by-company-client"
import { resolveSupabaseBookingRowUuidFromUiId } from "@/lib/bookings/bookings-store"
import { updatePublicBooking, unwrapPublicAppointmentId } from "@/lib/bookings/public-bookings"

/**
 * Anuluje wizytę po żądaniu usunięcia wiersza (publiczna / manualna / Supabase po API).
 */
export async function cancelAppointmentFromRemove(
  appointmentId: string,
  language: "en" | "pl",
): Promise<{ ok: boolean; error?: string }> {
  const tid = typeof appointmentId === "string" ? appointmentId.trim() : ""
  if (!tid) {
    return { ok: false, error: "missing_appointment_id" }
  }

  const rawPb = unwrapPublicAppointmentId(tid)
  if (rawPb) {
    const now = new Date().toISOString()
    const updated = updatePublicBooking(rawPb, {
      status: "cancelled",
      cancelledAt: now,
      cancelledBy: "company",
      lastUpdatedBy: "business",
      updatedAt: now,
      lastStatusChangeSource: "manual",
    })
    return updated ? { ok: true } : { ok: false, error: "local_update_failed" }
  }

  const rawMa = unwrapManualAppointmentId(tid)
  if (rawMa) {
    const now = new Date().toISOString()
    const updated = updateManualAppointment(rawMa, {
      status: "cancelled",
      lastUpdatedBy: "business",
      updatedAt: now,
      lastStatusChangeSource: "manual",
    })
    return updated ? { ok: true } : { ok: false, error: "local_update_failed" }
  }

  const bookingUuid = resolveSupabaseBookingRowUuidFromUiId(tid)
  if (bookingUuid) {
    const apiResult = await fetchCancelBookingByCompany(tid, language, false)
    if (!apiResult.ok) {
      return { ok: false, error: apiResult.errorMessage }
    }
    window.dispatchEvent(new Event("pw-bookings"))
    return { ok: true }
  }

  const mockOk = await updateAppointmentStatus(tid, "cancelled", {
    lastUpdatedBy: "business",
    lastStatusChangeSource: "manual",
  })
  return mockOk ? { ok: true } : { ok: false, error: "unknown_appointment_id" }
}
