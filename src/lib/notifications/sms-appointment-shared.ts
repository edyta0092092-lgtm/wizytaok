import { normalizePhone } from "@/lib/clients/normalize"
import { formatPolishAppointmentLabel } from "@/lib/notifications/appointment-reminder-email"

/**
 * Treść SMS przypomnienia przed wizytą (link do anulowania na /confirm/{token}).
 */
export function buildSmsMessage(input: {
  serviceName?: string | null
  appointmentDate: string
  appointmentTime: string
  manageUrl: string
  language?: "pl" | "en"
}): string {
  const { dateLabel, timeLabel } = formatPolishAppointmentLabel(
    input.appointmentDate,
    input.appointmentTime,
  )
  const appointmentDateTime = `${dateLabel}, ${timeLabel}`
  const service = input.serviceName?.trim() || (input.language === "en" ? "appointment" : "wizyta")
  const confirmUrl = input.manageUrl.trim()

  if (input.language === "en") {
    return `Appointment reminder: ${service}, ${appointmentDateTime}. Manage or cancel your appointment: ${confirmUrl}`
  }

  return `Przypomnienie o wizycie: ${service}, ${appointmentDateTime}. Zarządzaj wizytą lub anuluj ją tutaj: ${confirmUrl}`
}

/** MSISDN bez „+” (SMSAPI). */
export function normalizePhoneToMsisdn(raw: string | null | undefined): string | null {
  const e164 = normalizePhone(raw)
  if (!e164) return null
  return e164.replace(/^\+/, "")
}

/** E.164 z prefiksem „+” (SzybkiSMS REST). */
export function normalizePhoneToE164(raw: string | null | undefined): string | null {
  return normalizePhone(raw)
}
