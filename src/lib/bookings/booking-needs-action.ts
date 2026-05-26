import { dictionaries, type Language } from "@/lib/i18n/dictionaries"
import type { Appointment, AppointmentStatus } from "@/types/domain"

const SIX_HOURS_MS = 6 * 60 * 60 * 1000

const TERMINAL: AppointmentStatus[] = ["confirmed", "cancelled", "no_show", "completed"]
const POST_VISIT_ACTION_STATUSES: AppointmentStatus[] = ["booked", "pending", "confirmed"]

function dictString(lang: Language, path: string): string {
  const parts = path.split(".")
  let cur: unknown = dictionaries[lang]
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return path
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === "string" ? cur : path
}

function missingContactActive(a: Appointment): boolean {
  if (a.status !== "booked" && a.status !== "pending") return false
  const phone = (a.phone ?? "").trim()
  const email = (a.email ?? "").trim()
  return phone.length === 0 && email.length === 0
}

function pendingNoResponseSoon(a: Appointment, at: Date): boolean {
  if (a.status !== "pending") return false
  const sent = a.reminderSentAt
  if (sent == null || String(sent).trim() === "") return false
  const startMs = new Date(a.startsAt).getTime()
  const msUntil = startMs - at.getTime()
  return msUntil > 0 && msUntil <= SIX_HOURS_MS
}

function reminderIsAttention(rs: string | null | undefined): boolean {
  const s = (rs ?? "").trim()
  return s === "failed" || s === "skipped" || s === "not_configured"
}

export function bookingRequiresPostVisitStatus(a: Appointment, at: Date = new Date()): boolean {
  if (!POST_VISIT_ACTION_STATUSES.includes(a.status)) return false
  const startMs = new Date(a.startsAt).getTime()
  if (!Number.isFinite(startMs)) return false
  return startMs < at.getTime()
}

/**
 * Wizyta wymaga reakcji firmy (decyzja, kontakt lub sprawdzenie przypomnienia).
 * Nie obejmuje wyłącznie statusu pending z poprawnym przypomnieniem i danymi kontaktowymi.
 */
export function bookingNeedsAction(a: Appointment, at: Date = new Date()): boolean {
  if (bookingRequiresPostVisitStatus(a, at)) return true
  if (TERMINAL.includes(a.status)) return false
  if (reminderIsAttention(a.reminderStatus) || reminderIsAttention(a.secondReminderStatus)) return true
  if (missingContactActive(a)) return true
  if (pendingNoResponseSoon(a, at)) return true
  return false
}

export function countBookingsNeedingAction(rows: Appointment[], at: Date = new Date()): number {
  let n = 0
  for (const a of rows) {
    if (bookingNeedsAction(a, at)) n += 1
  }
  return n
}

export type BookingNeedsActionReasonKey =
  | "postVisitStatusRequired"
  | "reminderFailed"
  | "reminderSkipped"
  | "reminderNotConfigured"
  | "missingContact"
  | "pendingNoResponseSoon"
  | "other"

export function getBookingNeedsActionReasonKey(
  a: Appointment,
  at: Date = new Date()
): BookingNeedsActionReasonKey | null {
  if (!bookingNeedsAction(a, at)) return null
  if (bookingRequiresPostVisitStatus(a, at)) return "postVisitStatusRequired"
  const first = (a.reminderStatus ?? "").trim()
  const second = (a.secondReminderStatus ?? "").trim()
  const rs = second === "failed" ? second : first
  if (rs === "failed") return "reminderFailed"
  if (rs === "skipped") return "reminderSkipped"
  if (rs === "not_configured") return "reminderNotConfigured"
  if (missingContactActive(a)) return "missingContact"
  if (pendingNoResponseSoon(a, at)) return "pendingNoResponseSoon"
  return "other"
}

/** Krótki opis powodu (PL/EN) z jednego źródła słownikowego. */
export function getBookingActionReason(a: Appointment, locale: Language, at: Date = new Date()): string {
  const key = getBookingNeedsActionReasonKey(a, at)
  if (!key) return dictString(locale, "dashboard.needsActionNoAction")
  return dictString(locale, `dashboard.needsActionReason.${key}`)
}
