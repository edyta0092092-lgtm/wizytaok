import { sendReminderEmail } from "@/lib/notifications/email"
import { sendPlainTransactionalSms } from "@/lib/notifications/transactional-sms"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Tables, TablesInsert } from "@/types/database"

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

type BookingRow = Pick<
  Tables<"bookings">,
  | "id"
  | "business_id"
  | "confirmation_token"
  | "service_name"
  | "appointment_date"
  | "appointment_time"
  | "client_name"
> & {
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

function buildManageUrl(confirmationToken: string): string {
  return `${getPublicAppOrigin()}/confirm/${encodeURIComponent(confirmationToken)}?source=booking`
}

function buildMessages(
  booking: BookingRow,
  businessName: string,
  language: "pl" | "en",
  manageUrl: string,
) {
  const dateLabel = formatDateLabel(String(booking.appointment_date), language)
  const timeHm = formatTimeHmFromDb(String(booking.appointment_time))
  const name = booking.client_name.trim()
  const service = booking.service_name.trim()
  const business = businessName.trim() || "WizytaOK"

  if (language === "en") {
    return {
      sms: `Booking confirmed: ${service}, ${dateLabel} at ${timeHm}. Manage: ${manageUrl}`,
      emailSubject: "Appointment confirmation",
      emailText: `Hi ${name},\n\nyour booking is confirmed.\n\nService: ${service}\nTime: ${dateLabel} at ${timeHm}\n\nManage your visit:\n${manageUrl}\n\n${business}`,
      emailHtml: `<p>Hi ${name},</p><p>Your booking is confirmed.</p><p>Service: <strong>${service}</strong><br/>Time: ${dateLabel} at ${timeHm}</p><p><a href="${manageUrl}">Manage your visit</a></p><p>${business}</p>`,
    }
  }

  return {
    sms: `Potwierdzenie wizyty: ${service}, ${dateLabel} o ${timeHm}. Link: ${manageUrl}`,
    emailSubject: "Potwierdzenie wizyty",
    emailText: `Cześć ${name},\n\npotwierdzamy rezerwację wizyty.\n\nUsługa: ${service}\nTermin: ${dateLabel} o ${timeHm}\n\nZarządzaj wizytą:\n${manageUrl}\n\n${business}`,
    emailHtml: `<p>Cześć ${name},</p><p>Potwierdzamy rezerwację wizyty.</p><p>Usługa: <strong>${service}</strong><br/>Termin: ${dateLabel} o ${timeHm}</p><p><a href="${manageUrl}">Zarządzaj wizytą</a></p><p>${business}</p>`,
  }
}

async function hasExistingLog(
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
    client_phone: typeof o.client_phone === "string" ? o.client_phone : null,
    client_email: typeof o.client_email === "string" ? o.client_email : null,
  }

  if (!booking.id || !booking.business_id) {
    return { ok: false, email: "failed", sms: "failed" }
  }

  const { data: business } = await admin
    .from("business_profiles")
    .select("business_name")
    .eq("id", booking.business_id)
    .maybeSingle()

  const manageUrl = buildManageUrl(booking.confirmation_token)
  const messages = buildMessages(booking, business?.business_name ?? "", language, manageUrl)
  const nowIso = new Date().toISOString()

  let emailStatus: BookingCreatedChannelStatus = "missing"
  const email = booking.client_email?.trim() ?? ""
  if (!email) {
    emailStatus = "missing"
  } else if (await hasExistingLog(admin, booking.id, "email")) {
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
        error: sent.ok ? null : sent.error ?? sent.code,
        sent_at: sent.ok ? nowIso : null,
      })
      if (!sent.ok) {
        console.error("[booking-created.notify.email]", sent.error ?? sent.code)
      }
    } catch (err) {
      emailStatus = "failed"
      console.error("[booking-created.notify.email]", err)
    }
  }

  let smsStatus: BookingCreatedChannelStatus = "missing"
  const phone = booking.client_phone?.trim() ?? ""
  if (!phone) {
    smsStatus = "missing"
  } else if (await hasExistingLog(admin, booking.id, "sms")) {
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
        error: sent.ok ? null : sent.error ?? sent.code,
        sent_at: sent.ok ? nowIso : null,
      })
      if (!sent.ok) {
        console.error("[booking-created.notify.sms]", sent.error ?? sent.code)
      }
    } catch (err) {
      smsStatus = "failed"
      console.error("[booking-created.notify.sms]", err)
    }
  }

  return {
    ok: true,
    email: emailStatus,
    sms: smsStatus,
  }
}
