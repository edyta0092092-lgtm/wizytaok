import {
  applyPublicBookingPatchToSupabase,
  unwrapSupabaseBookingAppointmentId,
} from "@/lib/bookings/bookings-store"
import { requestGoogleCalendarBookingSync } from "@/lib/integrations/google-calendar/sync-booking-client"
import { type PublicBooking } from "@/lib/bookings/public-bookings"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getBrowserClient } from "@/lib/supabase/client"
import type { Appointment, StaffMember } from "@/types/domain"

/**
 * Zmiana przypisanego personelu w wierszu rezerwacji Supabase (sb-…).
 */
export async function patchAppointmentRowStaffSupabase(args: {
  row: Appointment
  nextStaffId: string
  staffByService: Record<string, StaffMember[]>
}): Promise<void> {
  const { row, nextStaffId, staffByService } = args
  const uuid = unwrapSupabaseBookingAppointmentId(row.id)
  if (!uuid || !row.serviceId) return
  const client = getBrowserClient()
  if (!client) return
  const bid = await getCurrentBusinessProfileIdForClient(client)
  const options = staffByService[row.serviceId] ?? []
  const picked = options.find((s) => s.id === nextStaffId)
  const patch: Partial<PublicBooking> = nextStaffId.trim()
    ? { staffId: nextStaffId, staffName: picked?.name ?? "" }
    : { staffId: "", staffName: "" }
  const r = await applyPublicBookingPatchToSupabase(client, bid, uuid, patch)
  if (r.ok) {
    requestGoogleCalendarBookingSync(uuid, "upsert")
  }
}
