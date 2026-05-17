import type { PublicBooking } from "@/lib/bookings/public-bookings"

/** Fallback offline: dowolne pole statusu z pending/processing (nie tylko drugie przypomnienie). */
export function hasPendingReminderFromPublicBooking(booking: PublicBooking): boolean | null {
  const tokens = [
    booking.firstReminderStatus,
    booking.secondReminderStatus,
    booking.reminderStatus,
  ]
    .map((s) => String(s ?? "").trim().toLowerCase())
    .filter(Boolean)
  if (tokens.length === 0) return null
  return tokens.some((s) => s === "pending" || s === "processing")
}

export async function fetchPendingReminderFromQueue(token: string): Promise<boolean | null> {
  const trimmed = token.trim()
  if (!trimmed) return null
  try {
    const res = await fetch(
      `/api/public/appointment-reminder-status?token=${encodeURIComponent(trimmed)}`,
      { cache: "no-store" },
    )
    if (!res.ok) return null
    const json = (await res.json()) as { ok?: boolean; hasPendingReminder?: boolean }
    if (json.ok !== true || typeof json.hasPendingReminder !== "boolean") return null
    return json.hasPendingReminder
  } catch {
    return null
  }
}

/**
 * true = pokaż copy „Przypomnimy jeszcze…” — gdy przed lub po confirm
 * w kolejce był jakikolwiek pending/processing (w tym przed pierwszym wysłaniem).
 */
export function mergeReminderPendingState(
  beforeConfirm: boolean | null,
  afterConfirm: boolean | null,
): boolean | null {
  if (beforeConfirm === true || afterConfirm === true) return true
  if (beforeConfirm === false && afterConfirm === false) return false
  return null
}

/** Odczyt kolejki przed i po confirm (ten sam warunek: dowolny pending/processing). */
export async function resolveConfirmationReminderPending(
  reminderToken: string,
  runConfirm: () => Promise<void>,
): Promise<boolean | null> {
  const token = reminderToken.trim()
  if (!token) return null

  const beforeConfirm = await fetchPendingReminderFromQueue(token)
  await runConfirm()

  let afterConfirm = await fetchPendingReminderFromQueue(token)
  if (afterConfirm === null) {
    await new Promise((resolve) => window.setTimeout(resolve, 400))
    afterConfirm = await fetchPendingReminderFromQueue(token)
  }

  return mergeReminderPendingState(beforeConfirm, afterConfirm)
}

export type ConfirmedReminderCopyKey =
  | "confirmPublic.confirmedReminderInfoWithPending"
  | "confirmPublic.confirmedReminderInfoNoDate"

export function confirmedReminderCopyKey(pending: boolean | null): ConfirmedReminderCopyKey {
  return pending === true
    ? "confirmPublic.confirmedReminderInfoWithPending"
    : "confirmPublic.confirmedReminderInfoNoDate"
}
