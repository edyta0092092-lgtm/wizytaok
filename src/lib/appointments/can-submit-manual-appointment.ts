import type { ManualAppointmentFormState } from "@/components/appointments/manual-appointment-sheet"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import {
  buildStoredInternationalPhone,
  validateNationalPhoneLength,
} from "@/lib/validation/international-phone"

export function manualAppointmentFormPhoneE164(form: ManualAppointmentFormState): string {
  return buildStoredInternationalPhone(form.clientPhoneDialCode, form.clientPhoneNational).trim()
}

export function canSubmitManualAppointment(input: {
  form: ManualAppointmentFormState
  hasActiveTeamMembers: boolean
  manualStaffForServiceCount: number
}): boolean {
  const { form, hasActiveTeamMembers, manualStaffForServiceCount } = input
  const phone = manualAppointmentFormPhoneE164(form)
  if (!form.clientFirstName.trim() || !phone || !form.date || !form.time) {
    return false
  }
  if (!validateNationalPhoneLength(form.clientPhoneDialCode, form.clientPhoneNational).ok) {
    return false
  }
  if (!form.serviceId.trim()) return false
  if (!isSupabaseConfigured()) return true
  if (!hasActiveTeamMembers) return true
  if (manualStaffForServiceCount === 0) return false
  if (manualStaffForServiceCount === 1) return true
  return Boolean(form.manualStaffId.trim())
}
