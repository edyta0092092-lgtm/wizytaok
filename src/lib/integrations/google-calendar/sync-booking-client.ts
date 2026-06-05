import type { GoogleCalendarSyncAction } from "@/lib/integrations/google-calendar/types"

/** Wywołanie synchronizacji z panelu (bez blokowania UI). */
export function requestGoogleCalendarBookingSync(
  bookingId: string,
  action: GoogleCalendarSyncAction,
): void {
  const uuid = bookingId.replace(/^sb-/, "").trim()
  if (!uuid) return
  void fetch("/api/integrations/google-calendar/sync-booking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId: uuid, action }),
    cache: "no-store",
  }).catch(() => {
    /* opcjonalna integracja */
  })
}
