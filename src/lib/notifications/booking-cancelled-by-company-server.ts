import { buildBusinessTemplateVars } from "@/lib/notifications/business-template-vars"
import {
  buildBookingCancelledMessages,
  sendBookingCancelledConfirmation,
  type CancelNotifyLanguage,
} from "@/lib/notifications/booking-cancelled-notify-shared"
import type { NotificationLogUpdatePatch } from "@/lib/notifications/notification-log-update"
import { persistTransactionalChannelLog } from "@/lib/notifications/transactional-channel-log"
import { getTemplateRuntime } from "@/lib/notifications/template-runtime"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import { getStaffDisplayName } from "@/lib/staff/staff-display"
import type { Tables } from "@/types/database"

export type { CancelNotifyLanguage }

type BusinessRow = Pick<
  Tables<"business_profiles">,
  "id" | "slug" | "phone" | "contact_phone" | "business_name" | "business_address"
>

export const BOOKING_CANCELLED_BY_COMPANY_LOG_TYPE = "booking_cancelled_by_company" as const

const CANCELLATION_LOG_TYPES = [
  BOOKING_CANCELLED_BY_COMPANY_LOG_TYPE,
  "booking_cancelled_by_client",
] as const

export type BookingCancelledMessageContent = {
  sendSms: boolean
  sendEmail: boolean
  sms: string
  emailSubject: string
  emailText: string
  emailHtml: string
}

