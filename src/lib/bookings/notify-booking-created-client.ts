import type {
  BookingCreatedChannelDetail,
  BookingCreatedChannelStatus,
  BookingCreatedNotifyResult,
} from "@/lib/notifications/booking-created-server"

export type BookingCreatedNotifyApiResult = BookingCreatedNotifyResult

function isChannelStatus(value: unknown): value is BookingCreatedChannelStatus {
  return (
    value === "sent" ||
    value === "failed" ||
    value === "skipped" ||
    value === "missing" ||
    value === "already_sent"
  )
}

function parseChannelDetail(raw: unknown, fallback: BookingCreatedChannelStatus): BookingCreatedChannelDetail {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    const status = isChannelStatus(o.status) ? o.status : fallback
    return {
      status,
      error_message:
        typeof o.error_message === "string"
          ? o.error_message
          : typeof o.error === "string"
            ? o.error
            : null,
      code: typeof o.code === "string" ? o.code : null,
      provider: typeof o.provider === "string" ? o.provider : null,
    }
  }
  if (isChannelStatus(raw)) {
    return { status: raw }
  }
  return { status: fallback }
}

function parseNotifyResponse(json: Record<string, unknown>): BookingCreatedNotifyApiResult {
  const emailDetail = parseChannelDetail(
    json.email_detail ?? json.email,
    isChannelStatus(json.email) ? json.email : "failed",
  )
  const smsDetail = parseChannelDetail(
    json.sms_detail ?? json.sms,
    isChannelStatus(json.sms) ? json.sms : "failed",
  )

  if (typeof json.email_error_message === "string" && json.email_error_message.length > 0) {
    emailDetail.error_message = json.email_error_message
  }
  if (typeof json.sms_error_message === "string" && json.sms_error_message.length > 0) {
    smsDetail.error_message = json.sms_error_message
  }
  if (typeof json.sms_code === "string" && json.sms_code.length > 0) {
    smsDetail.code = json.sms_code
  }
  if (typeof json.sms_provider === "string" && json.sms_provider.length > 0) {
    smsDetail.provider = json.sms_provider
  }

  return {
    ok: json.ok === true,
    email: emailDetail,
    sms: smsDetail,
  }
}

function channelResolved(detail: BookingCreatedChannelDetail): boolean {
  return (
    detail.status === "sent" ||
    detail.status === "already_sent" ||
    detail.status === "skipped" ||
    detail.status === "missing"
  )
}

export function isBookingCreatedNotifyComplete(result: BookingCreatedNotifyApiResult): boolean {
  return channelResolved(result.email) && channelResolved(result.sms)
}

function channelInProgress(detail: BookingCreatedChannelDetail): boolean {
  return detail.status === "failed" && detail.error_message === "send_in_progress"
}

/** Natychmiastowe potwierdzenie po rezerwacji — POST na route handler (pewna wysyłka po stronie serwera). */
export async function notifyBookingCreatedViaApi(
  token: string,
  language: "pl" | "en",
): Promise<BookingCreatedNotifyApiResult> {
  const trimmed = token.trim()
  if (!trimmed) {
    return {
      ok: false,
      email: { status: "missing" },
      sms: { status: "missing" },
    }
  }
  try {
    const res = await fetch("/api/public/notify-booking-created", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: trimmed, language }),
      cache: "no-store",
    })
    const json = (await res.json()) as Record<string, unknown>
    return parseNotifyResponse(json)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "notify_request_failed"
    return {
      ok: false,
      email: { status: "failed", error_message: msg },
      sms: { status: "failed", error_message: msg },
    }
  }
}

export function isBookingCreatedNotifyInProgress(result: BookingCreatedNotifyApiResult): boolean {
  return channelInProgress(result.email) || channelInProgress(result.sms)
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
    const json = (await res.json()) as Record<string, unknown>
    return parseNotifyResponse(json)
  } catch {
    return null
  }
}

/** Idempotentny fallback: wyślij tylko gdy brak sent w logach (np. po success page). */
export async function ensureBookingCreatedNotifications(
  token: string,
  language: "pl" | "en",
): Promise<BookingCreatedNotifyApiResult> {
  const trimmed = token.trim()
  if (!trimmed) {
    return {
      ok: false,
      email: { status: "missing" },
      sms: { status: "missing" },
    }
  }

  const existing = await fetchBookingCreatedNotifyStatus(trimmed)
  if (existing && isBookingCreatedNotifyComplete(existing)) {
    return existing
  }

  return notifyBookingCreatedViaApi(trimmed, language)
}
