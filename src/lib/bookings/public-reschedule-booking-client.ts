export type ReschedulePublicBookingApiResult =
  | { ok: true }
  | { ok: false; error?: string }

export async function reschedulePublicBookingViaApi(
  token: string,
  newDate: string,
  newTime: string,
  language: "pl" | "en",
): Promise<ReschedulePublicBookingApiResult> {
  const trimmed = token.trim()
  if (!trimmed) return { ok: false, error: "token_required" }
  try {
    const res = await fetch("/api/public/reschedule-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: trimmed,
        date: newDate.trim().slice(0, 10),
        time: newTime.trim(),
        language,
      }),
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
