/**
 * Helper do wysyłki SMS-owych przypomnień o wizycie przez SMSAPI.
 *
 * Etap 2 (MVP):
 *   • jeden globalny nadawca SMS — domyślnie "WizytaOK" (override env SMSAPI_FROM),
 *   • treść tylko transakcyjna (przypomnienie o wizycie), bez treści marketingowej,
 *   • bez powitania z imienia/nazwiska klienta (zasada zgodna z e-mail helper:
 *     `getClientFirstName` — nie używamy nazwiska, w SMS w ogóle pomijamy
 *     powitanie, żeby zmieścić się w bezpiecznej długości),
 *   • normalizacja numeru przez wspólny helper `normalizePhone` (E.164 → MSISDN),
 *   • błędy są zwracane wartościami `{ ok: false, code, error }`, nie rzucają
 *     wyjątkami — to ważne dla crona, żeby jeden zły SMS nie zatrzymał paczki.
 *
 * Wymagane env:
 *   - SMSAPI_TOKEN              — OAuth API token wygenerowany w panelu SMSAPI.
 * Opcjonalne env:
 *   - SMSAPI_FROM               — zarejestrowany nadawca; fallback: "WizytaOK".
 *   - SMS_MONTHLY_INCLUDED_LIMIT — czytany po stronie crona, nie tutaj.
 */

import { normalizePhone } from "@/lib/clients/normalize"
import { formatPolishAppointmentLabel } from "@/lib/notifications/appointment-reminder-email"

const SMSAPI_ENDPOINT = "https://api.smsapi.pl/sms.do"
const DEFAULT_FROM = "WizytaOK"

export type AppointmentReminderSmsInput = {
  /** Numer telefonu klienta — surowy lub znormalizowany. */
  to: string
  /** Nazwa firmy — fallback "WizytaOK" jeżeli pusta. */
  businessName: string
  /** appointment_date z bazy (YYYY-MM-DD). */
  appointmentDate: string
  /** appointment_time z bazy (HH:MM lub HH:MM:SS). */
  appointmentTime: string
  /**
   * Absolutny URL do strony zarządzania wizytą — zawsze wymagany dla SMS,
   * tak jak dla e‑maila. Cron NIE wysyła SMS bez `manageUrl`.
   */
  manageUrl: string
}

export type AppointmentReminderSmsResult =
  | { ok: true; provider: "smsapi"; messageId: string | null }
  | { ok: false; code: "not_configured" | "invalid_phone" | "failed"; error: string }

/**
 * Buduje treść SMS w formacie:
 *   "{Nazwa firmy}: przypominamy o wizycie {data} o {godzina}. Zarządzaj wizytą: {manageUrl}"
 *
 * Bez powitania imieniem — zasada SMS (zachowujemy spójność z notatką w
 * `getClientFirstName` w `appointment-reminder-email.ts`).
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

/**
 * Normalizacja numeru telefonu do formatu MSISDN (bez „+"), akceptowanego
 * przez SMSAPI. Wewnętrznie używa wspólnego helpera z `clients/normalize`,
 * żeby zachować spójność z resztą aplikacji.
 *
 * - "+48 600 700 800"   → "48600700800"
 * - "600700800"         → "48600700800"
 * - ""                  → null
 * - input bez sensownej liczby cyfr → null
 */
export function normalizePhoneForSmsapi(raw: string | null | undefined): string | null {
  const e164 = normalizePhone(raw)
  if (!e164) return null
  return e164.replace(/^\+/, "")
}

/**
 * Wysyłka transakcyjnego SMS-a przez SMSAPI REST. Nigdy nie rzuca — błędy
 * zwracane są jako `{ ok: false, code, error }`, żeby cron mógł oznaczyć
 * pojedynczy reminder jako failed/pending i kontynuować paczkę.
 */
export async function sendAppointmentReminderSms(
  input: AppointmentReminderSmsInput
): Promise<AppointmentReminderSmsResult> {
  const token = process.env.SMSAPI_TOKEN?.trim()
  if (!token) {
    return { ok: false, code: "not_configured", error: "SMSAPI_TOKEN not set" }
  }

  const to = normalizePhoneForSmsapi(input.to)
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

    // Błąd HTTP (poza 200) lub niepoprawne JSON-y traktujemy jako 'failed'
    // i pozwalamy cronowi zinterpretować jako technika (retry albo failed).
    if (!res.ok || !body || typeof body !== "object") {
      return {
        ok: false,
        code: "failed",
        error: `http_${res.status}`,
      }
    }

    const obj = body as Record<string, unknown>

    // SMSAPI sygnalizuje błędy polem `error` (numer) + `message` (tekst), nawet
    // przy HTTP 200. Patrz: https://www.smsapi.pl/docs (sekcja Errors).
    if ("error" in obj && obj.error !== null && obj.error !== undefined) {
      const errMsg =
        typeof obj.message === "string" && obj.message.length > 0
          ? obj.message
          : `smsapi_error_${String(obj.error)}`
      return { ok: false, code: "failed", error: errMsg }
    }

    const list = Array.isArray(obj.list) ? (obj.list as Array<Record<string, unknown>>) : []
    const first = list[0]
    const messageId =
      first && typeof first.id === "string" && first.id.length > 0 ? first.id : null

    return { ok: true, provider: "smsapi", messageId }
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : "unknown_error"
    return { ok: false, code: "failed", error: errMessage }
  }
}
