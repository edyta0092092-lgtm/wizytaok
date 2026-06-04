import { updateAppointmentStatus } from "@/lib/appointments/appointments-store"
import { unwrapManualAppointmentId, updateManualAppointment } from "@/lib/appointments/manual-appointments"
import { fetchCancelBookingByCompany } from "@/lib/bookings/cancel-booking-by-company-client"
import { resolveSupabaseBookingRowUuidFromUiId } from "@/lib/bookings/bookings-store"
import { updatePublicBooking, unwrapPublicAppointmentId } from "@/lib/bookings/public-bookings"
import {
  enqueueTransactionalHistoryMirror,
  notifyNotificationMessagesChanged,
} from "@/lib/notifications/notifications"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { TablesUpdate } from "@/types/database"

/**
 * Anuluje wizytę (publiczna / manualna / Supabase po API). Sama wizyta pozostaje
 * w bazie (status `cancelled`) — nie znika ze statystyk. Ukrycie z panelu listy
 * jest osobną decyzją UI (patrz handler przycisku „Usuń").
 */
function notifyBookingsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pw-bookings"))
    notifyNotificationMessagesChanged()
  }
}

function applyCancellationHistoryMirror(
  apiResult: Awaited<ReturnType<typeof fetchCancelBookingByCompany>>,
): void {
  if (!apiResult.ok || !apiResult.cancellationHistoryMirror) return
  enqueueTransactionalHistoryMirror(
    "booking_cancelled_by_company",
    apiResult.cancellationHistoryMirror,
  )
}

export async function cancelAppointmentFromRemove(
  appointmentId: string,
  language: "pl" | "en",
  notifyClient = false,
): Promise<{ ok: boolean; error?: string; data?: unknown; notice?: string }> {
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
    if (!updated) return { ok: false, error: "local_update_failed" }
    notifyBookingsChanged()
    return { ok: true }
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
    if (!updated) return { ok: false, error: "local_update_failed" }
    notifyBookingsChanged()
    return { ok: true }
  }

  const bookingUuid = resolveSupabaseBookingRowUuidFromUiId(tid)
  if (bookingUuid) {
    if (notifyClient) {
      const apiResult = await fetchCancelBookingByCompany(tid, language, true)
      applyCancellationHistoryMirror(apiResult)
      notifyBookingsChanged()
      if (apiResult.ok) {
        return { ok: true, notice: apiResult.notice }
      }
      return { ok: false, error: apiResult.errorMessage ?? "cancel_notify_failed" }
    }

    const client = getBrowserClient()
    if (client && isSupabaseConfigured()) {
      const now = new Date().toISOString()
      const basePatch: TablesUpdate<"bookings"> = {
        status: "cancelled",
        cancelled_at: now,
        cancelled_by: "company",
        updated_at: now,
      }
      let patch = { ...basePatch }
      let data: unknown = null
      let updateError: string | null = null
      for (let i = 0; i < 4; i += 1) {
        const { data: row, error } = await client.from("bookings").update(patch).eq("id", bookingUuid).select("*").single()
        if (!error) {
          data = row
          updateError = null
          break
        }
        const msg = String(error.message ?? "")
        const missingColumnMatch = msg.match(/column\s+([a-zA-Z0-9_\."]+)\s+does not exist/i)
        if (!missingColumnMatch) {
          updateError = msg
          break
        }
        const raw = missingColumnMatch[1] ?? ""
        const missing = raw.replace(/"/g, "").split(".").pop()?.trim() ?? ""
        if (!missing) {
          updateError = msg
          break
        }
        if (missing === "cancelled_at") {
          const { cancelled_at: _skip, ...rest } = patch
          void _skip
          patch = rest
          continue
        }
        if (missing === "cancelled_by") {
          const { cancelled_by: _skip, ...rest } = patch
          void _skip
          patch = rest
          continue
        }
        if (missing === "updated_at") {
          const { updated_at: _skip, ...rest } = patch
          void _skip
          patch = rest
          continue
        }
        updateError = msg
        break
      }
      if (updateError) {
        const minimal = await client
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("id", bookingUuid)
          .select("*")
          .single()
        if (minimal.error) {
          return { ok: false, error: minimal.error.message || updateError }
        }
        data = minimal.data
      }
      notifyBookingsChanged()
      return { ok: true, data }
    }

    const apiResult = await fetchCancelBookingByCompany(tid, language, notifyClient)
    applyCancellationHistoryMirror(apiResult)
    if (!apiResult.ok) {
      return { ok: false, error: apiResult.errorMessage }
    }
    notifyBookingsChanged()
    return { ok: true, notice: apiResult.notice }
  }

  const mockOk = await updateAppointmentStatus(tid, "cancelled", {
    lastUpdatedBy: "business",
    lastStatusChangeSource: "manual",
  })
  if (!mockOk) return { ok: false, error: "unknown_appointment_id" }
  notifyBookingsChanged()
  return { ok: true }
}
