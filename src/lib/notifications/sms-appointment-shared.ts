import { normalizePhone } from "@/lib/clients/normalize"
import { formatPolishAppointmentLabel } from "@/lib/notifications/appointment-reminder-email"

/**
 * Treść przypomnienia — wspólna dla SMSAPI i SzybkiSMS.
 * "{Nazwa firmy}: przypominamy o wizycie {data} o {godzina}. Zarządzaj wizytą: {manageUrl}"
 */
export function buildSmsMessage(input: {
  businessName: string
  appointmentDate: string
  appointmentTime: string
  manageUrl: string
}): string {
  const { dateLabel, timeLabel } = formatPolishAppointmentLabel(
    input.appointmentDate,
    input.appointmentTime
  )
  const trimmedName = input.businessName?.trim()
  const business = trimmedName && trimmedName.length > 0 ? trimmedName : "WizytaOK"
  return `${business}: przypominamy o wizycie ${dateLabel} o ${timeLabel}. Zarządzaj wizytą: ${input.manageUrl}`
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
