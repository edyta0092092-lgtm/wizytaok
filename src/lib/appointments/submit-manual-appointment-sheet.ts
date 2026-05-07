import type { ManualAppointmentFormState } from "@/components/appointments/manual-appointment-sheet"
import { manualAppointmentFormPhoneE164 } from "@/lib/appointments/can-submit-manual-appointment"
import { createOnlineBooking, updateBooking } from "@/lib/bookings/bookings-store"
import { MANUAL_BOOKING_ANY_STAFF, resolveManualBookingStaffSelection } from "@/lib/bookings/manual-booking-staff"
import { saveManualAppointment, type ManualAppointment } from "@/lib/appointments/manual-appointments"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { TablesUpdate } from "@/types/database"
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
  businessId?: string | null
  form: ManualAppointmentFormState
  selectedService: Service | null
  manualStaffForService: StaffMember[]
  hasActiveTeamMembers: boolean
}): Promise<SubmitManualSheetResult> {
  const { businessId, form, selectedService: svc, manualStaffForService, hasActiveTeamMembers } = input
  const clientName = [form.clientFirstName.trim(), form.clientLastName.trim()].filter(Boolean).join(" ")

  if (!form.date.trim() || !form.time.trim()) {
    return { ok: false, reason: { code: "slot_required" } }
  }
  if (!svc) {
    return { ok: false, reason: { code: "no_service" } }
  }

  const serviceName = svc.name.trim()
  const createLocalManual = (staffId?: string, staffName?: string): SubmitManualSheetResult => {
    const manual: ManualAppointment = {
      id: crypto.randomUUID(),
      clientName,
      clientPhone: manualAppointmentFormPhoneE164(form),
      clientEmail: form.clientEmail.trim() || undefined,
      serviceName,
      date: form.date,
      time: form.time,
      status: form.status,
      note: form.note.trim() || undefined,
      source: "manual",
      createdAt: new Date().toISOString(),
      serviceId: svc.id,
      staffId,
      staffName,
    }
    saveManualAppointment(manual)
    return { ok: true }
  }
  const client = getBrowserClient()
  const supabaseRuntime = isSupabaseConfigured()
  const bid =
    supabaseRuntime && client
      ? businessId?.trim() || (await getCurrentBusinessProfileIdForClient(client))
      : null

  if (supabaseRuntime) {
    if (!client || !bid) {
      return { ok: false, reason: { code: "create_failed", error: "other" } }
    }
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
    const { data: profile } = await client
      .from("business_profiles")
      .select("slug")
      .eq("id", bid)
      .maybeSingle()
    const slug = typeof profile?.slug === "string" ? profile.slug.trim() : ""
    if (!slug) {
      return { ok: false, reason: { code: "create_failed", error: "other" } }
    }
    const created = await createOnlineBooking(client, {
      businessSlug: slug,
      serviceId: svc.id,
      clientName,
      clientPhone: manualAppointmentFormPhoneE164(form),
      clientEmail: form.clientEmail.trim() || undefined,
      appointmentDate: form.date,
      appointmentTime: form.time,
      customerNote: form.note.trim() || undefined,
      staffId: resolution.staffId,
    })
    if (!created.ok || !created.id) {
      return {
        ok: false,
        reason: {
          code: "create_failed",
          error: created.error === "slot_taken" ? "slot_taken" : "other",
        },
      }
    }
    const patch: TablesUpdate<"bookings"> = {
      source: "manual",
      status: form.status,
      staff_id: resolution.staffId,
      staff_name: resolution.staffName,
      updated_at: new Date().toISOString(),
    }
    const patched = await updateBooking(client, bid, created.id, patch)
    if (!patched.ok) {
      return { ok: false, reason: { code: "create_failed", error: "other" } }
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

  return createLocalManual(staffIdLocal, staffNameLocal)
}
