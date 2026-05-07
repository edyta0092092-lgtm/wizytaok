import type { ManualAppointmentFormState } from "@/components/appointments/manual-appointment-sheet"
import { isSupabaseConfigured } from "@/lib/supabase/client"

export function canSubmitManualAppointment(input: {
  form: ManualAppointmentFormState
  hasActiveTeamMembers: boolean
  manualStaffForServiceCount: number
}): boolean {
  const { form, hasActiveTeamMembers, manualStaffForServiceCount } = input
  if (!form.clientName.trim() || !form.clientPhone.trim() || !form.date || !form.time) {
    return false
  }
  if (!form.serviceId.trim()) return false
  if (!isSupabaseConfigured()) return true
  if (!hasActiveTeamMembers) return true
  if (manualStaffForServiceCount === 0) return false
  if (manualStaffForServiceCount === 1) return true
  return Boolean(form.manualStaffId.trim())
}
