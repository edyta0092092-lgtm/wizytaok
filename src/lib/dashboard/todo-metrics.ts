import { normalizePublicSlug } from "@/lib/business/slug"
import type { Appointment, NotificationMessage } from "@/types/domain"

export function countUnconfirmedAppointments(rows: Appointment[]): number {
  return rows.filter((a) => a.status === "booked" || a.status === "pending").length
}

/** Wizyty oczekujące na potwierdzenie klienta (status pending). */
export function countPendingConfirmationAppointments(rows: Appointment[]): number {
  return rows.filter((a) => a.status === "pending").length
}

function isReminderAttentionStatus(status: string | null | undefined): boolean {
  return status === "failed" || status === "skipped" || status === "not_configured"
}

/** Problemy z automatycznym przypomnieniem 24h (wymaga kontaktu lub konfiguracji). */
export function countAppointmentReminderIssues(rows: Appointment[]): number {
  return rows.filter((a) => isReminderAttentionStatus(a.reminderStatus)).length
}

export function resolveBusinessSlugNorm(
  profileSlug: string | null,
  appointments: Appointment[],
): string | null {
  if (profileSlug) return profileSlug
  const raw = appointments.find((a) => typeof a.businessSlug === "string" && a.businessSlug.trim())?.businessSlug
  if (!raw) return null
  return normalizePublicSlug(raw)
}

/** Symulacja MVP: wiadomości `failed` i `scheduled` wymagają uwagi. */
export function countMessagesNeedingReview(
  messages: NotificationMessage[],
  businessSlugNorm: string | null,
  scopeAll: boolean,
): number {
  const scoped = scopeAll
    ? messages
    : businessSlugNorm
      ? messages.filter((m) => normalizePublicSlug(m.businessSlug) === businessSlugNorm)
      : []
  return scoped.filter((m) => m.status === "failed" || m.status === "scheduled").length
}
