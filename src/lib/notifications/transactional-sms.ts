import { sendSmsapiPlainText } from "@/lib/notifications/providers/smsapi-reminder"
import { sendSzybkiSmsPlainText } from "@/lib/notifications/providers/szybkisms-reminder"
import { getActiveSmsReminderProvider } from "@/lib/notifications/appointment-reminder-sms"
import type { AppointmentReminderSmsResult } from "@/lib/notifications/sms-reminder-types"

/** SMS transakcyjny (np. potwierdzenie rezerwacji) — ten sam dostawca co cron przypomnień. */
export async function sendPlainTransactionalSms(input: {
  to: string
  body: string
}): Promise<AppointmentReminderSmsResult> {
  return getActiveSmsReminderProvider() === "szybkisms"
    ? sendSzybkiSmsPlainText(input)
    : sendSmsapiPlainText(input)
}
