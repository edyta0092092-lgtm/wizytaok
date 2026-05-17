import { sendReminderEmail } from "@/lib/notifications/email"
import {
  buildTransactionalEmailHtml,
  buildTransactionalEmailText,
} from "@/lib/notifications/transactional-email-layout"
import { sendPlainTransactionalSms } from "@/lib/notifications/transactional-sms"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { TablesInsert } from "@/types/database"

export type BookingCreatedChannelStatus =
  | "sent"
  | "failed"
  | "skipped"
  | "missing"
  | "already_sent"

export type BookingCreatedNotifyResult = {
  ok: boolean
  email: BookingCreatedChannelStatus
  sms: BookingCreatedChannelStatus
}

type BookingRow = {
  id: string
  business_id: string
  confirmation_token: string
  service_name: string
  appointment_date: string
  appointment_time: string
  client_name: string
  client_phone: string | null
  client_email: string | null
}

function getPublicAppOrigin(): string {
  const explicit = process.env.APP_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`
  return "http://localhost:3000"
}

function formatDateLabel(date: string, language: "pl" | "en"): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date.slice(0, 10)
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

function formatTimeHmFromDb(t: string): string {
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "09:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
}

function formatAppointmentDateTime(
  appointmentDate: string,
  appointmentTime: string,
  language: "pl" | "en",
): string {
  const dateLabel = formatDateLabel(appointmentDate, language)
  const timeHm = formatTimeHmFromDb(appointmentTime)
  if (language === "en") return `${dateLabel}, ${timeHm}`
  return `${dateLabel}, ${timeHm}`
}

function buildConfirmUrl(confirmationToken: string): string {
  return `${getPublicAppOrigin()}/confirm/${encodeURIComponent(confirmationToken)}?source=booking`
}

function readOptionalString(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s.length > 0 ? s : null
}

function buildMessages(
  booking: BookingRow,
  language: "pl" | "en",
  confirmUrl: string,
) {
  const serviceName = booking.service_name.trim()
  const clientName = booking.client_name.trim()
  const appointmentDateTime = formatAppointmentDateTime(
    String(booking.appointment_date),
    String(booking.appointment_time),
    language,
  )

  const detailRows = language === "en"
    ? [
        { label: "Service", value: serviceName },
        { label: "Date and time", value: appointmentDateTime },
        { label: "Client", value: clientName },
      ]
    : [
        { label: "Usługa", value: serviceName },
        { label: "Termin", value: appointmentDateTime },
        { label: "Klient", value: clientName },
      ]

  const emailSubject = language === "en" ? "Appointment confirmed" : "Wizyta potwierdzona"
  const intro =
    language === "en"
      ? "Your appointment has been confirmed."
      : "Twoja wizyta została potwierdzona."
  const cta =
    language === "en"
      ? {
          href: confirmUrl,
          label: "Cancel booking",
          hint: "If you cannot attend, cancel your booking as soon as possible.",
        }
      : {
          href: confirmUrl,
          label: "Anuluj rezerwację",
          hint: "Jeśli nie możesz przyjść, anuluj rezerwację jak najwcześniej.",
        }

  const emailText = buildTransactionalEmailText({
    lang: language,
    intro,
    detailRows,
    cta,
  })
  const emailHtml = buildTransactionalEmailHtml({
    lang: language,
    subject: emailSubject,
    preheader:
      language === "en"
        ? `Appointment confirmed — ${appointmentDateTime}.`
        : `Wizyta potwierdzona — ${appointmentDateTime}.`,
    title: emailSubject,
    intro,
    detailRows,
    cta,
  })

  return {
    sms:
      language === "en"
        ? `Appointment confirmed: ${serviceName}, ${appointmentDateTime}. Cancel if needed: ${confirmUrl}`
        : `Wizyta potwierdzona: ${serviceName}, ${appointmentDateTime}. Anuluj: ${confirmUrl}`,
    emailSubject,
    emailText,
    emailHtml,
  }
}

async function hasAlreadySentLog(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  bookingId: string,
  channel: "email" | "sms",
): Promise<boolean> {
  const { data } = await admin
    .from("notification_logs")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("type", "booking_created")
    .eq("channel", channel)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle()
  return Boolean(data?.id)
}

async function insertLog(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  row: TablesInsert<"notification_logs">,
) {
  const { error } = await admin.from("notification_logs").insert(row)
  if (error && error.code !== "23505") {
    console.error("[booking-created.notify.log]", error.message)
  }
}

function mapLogRowStatus(status: string | null | undefined): BookingCreatedChannelStatus {
  if (status === "sent") return "sent"
  if (status === "failed") return "failed"
  if (status === "skipped") return "skipped"
  return "failed"
}

export async function getBookingCreatedNotifyStatus(
  bookingId: string,
): Promise<BookingCreatedNotifyResult> {
  const admin = getServiceRoleClient()
  if (!admin) {
    return { ok: false, email: "failed", sms: "failed" }
  }
  const id = bookingId.trim()
  if (!id) {
    return { ok: false, email: "missing", sms: "missing" }
  }

  const { data: logs } = await admin
    .from("notification_logs")
    .select("channel, status")
    .eq("booking_id", id)
    .eq("type", "booking_created")

  const emailRow = (logs ?? []).find((r) => r.channel === "email")
  const smsRow = (logs ?? []).find((r) => r.channel === "sms")

  return {
    ok: true,
    email: emailRow ? mapLogRowStatus(emailRow.status) : "missing",
    sms: smsRow ? mapLogRowStatus(smsRow.status) : "missing",
  }
}

export async function sendBookingCreatedNotifications(
  confirmationToken: string,
  language: "pl" | "en",
): Promise<BookingCreatedNotifyResult> {
  const admin = getServiceRoleClient()
  if (!admin) {
    console.error("[booking-created.notify] service_role_missing")
    return { ok: false, email: "failed", sms: "failed" }
  }

  const token = confirmationToken.trim()
  if (!token) {
    return { ok: false, email: "missing", sms: "missing" }
  }

  const { data: bookingRaw, error: bookingErr } = await admin.rpc("get_booking_by_confirmation_token", {
    p_token: token,
  })
  if (bookingErr || !bookingRaw || typeof bookingRaw !== "object") {
    console.error("[booking-created.notify] booking_not_found", bookingErr?.message)
    return { ok: false, email: "failed", sms: "failed" }
  }

  const o = bookingRaw as Record<string, unknown>
  const booking: BookingRow = {
    id: String(o.id ?? ""),
    business_id: String(o.business_id ?? ""),
    confirmation_token: String(o.confirmation_token ?? token),
    service_name: String(o.service_name ?? ""),
    appointment_date: String(o.appointment_date ?? ""),
    appointment_time: String(o.appointment_time ?? ""),
    client_name: String(o.client_name ?? ""),
    client_phone: readOptionalString(o.client_phone),
    client_email: readOptionalString(o.client_email),
  }

  if (!booking.id || !booking.business_id) {
    return { ok: false, email: "failed", sms: "failed" }
  }

  const confirmUrl = buildConfirmUrl(booking.confirmation_token)
  const messages = buildMessages(booking, language, confirmUrl)
  const nowIso = new Date().toISOString()

  let emailStatus: BookingCreatedChannelStatus = "missing"
  const email = booking.client_email ?? ""
  if (!email) {
    emailStatus = "missing"
  } else if (await hasAlreadySentLog(admin, booking.id, "email")) {
    emailStatus = "already_sent"
  } else {
    try {
      const sent = await sendReminderEmail({
        to: email,
        subject: messages.emailSubject,
        textBody: messages.emailText,
        htmlBody: messages.emailHtml,
      })
      const logStatus = sent.ok ? "sent" : "failed"
      emailStatus = sent.ok ? "sent" : "failed"
      await insertLog(admin, {
        business_id: booking.business_id,
        booking_id: booking.id,
        channel: "email",
        type: "booking_created",
        recipient: email,
        status: logStatus,
        subject: messages.emailSubject,
        body: messages.emailText,
        provider: sent.ok ? sent.provider : null,
        provider_message_id: sent.ok ? sent.messageId ?? null : null,
        error: sent.ok ? null : `${sent.code}${sent.error ? `: ${sent.error}` : ""}`,
        sent_at: sent.ok ? nowIso : null,
      })
      if (!sent.ok) {
        console.error("[booking-created.notify.email]", sent.code, sent.error ?? "")
      }
    } catch (err) {
      emailStatus = "failed"
      const errMsg = err instanceof Error ? err.message : "unknown_error"
      console.error("[booking-created.notify.email]", errMsg)
      await insertLog(admin, {
        business_id: booking.business_id,
        booking_id: booking.id,
        channel: "email",
        type: "booking_created",
        recipient: email,
        status: "failed",
        subject: messages.emailSubject,
        body: messages.emailText,
        provider: null,
        provider_message_id: null,
        error: errMsg,
        sent_at: null,
      })
    }
  }

  let smsStatus: BookingCreatedChannelStatus = "missing"
  const phone = booking.client_phone ?? ""
  if (!phone) {
    smsStatus = "missing"
  } else if (await hasAlreadySentLog(admin, booking.id, "sms")) {
    smsStatus = "already_sent"
  } else {
    try {
      const sent = await sendPlainTransactionalSms({ to: phone, body: messages.sms })
      const logStatus = sent.ok ? "sent" : "failed"
      smsStatus = sent.ok ? "sent" : "failed"
      await insertLog(admin, {
        business_id: booking.business_id,
        booking_id: booking.id,
        channel: "sms",
        type: "booking_created",
        recipient: phone,
        status: logStatus,
        subject: null,
        body: messages.sms,
        provider: sent.ok ? sent.provider : null,
        provider_message_id: sent.ok ? sent.messageId ?? null : null,
        error: sent.ok ? null : `${sent.code}${sent.error ? `: ${sent.error}` : ""}`,
        sent_at: sent.ok ? nowIso : null,
      })
      if (!sent.ok) {
        console.error("[booking-created.notify.sms]", sent.code, sent.error ?? "")
      }
    } catch (err) {
      smsStatus = "failed"
      const errMsg = err instanceof Error ? err.message : "unknown_error"
      console.error("[booking-created.notify.sms]", errMsg)
      await insertLog(admin, {
        business_id: booking.business_id,
        booking_id: booking.id,
        channel: "sms",
        type: "booking_created",
        recipient: phone,
        status: "failed",
        subject: null,
        body: messages.sms,
        provider: null,
        provider_message_id: null,
        error: errMsg,
        sent_at: null,
      })
    }
  }

  return {
    ok: true,
    email: emailStatus,
    sms: smsStatus,
  }
}
