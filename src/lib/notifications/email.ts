import { Resend } from "resend"

export type SendReminderEmailInput = {
  to: string
  subject: string
  textBody: string
  htmlBody?: string
}

export type SendReminderEmailResult =
  | { ok: true; provider: "resend"; messageId?: string }
  | { ok: false; code: "not_configured" | "simulated_dev" | "failed"; error?: string }

const DEFAULT_RESEND_FROM = "WizytaOK <no-reply@nordigital.pl>"

export function resolveResendFromAddress(): string {
  return (
    process.env.REMINDERS_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    DEFAULT_RESEND_FROM
  )
}

/**
 * Wysyłka e-mail (Resend SDK). Wymaga RESEND_API_KEY.
 * Nadawca: REMINDERS_FROM_EMAIL, RESEND_FROM lub domyślny adres.
 */
export async function sendReminderEmail(input: SendReminderEmailInput): Promise<SendReminderEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = resolveResendFromAddress()
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      return { ok: false, code: "simulated_dev", error: "RESEND_API_KEY not set" }
    }
    return { ok: false, code: "not_configured", error: "RESEND_API_KEY not set" }
  }

  const to = input.to.trim()
  if (!to) {
    return { ok: false, code: "failed", error: "recipient_required" }
  }

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from,
      to: [to],
      subject: input.subject,
      text: input.textBody,
      html: input.htmlBody ?? undefined,
    })
    if (result.error) {
      const message =
        result.error.message ||
        (typeof result.error === "object" && "name" in result.error
          ? String((result.error as { name?: string }).name)
          : "resend_error")
      return { ok: false, code: "failed", error: message }
    }
    return {
      ok: true,
      provider: "resend",
      messageId: result.data?.id ?? undefined,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error"
    return { ok: false, code: "failed", error: msg }
  }
}
