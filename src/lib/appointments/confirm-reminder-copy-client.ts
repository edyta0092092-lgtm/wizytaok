import type { PublicBooking } from "@/lib/bookings/public-bookings"

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

/** Po confirm: wynik „po” ma pierwszeństwo; przy błędzie API — snapshot sprzed confirm. */
export function mergeReminderPendingState(
  beforeConfirm: boolean | null,
  afterConfirm: boolean | null,
): boolean | null {
  if (afterConfirm === true) return true
  if (afterConfirm === false) return false
  if (beforeConfirm === true) return true
  if (beforeConfirm === false) return false
  return null
}

export type ConfirmedReminderCopyKey =
  | "confirmPublic.confirmedReminderInfoWithPending"
  | "confirmPublic.confirmedReminderInfoNoDate"

export function confirmedReminderCopyKey(pending: boolean | null): ConfirmedReminderCopyKey {
  return pending === true
    ? "confirmPublic.confirmedReminderInfoWithPending"
    : "confirmPublic.confirmedReminderInfoNoDate"
}
