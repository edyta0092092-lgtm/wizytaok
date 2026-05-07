export type CancelBookingByCompanyResult =
  | {
      ok: true
      notice?: string
      alreadyCancelled?: boolean
      notificationSkipped?: boolean
    }
  | { ok: false; errorMessage: string }

export async function fetchCancelBookingByCompany(
  bookingId: string,
  language: "pl" | "en",
  notifyClient: boolean
): Promise<CancelBookingByCompanyResult> {
  const res = await fetch("/api/bookings/cancel-by-company", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, language, notifyClient }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    notice?: string
    alreadyCancelled?: boolean
    notificationSkipped?: boolean
  }
  if (json.ok) {
    return {
      ok: true,
      notice: typeof json.notice === "string" ? json.notice : undefined,
      alreadyCancelled: json.alreadyCancelled === true,
      notificationSkipped: json.notificationSkipped === true,
    }
  }
  const msg =
    typeof json.error === "string" && json.error.trim().length > 0
      ? json.error.trim()
      : `HTTP ${res.status}`
  return { ok: false, errorMessage: msg }
}
