import {
  buildSmsMessage,
  normalizePhoneToMsisdn,
} from "@/lib/notifications/sms-appointment-shared"
import type {
  AppointmentReminderSmsInput,
  AppointmentReminderSmsResult,
} from "@/lib/notifications/sms-reminder-types"

const SMSAPI_ENDPOINT = "https://api.smsapi.pl/sms.do"
const DEFAULT_FROM = "WizytaOK"

export async function sendSmsapiAppointmentReminder(
  input: AppointmentReminderSmsInput
): Promise<AppointmentReminderSmsResult> {
  const token = process.env.SMSAPI_TOKEN?.trim()
  if (!token) {
    return { ok: false, code: "not_configured", error: "SMSAPI_TOKEN not set" }
  }

  const to = normalizePhoneToMsisdn(input.to)
  if (!to) {
    return { ok: false, code: "invalid_phone", error: "phone_unparseable" }
  }

  const from = process.env.SMSAPI_FROM?.trim() || DEFAULT_FROM
  const message = buildSmsMessage(input)

  const params = new URLSearchParams()
  params.set("to", to)
  params.set("from", from)
  params.set("message", message)
  params.set("format", "json")
  params.set("encoding", "utf-8")

  try {
    const res = await fetch(SMSAPI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }

    if (!res.ok || !body || typeof body !== "object") {
      return {
        ok: false,
        code: "failed",
        error: `http_${res.status}`,
      }
    }

    const obj = body as Record<string, unknown>

    if ("error" in obj && obj.error !== null && obj.error !== undefined) {
      const errMsg =
        typeof obj.message === "string" && obj.message.length > 0
          ? obj.message
          : `smsapi_error_${String(obj.error)}`
      return { ok: false, code: "failed", error: errMsg }
    }

    const list = Array.isArray(obj.list) ? (obj.list as Array<Record<string, unknown>>) : []
    const first = list[0]
    const rawId = first?.id
    const messageId =
      typeof rawId === "string" && rawId.length > 0
        ? rawId
        : typeof rawId === "number"
          ? String(rawId)
          : null

    return { ok: true, provider: "smsapi", messageId }
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : "unknown_error"
    return { ok: false, code: "failed", error: errMessage }
  }
}
