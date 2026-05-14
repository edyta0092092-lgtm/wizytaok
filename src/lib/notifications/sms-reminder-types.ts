export type SmsReminderProviderId = "smsapi" | "szybkisms"

export type AppointmentReminderSmsInput = {
  to: string
  businessName: string
  appointmentDate: string
  appointmentTime: string
  manageUrl: string
}

export type AppointmentReminderSmsResult =
  | { ok: true; provider: SmsReminderProviderId; messageId: string | null }
  | { ok: false; code: "not_configured" | "invalid_phone" | "failed"; error: string }
