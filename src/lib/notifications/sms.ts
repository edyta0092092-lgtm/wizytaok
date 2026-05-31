import { getActiveSmsReminderProvider } from "@/lib/notifications/appointment-reminder-sms"
import { sendPlainTransactionalSms } from "@/lib/notifications/transactional-sms"
import type { AppointmentReminderSmsResult } from "@/lib/notifications/sms-reminder-types"

export type SendReminderSmsInput = {
  to: string
  body: string
}

export type SendReminderSmsResult =
  | { ok: true; provider: string; messageId?: string | null }
  | { ok: false; code: "not_configured" | "simulated_dev" | "invalid_phone" | "failed"; error?: string }

/**
 * Wysyłka SMS — ten sam dostawca co przypomnienia i potwierdzenia wizyty (SMSAPI / SzybkiSMS).
 * Zachowana nazwa dla starszych wywołań (wcześniej Twilio).
 */
export async function sendReminderSms(input: SendReminderSmsInput): Promise<SendReminderSmsResult> {
  const result: AppointmentReminderSmsResult = await sendPlainTransactionalSms(input)
  if (result.ok) {
    return {
      ok: true,
      provider: result.provider ?? getActiveSmsReminderProvider(),
      messageId: result.messageId,
    }
  }
  const code = result.code ?? "failed"
  if (code === "not_configured" && process.env.NODE_ENV === "development") {
    return { ok: false, code: "simulated_dev", error: result.error }
  }
  return { ok: false, code, error: result.error }
}
