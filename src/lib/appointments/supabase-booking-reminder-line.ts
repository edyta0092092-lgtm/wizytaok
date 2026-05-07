import type { Appointment } from "@/types/domain"

export type SupabaseBookingReminderLineLabels = {
  sent: string
  failed: string
  skipped: string
  notConfigured: string
  scheduled: string
}

export function supabaseBookingReminderLine(
  a: Appointment,
  labels: SupabaseBookingReminderLineLabels,
): string | null {
  if (!a.id.startsWith("sb-")) return null
  const rs = a.reminderStatus
  if (rs === "sent") return labels.sent
  if (rs === "failed") return labels.failed
  if (rs === "skipped") return labels.skipped
  if (rs === "not_configured" || rs === "simulated_dev") return labels.notConfigured
  return labels.scheduled
}
