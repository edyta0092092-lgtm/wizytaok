import type { ManualAppointmentFormState } from "@/components/appointments/manual-appointment-sheet"
import { createManualBooking } from "@/lib/bookings/bookings-store"
import { MANUAL_BOOKING_ANY_STAFF, resolveManualBookingStaffSelection } from "@/lib/bookings/manual-booking-staff"
import { saveManualAppointment, type ManualAppointment } from "@/lib/appointments/manual-appointments"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Service, StaffMember } from "@/types/domain"

export type SubmitManualSheetFailureReason =
  | { code: "slot_required" }
  | { code: "no_service" }
  | { code: "staff_resolution"; errorKey: string }
  | { code: "create_failed"; error: "slot_taken" | "other" }

export type SubmitManualSheetResult =
  | { ok: true }
  | { ok: false; reason: SubmitManualSheetFailureReason }

/**
 * Zapis wizyty z formularza „ręcznej” rezerwacji (Supabase lub lokalny store).
 */
export async function submitManualAppointmentSheet(input: {
  form: ManualAppointmentFormState
  selectedService: Service | null
  manualStaffForService: StaffMember[]
  hasActiveTeamMembers: boolean
}): Promise<SubmitManualSheetResult> {
  const { form, selectedService: svc, manualStaffForService, hasActiveTeamMembers } = input

  if (!form.date.trim() || !form.time.trim()) {
    return { ok: false, reason: { code: "slot_required" } }
  }
  if (!svc) {
    return { ok: false, reason: { code: "no_service" } }
  }

  const serviceName = svc.name.trim()
  const client = getBrowserClient()
  const bid =
    isSupabaseConfigured() && client ? await getCurrentBusinessProfileIdForClient(client) : null

  if (client && bid) {
    const resolution = await resolveManualBookingStaffSelection({
      client,
      businessId: bid,
      service: svc,
      appointmentDate: form.date,
      appointmentTime: form.time,
      staffChoice: form.manualStaffId.trim(),
      candidates: manualStaffForService,
      hasActiveTeam: hasActiveTeamMembers,
    })
    if (!resolution.ok) {
      return { ok: false, reason: { code: "staff_resolution", errorKey: resolution.errorKey } }
    }
    const r = await createManualBooking(client, bid, {
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      clientEmail: form.clientEmail.trim() || undefined,
      serviceName,
      serviceId: svc.id,
      staffId: resolution.staffId,
      staffName: resolution.staffName,
      serviceDurationMinutes: svc.durationMinutes,
      servicePrice: svc.price,
      serviceCurrency: svc.currency ?? "PLN",
      appointmentDate: form.date,
      appointmentTime: form.time,
      status: form.status,
      customerNote: form.note.trim() || undefined,
      bookingSource: "manual",
    })
    if (!r.ok) {
      return {
        ok: false,
        reason: { code: "create_failed", error: r.error === "slot_taken" ? "slot_taken" : "other" },
      }
    }
    return { ok: true }
  }

  let staffIdLocal: string | undefined
  let staffNameLocal: string | undefined
  if (manualStaffForService.length === 1) {
    staffIdLocal = manualStaffForService[0]?.id
    staffNameLocal = manualStaffForService[0]?.name
  } else if (form.manualStaffId.trim() === MANUAL_BOOKING_ANY_STAFF) {
    const sorted = [...manualStaffForService].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
    staffIdLocal = sorted[0]?.id
    staffNameLocal = sorted[0]?.name
  } else if (form.manualStaffId.trim()) {
    const one = manualStaffForService.find((s) => s.id === form.manualStaffId.trim())
    staffIdLocal = one?.id
    staffNameLocal = one?.name
  }

  const manual: ManualAppointment = {
    id: crypto.randomUUID(),
    clientName: form.clientName.trim(),
    clientPhone: form.clientPhone.trim(),
    clientEmail: form.clientEmail.trim() || undefined,
    serviceName,
    date: form.date,
    time: form.time,
    status: form.status,
    note: form.note.trim() || undefined,
    source: "manual",
    createdAt: new Date().toISOString(),
    serviceId: svc.id,
    staffId: staffIdLocal,
    staffName: staffNameLocal,
  }
  saveManualAppointment(manual)
  return { ok: true }
}
