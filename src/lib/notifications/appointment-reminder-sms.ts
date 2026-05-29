/**
 * Fasada wysyłki SMS-owych przypomnień o wizycie — wybór dostawcy przez `SMS_PROVIDER`.
 *
 * Dostawcy:
 *   - `smsapi` (domyślnie, gdy `SMS_PROVIDER` nie ustawione lub inna wartość)
 *   - `szybkisms` — `SMS_PROVIDER=szybkisms`
 *
 * Wspólne:
 *   - treść z `buildSmsMessage` (identyczna dla obu),
 *   - normalizacja numeru (adaptery: MSISDN vs E.164),
 *   - brak rzutowania wyjątków — wynik `{ ok, code?, error? }` dla crona.
 *
 * Envy SMSAPI:
 *   - SMSAPI_TOKEN, SMSAPI_FROM (opcjonalnie; fallback „WizytaOK” w adapterze).
 *
 * Envy SzybkiSMS:
 *   - SZYBKISMS_TOKEN, SZYBKISMS_FROM (opcjonalnie; fallback „WizytaOK” w adapterze),
 *   - SZYBKISMS_API_BASE_URL (opcjonalnie; domyślnie https://api.szybkisms.pl/rest).
 *
 * Limit miesięczny / feature flagi — w `send-reminders` (cron), nie tutaj.
 */

import {
  sendSmsapiAppointmentReminder,
  sendSmsapiPlainText,
} from "@/lib/notifications/providers/smsapi-reminder"
import {
  sendSzybkiSmsAppointmentReminder,
  sendSzybkiSmsPlainText,
} from "@/lib/notifications/providers/szybkisms-reminder"
import {
  buildSmsMessage,
  normalizePhoneToMsisdn,
} from "@/lib/notifications/sms-appointment-shared"
import type {
  AppointmentReminderSmsInput,
  AppointmentReminderSmsResult,
  SmsReminderProviderId,
} from "@/lib/notifications/sms-reminder-types"

export type {
  AppointmentReminderSmsInput,
  AppointmentReminderSmsResult,
  SmsReminderProviderId,
} from "@/lib/notifications/sms-reminder-types"

export { buildSmsMessage } from "@/lib/notifications/sms-appointment-shared"

/** Zachowana nazwa — MSISDN bez „+” (SMSAPI). */
export function normalizePhoneForSmsapi(raw: string | null | undefined): string | null {
  return normalizePhoneToMsisdn(raw)
}

/** Aktywny dostawca do limitu / metadanych w cronie (bez wysyłki). */
export function getActiveSmsReminderProvider(): SmsReminderProviderId {
  const p = process.env.SMS_PROVIDER?.trim().toLowerCase()
  return p === "szybkisms" ? "szybkisms" : "smsapi"
}

export async function sendAppointmentReminderSms(
  input: AppointmentReminderSmsInput
): Promise<AppointmentReminderSmsResult> {
  return getActiveSmsReminderProvider() === "szybkisms"
    ? sendSzybkiSmsAppointmentReminder(input)
    : sendSmsapiAppointmentReminder(input)
}

/**
 * Wysyłka SMS o dowolnej (już zbudowanej) treści — używana, gdy treść pochodzi
 * z edytowalnego szablonu firmy. Wybór dostawcy jak w `sendAppointmentReminderSms`.
 */
export async function sendAppointmentReminderSmsPlainText(input: {
  to: string
  body: string
}): Promise<AppointmentReminderSmsResult> {
  return getActiveSmsReminderProvider() === "szybkisms"
    ? sendSzybkiSmsPlainText(input)
    : sendSmsapiPlainText(input)
}
