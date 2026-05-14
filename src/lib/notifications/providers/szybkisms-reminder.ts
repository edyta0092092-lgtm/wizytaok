import {
  buildSmsMessage,
  normalizePhoneToE164,
} from "@/lib/notifications/sms-appointment-shared"
import type {
  AppointmentReminderSmsInput,
  AppointmentReminderSmsResult,
} from "@/lib/notifications/sms-reminder-types"

const DEFAULT_BASE = "https://api.szybkisms.pl/rest"
const DEFAULT_FROM = "WizytaOK"

const SZYBKISMS_ACCEPTED_STATUS = new Set([
  "QUEUED",
  "SENT",
  "ACCEPTED",
  "DELIVERED",
  "SCHEDULED",
])

function normalizeSzybkiSmsBaseUrl(): string {
  const raw = process.env.SZYBKISMS_API_BASE_URL?.trim()
  if (!raw) return DEFAULT_BASE
  return raw.replace(/\/$/, "")
}

function isAcceptedSzybkiStatus(code: unknown): boolean {
  if (typeof code !== "string" || code.length === 0) return false
  return SZYBKISMS_ACCEPTED_STATUS.has(code.toUpperCase())
}

/**
 * Wysyłka SMS przez REST SzybkiSMS (`POST /messages/sms`).
 * Dokumentacja: https://api.szybkisms.pl/rest/
 */
export async function sendSzybkiSmsAppointmentReminder(
  input: AppointmentReminderSmsInput
): Promise<AppointmentReminderSmsResult> {
  const token = process.env.SZYBKISMS_TOKEN?.trim()
  if (!token) {
    return { ok: false, code: "not_configured", error: "SZYBKISMS_TOKEN not set" }
  }

  const recipient = normalizePhoneToE164(input.to)
  if (!recipient) {
    return { ok: false, code: "invalid_phone", error: "phone_unparseable" }
  }

  const from = process.env.SZYBKISMS_FROM?.trim() || DEFAULT_FROM
  const message = buildSmsMessage(input)
  const base = normalizeSzybkiSmsBaseUrl()
  const url = `${base}/messages/sms`

  const payload = {
    recipients: recipient,
    message,
    sender: from,
    type: 1,
    unicode: true,
    flash: false,
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    })

    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }

    if (!res.ok) {
      const detail =
        body &&
        typeof body === "object" &&
        "detail" in body &&
        typeof (body as { detail?: unknown }).detail === "string"
          ? (body as { detail: string }).detail
          : `http_${res.status}`
      return { ok: false, code: "failed", error: detail }
    }

    if (!Array.isArray(body) || body.length === 0) {
      return { ok: false, code: "failed", error: "szybkisms_empty_response" }
    }

    const row = body[0] as Record<string, unknown>
    if (row.error && typeof row.error === "object") {
      const err = row.error as Record<string, unknown>
      const msg =
        typeof err.detail === "string" && err.detail.length > 0
          ? err.detail
          : typeof err.title === "string"
            ? err.title
            : "szybkisms_api_error"
      return { ok: false, code: "failed", error: msg }
    }

    const statusCode = row.status_code
    if (typeof statusCode === "string" && statusCode.length > 0) {
      if (!isAcceptedSzybkiStatus(statusCode)) {
        const desc =
          typeof row.status_description === "string" && row.status_description.length > 0
            ? row.status_description
            : statusCode
        return { ok: false, code: "failed", error: desc }
      }
    }

    const id = row.id
    const messageId =
      typeof id === "number"
        ? String(id)
        : typeof id === "string" && id.length > 0
          ? id
          : null

    return { ok: true, provider: "szybkisms", messageId }
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : "unknown_error"
    return { ok: false, code: "failed", error: errMessage }
  }
}
