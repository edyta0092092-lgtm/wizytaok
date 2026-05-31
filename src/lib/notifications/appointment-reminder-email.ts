import { Resend } from "resend"

import {
  buildTransactionalEmailHtml,
  buildTransactionalEmailText,
} from "@/lib/notifications/transactional-email-layout"

const DEFAULT_FROM = "WizytaOK <no-reply@nordigital.pl>"

const POLISH_MONTHS = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "wrzeĹ›nia",
  "paĹşdziernika",
  "listopada",
  "grudnia",
] as const

/**
 * Format daty i godziny w Europe/Warsaw bez konwersji do strefy serwera.
 * WejĹ›cie: `appointment_date` (YYYY-MM-DD) + `appointment_time` (HH:MM:SS).
 */
export function formatPolishAppointmentLabel(
  appointmentDate: string,
  appointmentTime: string
): { dateLabel: string; timeLabel: string; longLabel: string } {
  const dateMatch = String(appointmentDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  const timeMatch = String(appointmentTime).trim().match(/^(\d{1,2}):(\d{2})/)
  const year = dateMatch ? Number(dateMatch[1]) : NaN
  const month = dateMatch ? Number(dateMatch[2]) : NaN
  const day = dateMatch ? Number(dateMatch[3]) : NaN
  const hour = timeMatch ? Number(timeMatch[1]) : 0
  const minute = timeMatch ? Number(timeMatch[2]) : 0

  const dateLabel =
    Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) && month >= 1 && month <= 12
      ? `${day} ${POLISH_MONTHS[month - 1]} ${year}`
      : appointmentDate
  const timeLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  const longLabel = `${dateLabel}, ${timeLabel}`
  return { dateLabel, timeLabel, longLabel }
}

const WARSAW_TZ = "Europe/Warsaw"
const FIRST_REMINDER_SEND_GRACE_MS = 30 * 60 * 1000

const warsawLocalFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: WARSAW_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

function readWarsawLocalParts(ms: number): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
} {
  const parts = warsawLocalFormatter.formatToParts(new Date(ms))
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN)
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") % 24,
    minute: read("minute"),
  }
}

/** Unix ms momentu wizyty w Europe/Warsaw (zgodnie z triggerami DB). */
export function parseWarsawAppointmentMs(
  appointmentDate: string,
  appointmentTime: string,
): number | null {
  const dateMatch = String(appointmentDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  const timeMatch = String(appointmentTime).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!dateMatch || !timeMatch) return null
  const target = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  }
  if (
    !Number.isFinite(target.year) ||
    !Number.isFinite(target.month) ||
    !Number.isFinite(target.day) ||
    !Number.isFinite(target.hour) ||
    !Number.isFinite(target.minute)
  ) {
    return null
  }

  const compare = (ms: number): number => {
    const p = readWarsawLocalParts(ms)
    return (
      p.year - target.year ||
      p.month - target.month ||
      p.day - target.day ||
      p.hour - target.hour ||
      p.minute - target.minute
    )
  }

  let low = Date.UTC(target.year, target.month - 1, target.day - 1, 0, 0, 0)
  let high = Date.UTC(target.year, target.month - 1, target.day + 1, 23, 59, 59)
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const cmp = compare(mid)
    if (cmp === 0) return mid
    if (cmp < 0) low = mid + 60_000
    else high = mid - 60_000
  }
  return null
}

/** Pierwsze przypomnienie (24h) — pomijamy, gdy okno wysyłki już minęło (wizyta zarezerwowana <24h wcześniej). */
export function isFirstReminderWindowPassed(
  reminderKind: string,
  scheduledForIso: string,
  appointmentDate: string,
  appointmentTime: string,
  nowMs: number = Date.now(),
): boolean {
  if (reminderKind.trim().toLowerCase() !== "first") return false
  const appointmentMs = parseWarsawAppointmentMs(appointmentDate, appointmentTime)
  if (appointmentMs == null) return false
  const scheduledMs = new Date(scheduledForIso).getTime()
  if (!Number.isFinite(scheduledMs)) return false
  const leadMs = appointmentMs - scheduledMs
  if (leadMs <= 0) return true
  const timeUntilMs = appointmentMs - nowMs
  return timeUntilMs < leadMs - FIRST_REMINDER_SEND_GRACE_MS
}

/**
 * WyciÄ…ga TYLKO pierwsze imiÄ™ klienta â€” do uĹĽycia w powitaniach maila / SMS.
 *
 * Zasada projektowa (etap 1 e-mail i przyszĹ‚y etap 2 SMS):
 *   - W powitaniach NIE uĹĽywamy nazwiska klienta (UX / RODO),
 *     tylko pierwsze imiÄ™ (a jeĹ›li nie da siÄ™ ustaliÄ‡ â€” bezosobowe â€žDzieĹ„ dobry,").
 *   - "Anna Kowalska"        â†’ "Anna"
 *   - " Anna Kowalska "      â†’ "Anna"
 *   - "Anna Maria Kowalska"  â†’ "Anna"
 *   - "Kowalski"             â†’ "Kowalski"   (jednoczĹ‚onowy zostaje, bo nie wiemy czy to imiÄ™)
 *   - ""                     â†’ null
 *   - null / undefined       â†’ null
 *
 * UWAGA dla przyszĹ‚ej integracji SMS / SMSAPI:
 *   W treĹ›ci SMS-a uĹĽywaj WYĹÄ„CZNIE wartoĹ›ci zwrĂłconej przez `getClientFirstName(...)`.
 *   JeĹ›li zwrĂłci `null` â€” pomiĹ„ powitanie zupeĹ‚nie, NIE wstawiaj nazwiska.
 */
