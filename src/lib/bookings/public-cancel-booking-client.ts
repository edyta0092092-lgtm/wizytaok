export type CancelPublicBookingApiResult =
  | { ok: true }
  | { ok: false; error?: string }

/** Anulowanie przez API (service role) — ustawia last_status_change_source=cancel. */
export async function cancelPublicBookingViaApi(
  token: string,
  language: "pl" | "en",
): Promise<CancelPublicBookingApiResult> {
  const trimmed = token.trim()
  if (!trimmed) return { ok: false, error: "token_required" }
  try {
    const res = await fetch("/api/public/cancel-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: trimmed, language }),
    })
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok || json.ok !== true) {
      return { ok: false, error: json.error ?? `http_${res.status}` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: "network_error" }
  }
}

/** @deprecated Użyj cancelPublicBookingViaApi (await). */
export function postPublicCancelBooking(token: string, language: "pl" | "en"): void {
  void cancelPublicBookingViaApi(token, language)
}
