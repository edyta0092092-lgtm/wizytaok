export type SendReminderEmailInput = {
  to: string
  subject: string
  textBody: string
  htmlBody?: string
}

export type SendReminderEmailResult =
  | { ok: true; provider: "resend"; messageId?: string }
  | { ok: false; code: "not_configured" | "simulated_dev" | "failed"; error?: string }

/**
 * Wysyłka e-mail przypomnienia (Resend REST API przez fetch, bez dodatkowej paczki).
 * Wymaga RESEND_API_KEY i RESEND_FROM (adres nadawcy zweryfikowany w Resend).
 */
export async function sendReminderEmail(input: SendReminderEmailInput): Promise<SendReminderEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM?.trim()
  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "development") {
      return { ok: false, code: "simulated_dev", error: "RESEND_API_KEY or RESEND_FROM not set" }
    }
    return { ok: false, code: "not_configured", error: "RESEND_API_KEY or RESEND_FROM not set" }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.textBody,
        html: input.htmlBody ?? undefined,
      }),
    })
    const json = (await res.json().catch(() => null)) as { id?: string; message?: string } | null
    if (!res.ok) {
      return {
        ok: false,
        code: "failed",
        error: json && typeof json.message === "string" ? json.message : `HTTP ${res.status}`,
      }
    }
    return { ok: true, provider: "resend", messageId: typeof json?.id === "string" ? json.id : undefined }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error"
    return { ok: false, code: "failed", error: msg }
  }
}