function getPublicAppOrigin(): string {
  const explicit = process.env.APP_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`
  return "http://localhost:3000"
}

function formatTimeHmFromDb(t: string): string {
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "09:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
}

function formatDateLabel(ymd: string, lang: CancelNotifyLanguage): string {
  const raw = String(ymd).slice(0, 10)
  const d = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(d.getTime())) return raw
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

function formatAppointmentDateTime(
  appointmentDate: string,
  appointmentTime: string,
  language: CancelNotifyLanguage,
): string {
  const dateLabel = formatDateLabel(appointmentDate, language)
  const timeHm = formatTimeHmFromDb(appointmentTime)
  return `${dateLabel}, ${timeHm}`
}

function firstToken(name: string): string {
  const s = name.trim()
  if (!s) return ""
  return s.split(/\s+/)[0] ?? s
}

type CancelLogAdmin = NonNullable<ReturnType<typeof getServiceRoleClient>>

async function loadStaffDisplayName(
  admin: CancelLogAdmin | null,
  booking: Tables<"bookings">,
): Promise<string> {
  const staffId =
    typeof (booking as { staff_id?: string | null }).staff_id === "string"
      ? ((booking as { staff_id?: string | null }).staff_id ?? "").trim()
      : ""
  let staffNameRel: string | null = null
  if (admin && staffId) {
    const { data: staff } = await admin.from("staff_members").select("name").eq("id", staffId).maybeSingle()
    staffNameRel = staff?.name?.trim() || null
  }
  return getStaffDisplayName({ name: staffNameRel ?? booking.staff_name ?? "" })
}

export async function buildBookingCancelledNotifyContent(
  admin: CancelLogAdmin | null,
  booking: Tables<"bookings">,
  business: BusinessRow,
  language: CancelNotifyLanguage,
): Promise<BookingCancelledMessageContent> {
  const staffDisplayName = await loadStaffDisplayName(admin, booking)
  let sendSms = true
  let sendEmail = true
  let messageOverrides = undefined
  if (admin) {
    const template = await getTemplateRuntime(admin, business.id, BOOKING_CANCELLED_BY_COMPANY_LOG_TYPE)
    sendSms = template.smsExists ? template.smsEnabled : true
    sendEmail = template.emailExists ? template.emailEnabled : true
    const hasCustom =
      (template.smsEnabled && template.smsBody) ||
      (template.emailEnabled && (template.emailSubject || template.emailBody))
    if (hasCustom) {
      messageOverrides = {
        smsBody: template.smsEnabled ? template.smsBody : null,
        emailSubject: template.emailEnabled ? template.emailSubject : null,
        emailBodyPlain: template.emailEnabled ? template.emailBody : null,
      }
    }
  }

  const appUrl = getPublicAppOrigin()
  const slug = business.slug?.trim() ?? ""
  const linkRezerwacji = slug ? `${appUrl}/rezerwacje/${encodeURIComponent(slug)}` : appUrl
  const appointmentDateTime = formatAppointmentDateTime(
    String(booking.appointment_date),
    String(booking.appointment_time),
    language,
  )
  const confirmPath = `${appUrl}/confirm/${encodeURIComponent(booking.confirmation_token)}`
  const vars: Record<string, string> = {
    imie: firstToken(booking.client_name),
    data: String(booking.appointment_date).slice(0, 10),
    godzina: formatTimeHmFromDb(String(booking.appointment_time)),
    termin: appointmentDateTime,
    usluga: booking.service_name,
    osoba: staffDisplayName,
    ...buildBusinessTemplateVars(business, {
      link_rezerwacji: linkRezerwacji,
      link_potwierdzenia: confirmPath,
      link_anulowania: confirmPath,
    }),
  }

  const messages = buildBookingCancelledMessages(language, vars, messageOverrides)
  return { sendSms, sendEmail, ...messages }
}

async function persistCancellationChannelLog(
  admin: CancelLogAdmin,
  booking: Tables<"bookings">,
  channel: "sms" | "email",
  recipient: string,
  patch: NotificationLogUpdatePatch,
): Promise<boolean> {
  return persistTransactionalChannelLog(
    admin,
    booking,
    BOOKING_CANCELLED_BY_COMPANY_LOG_TYPE,
    channel,
    recipient,
    patch,
    "[booking-cancelled.notify.log]",
  )
}

export async function hasCancellationHistoryLog(
  admin: CancelLogAdmin,
  bookingId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("notification_logs")
    .select("status, body, recipient, type")
    .eq("booking_id", bookingId)
    .in("type", [...CANCELLATION_LOG_TYPES])

  return (data ?? []).some((row) => {
    const st = String(row.status ?? "").trim().toLowerCase()
    const hasContent = Boolean(row.body?.trim()) || Boolean(row.recipient?.trim())
    if (!hasContent) return false
    return st === "sent" || st === "skipped" || st === "queued"
  })
}

export async function ensureCancellationLogsInHistory(args: {
  booking: Tables<"bookings">
  business: BusinessRow
  language: CancelNotifyLanguage
}): Promise<boolean> {
  const admin = getServiceRoleClient()
  if (!admin) return false

  const { booking, business, language } = args
  if (await hasCancellationHistoryLog(admin, booking.id)) return true

  const content = await buildBookingCancelledNotifyContent(admin, booking, business, language)
  const nowIso = new Date().toISOString()
  let anyOk = false

  const phone = booking.client_phone?.trim() ?? ""
  if (content.sendSms && phone) {
    const ok = await persistCancellationChannelLog(admin, booking, "sms", phone, {
      status: "sent",
      subject: null,
      body: content.sms,
      provider: null,
      provider_message_id: null,
      error_message: null,
      sent_at: nowIso,
    })
    if (ok) anyOk = true
  }

  const email = booking.client_email?.trim() ?? ""
  if (content.sendEmail && email) {
    const ok = await persistCancellationChannelLog(admin, booking, "email", email, {
      status: "sent",
      subject: content.emailSubject,
      body: content.emailText,
      provider: null,
      provider_message_id: null,
      error_message: null,
      sent_at: nowIso,
    })
    if (ok) anyOk = true
  }

  return anyOk
}

/**
 * Po anulowaniu wizyty przez firmę — SMS i e-mail z potwierdzeniem „Wizyta odwołana”.
 */
export async function notifyBookingCancelledByCompany(args: {
  booking: Tables<"bookings">
  business: BusinessRow
  language: CancelNotifyLanguage
  /** Zachowane dla kompatybilności API — wysyłka nie jest już blokowana tym flagiem. */
  messagesEffectivelySent?: boolean
}): Promise<{ notice: "queued" | "sent" }> {
  void args.messagesEffectivelySent
  const admin = getServiceRoleClient()
  const { booking, business, language } = args

  const staffDisplayName = await loadStaffDisplayName(admin, booking)
  let messageOverrides = undefined
  let sendSms = true
  let sendEmail = true
  if (admin) {
    const template = await getTemplateRuntime(admin, business.id, BOOKING_CANCELLED_BY_COMPANY_LOG_TYPE)
    sendSms = template.smsExists ? template.smsEnabled : true
    sendEmail = template.emailExists ? template.emailEnabled : true
    const hasCustom =
      (template.smsEnabled && template.smsBody) ||
      (template.emailEnabled && (template.emailSubject || template.emailBody))
    if (hasCustom) {
      messageOverrides = {
        smsBody: template.smsEnabled ? template.smsBody : null,
        emailSubject: template.emailEnabled ? template.emailSubject : null,
        emailBodyPlain: template.emailEnabled ? template.emailBody : null,
      }
    }
  }

  const result = await sendBookingCancelledConfirmation({
    booking,
    business,
    language,
    logType: BOOKING_CANCELLED_BY_COMPANY_LOG_TYPE,
    staffDisplayName,
    messageOverrides,
    sendSms,
    sendEmail,
  })

  if (
    admin &&
    (result.notice === "sent" || result.notice === "queued") &&
    !(await hasCancellationHistoryLog(admin, booking.id))
  ) {
    await ensureCancellationLogsInHistory({ booking, business, language })
  }

  return result
}

export function inferMessagesEffectivelySent(): boolean {
  const smsConfigured =
    Boolean(process.env.SMSAPI_TOKEN?.trim()) ||
    (Boolean(process.env.TWILIO_ACCOUNT_SID?.trim()) &&
      Boolean(process.env.TWILIO_AUTH_TOKEN?.trim()) &&
      Boolean(process.env.TWILIO_FROM_NUMBER?.trim()))
  const emailConfigured = Boolean(process.env.RESEND_API_KEY?.trim())
  return smsConfigured || emailConfigured
}
