export type SmsReminderProviderId = "smsapi" | "szybkisms"

export type AppointmentReminderSmsInput = {
  to: string
  businessName: string
  serviceName?: string | null
  appointmentDate: string
  appointmentTime: string
  manageUrl: string
  language?: "pl" | "en"
}

export type AppointmentReminderSmsResult =
  | { ok: true; provider: SmsReminderProviderId; messageId: string | null }
  | { ok: false; code: "not_configured" | "invalid_phone" | "failed"; error: string }
