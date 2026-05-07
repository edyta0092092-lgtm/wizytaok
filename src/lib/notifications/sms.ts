export type SendReminderSmsInput = {
  to: string
  body: string
}

export type SendReminderSmsResult =
  | { ok: true; provider: "twilio"; messageId?: string }
  | { ok: false; code: "not_configured" | "simulated_dev" | "failed"; error?: string }

/**
 * Wysyłka SMS (Twilio API przez fetch).
 * Wymaga TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (E.164).
 */
export async function sendReminderSms(input: SendReminderSmsInput): Promise<SendReminderSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  const from = process.env.TWILIO_FROM_NUMBER?.trim()
  if (!sid || !token || !from) {
    if (process.env.NODE_ENV === "development") {
      return {
        ok: false,
        code: "simulated_dev",
        error: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_FROM_NUMBER not set",
      }
    }
    return {
      ok: false,
      code: "not_configured",
      error: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_FROM_NUMBER not set",
    }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`
  const auth = Buffer.from(`${sid}:${token}`).toString("base64")
  const form = new URLSearchParams()
  form.set("To", input.to)
  form.set("From", from)
  form.set("Body", input.body)

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    })
    const text = await res.text()
    let sidOut: string | undefined
    try {
      const o = JSON.parse(text) as { sid?: string; message?: string }
      if (typeof o.sid === "string") sidOut = o.sid
      if (!res.ok) {
        return {
          ok: false,
          code: "failed",
          error: typeof o.message === "string" ? o.message : `HTTP ${res.status}`,
        }
      }
    } catch {
      if (!res.ok) {
        return { ok: false, code: "failed", error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
      }
    }
    return { ok: true, provider: "twilio", messageId: sidOut }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error"
    return { ok: false, code: "failed", error: msg }
  }
}
