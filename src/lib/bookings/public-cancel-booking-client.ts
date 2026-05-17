/** Anulowanie przez API (service role) — ustawia last_status_change_source=cancel. */
export async function cancelPublicBookingViaApi(
  token: string,
  language: "pl" | "en",
): Promise<boolean> {
  const trimmed = token.trim()
  if (!trimmed) return false
  try {
    const res = await fetch("/api/public/cancel-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: trimmed, language }),
    })
    if (!res.ok) return false
    const json = (await res.json()) as { ok?: boolean }
    return json.ok === true
  } catch {
    return false
  }
}

/** @deprecated Użyj cancelPublicBookingViaApi (await). */
export function postPublicCancelBooking(token: string, language: "pl" | "en"): void {
  void cancelPublicBookingViaApi(token, language)
}