export function getClientFirstName(
  fullName: string | null | undefined
): string | null {
  if (typeof fullName !== "string") return null
  const trimmed = fullName.trim()
  if (trimmed.length === 0) return null
  const first = trimmed.split(/\s+/)[0]
  return first && first.length > 0 ? first : null
}

export type AppointmentReminderEmailInput = {
  to: string
  businessName: string
  /** Adres firmy — widoczny w treści przypomnienia. */
  businessAddress?: string | null
  appointmentDate: string
  appointmentTime: string
  serviceName: string | null
  staffName: string | null
  clientName: string | null
  /**
   * Absolutny URL do istniejÄ…cej strony zarzÄ…dzania wizytÄ… (token-based),
   * np. `https://wizytaok.example/confirm/{confirmation_token}?source=reminder`.
   * JeĹĽeli null/pusty, sekcja z przyciskiem nie jest renderowana.
   * NIE jest to link do bezpoĹ›redniego anulowania â€” klient anuluje wizytÄ™ na stronie zarzÄ…dzania.
   */
  manageUrl?: string | null
  /** Adres kontaktowy firmy â€” uĹĽywany jako reply_to, jeĹ›li podany. */
  replyTo?: string | null
}

export type AppointmentReminderEmailResult =
  | { ok: true; provider: "resend"; messageId: string | null }
  | { ok: false; code: "not_configured" | "failed"; error: string }

/**
 * WysyĹ‚ka e-mail z przypomnieniem o wizycie przez Resend SDK.
 * Wymagane envy: `RESEND_API_KEY`. Nadawca: `REMINDERS_FROM_EMAIL` (fallback `RESEND_FROM`,
 * a w ostatecznoĹ›ci default `WizytaOK <no-reply@nordigital.pl>`).
 */
export async function sendAppointmentReminderEmail(
  input: AppointmentReminderEmailInput
): Promise<AppointmentReminderEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, code: "not_configured", error: "RESEND_API_KEY not set" }
  }

  const from =
    process.env.REMINDERS_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    DEFAULT_FROM

  const { dateLabel, timeLabel, longLabel } = formatPolishAppointmentLabel(
    input.appointmentDate,
    input.appointmentTime
  )

  const businessNameRaw = input.businessName?.trim()
  const businessName = businessNameRaw && businessNameRaw.length > 0 ? businessNameRaw : "WizytaOK"
  const subject = "Przypomnienie o wizycie"
  const trimmedService = input.serviceName?.trim() || "wizyta"
  const appointmentDateTime = `${dateLabel}, ${timeLabel}`
  const trimmedManageUrl = input.manageUrl?.trim() || ""
  const hasManageLink = trimmedManageUrl.length > 0

  const detailRows: Array<{ label: string; value: string }> = [
    { label: "Usługa", value: trimmedService },
    { label: "Termin", value: appointmentDateTime },
  ]
  const trimmedAddress = input.businessAddress?.trim()
  if (trimmedAddress && trimmedAddress.length > 0) {
    detailRows.push({ label: "Adres", value: trimmedAddress })
  }
  const trimmedStaff = input.staffName?.trim()
  if (trimmedStaff && trimmedStaff.length > 0) {
    detailRows.push({ label: "Osoba", value: trimmedStaff })
  }

  const intro = "Przypominamy o Twojej wizycie."
  const preheader = `Przypominamy o wizycie â€” ${longLabel}.`
  const cta = hasManageLink
    ? {
        href: trimmedManageUrl,
        label: "Zarządzaj wizytą",
        hint: "Pod tym linkiem możesz sprawdzić szczegóły wizyty lub anulować wizytę, jeśli nie możesz przyjść.",
      }
    : null

  const text = buildTransactionalEmailText({
    lang: "pl",
    intro,
    detailRows,
    cta,
  })

  const html = buildTransactionalEmailHtml({
    lang: "pl",
    subject,
    preheader,
    title: "Przypomnienie o wizycie",
    intro,
    detailRows,
    cta,
    extraParagraph:
      "Jeśli masz pytania lub chcesz zmienić termin, skontaktuj się bezpośrednio z firmą.",
  })


  const replyTo = input.replyTo?.trim() || undefined

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from,
      to: [input.to],
      subject,
      text,
      html,
      replyTo,
    })
    if (result.error) {
      return {
        ok: false,
        code: "failed",
        error: result.error.message || "resend_error",
      }
    }
    return {
      ok: true,
      provider: "resend",
      messageId: result.data?.id ?? null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error"
    return { ok: false, code: "failed", error: message }
  }
}
