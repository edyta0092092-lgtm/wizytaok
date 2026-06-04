export type CompleteBookingByCompanyResult =
  | {
      ok: true
      notice?: string
      alreadyCompleted?: boolean
      notificationSkipped?: boolean
    }
  | { ok: false; errorMessage: string }

export async function fetchCompleteBookingByCompany(
  bookingId: string,
  language: "pl" | "en",
  notifyClient = true,
): Promise<CompleteBookingByCompanyResult> {
  const res = await fetch("/api/bookings/complete-by-company", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ bookingId, language, notifyClient }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    notice?: string
    alreadyCompleted?: boolean
    notificationSkipped?: boolean
  }
  if (json.ok) {
    return {
      ok: true,
      notice: typeof json.notice === "string" ? json.notice : undefined,
      alreadyCompleted: json.alreadyCompleted === true,
      notificationSkipped: json.notificationSkipped === true,
    }
  }
  const msg =
    typeof json.error === "string" && json.error.trim().length > 0
      ? json.error.trim()
      : `HTTP ${res.status}`
  return { ok: false, errorMessage: msg }
}
