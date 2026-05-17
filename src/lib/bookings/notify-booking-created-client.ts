import type { BookingCreatedChannelStatus } from "@/lib/notifications/booking-created-server"

export type BookingCreatedNotifyApiResult = {
  ok: boolean
  email: BookingCreatedChannelStatus
  sms: BookingCreatedChannelStatus
}

export async function notifyBookingCreatedViaApi(
  token: string,
  language: "pl" | "en",
): Promise<BookingCreatedNotifyApiResult> {
  const trimmed = token.trim()
  if (!trimmed) {
    return { ok: false, email: "missing", sms: "missing" }
  }
  try {
    const res = await fetch("/api/public/notify-booking-created", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: trimmed, language }),
    })
    const json = (await res.json().catch(() => ({}))) as BookingCreatedNotifyApiResult
    if (!res.ok) {
      return { ok: false, email: "failed", sms: "failed" }
    }
    return {
      ok: json.ok === true,
      email: json.email ?? "failed",
      sms: json.sms ?? "failed",
    }
  } catch {
    return { ok: false, email: "failed", sms: "failed" }
  }
}

export async function fetchBookingCreatedNotifyStatus(
  token: string,
): Promise<BookingCreatedNotifyApiResult | null> {
  const trimmed = token.trim()
  if (!trimmed) return null
  try {
    const res = await fetch(
      `/api/public/notify-booking-created?token=${encodeURIComponent(trimmed)}`,
      { cache: "no-store" },
    )
    if (!res.ok) return null
    const json = (await res.json()) as BookingCreatedNotifyApiResult
    return {
      ok: json.ok === true,
      email: json.email ?? "missing",
      sms: json.sms ?? "missing",
    }
  } catch {
    return null
  }
}
