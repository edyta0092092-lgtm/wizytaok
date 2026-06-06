import { sendReminderEmail } from "@/lib/notifications/email"
import {
  buildTransactionalEmailHtml,
  buildTransactionalEmailText,
} from "@/lib/notifications/transactional-email-layout"
import { buildBusinessTemplateVars } from "@/lib/notifications/business-template-vars"
import { sendPlainTransactionalSms } from "@/lib/notifications/transactional-sms"
import {
  evaluateSmsQuotaForSend,
  isSmsMonthlyLimitExhausted,
  SMS_MONTHLY_LIMIT_REACHED,
} from "@/lib/notifications/sms-quota-guard"
import { getStaffDisplayName } from "@/lib/staff/staff-display"
import type { NotificationLogUpdatePatch } from "@/lib/notifications/notification-log-update"
import { persistTransactionalChannelLog } from "@/lib/notifications/transactional-channel-log"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Tables, TablesInsert } from "@/types/database"

export type RescheduleNotifyLanguage = "pl" | "en"
export type BookingRescheduledLogType = "booking_rescheduled_by_client"

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

function formatDateLabel(ymd: string, lang: RescheduleNotifyLanguage): string {
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
  language: RescheduleNotifyLanguage,
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

export function buildBookingRescheduledMessages(
  language: RescheduleNotifyLanguage,
  vars: Record<string, string>,
): {
  sms: string
  emailSubject: string
  emailText: string
  emailHtml: string
} {
  const appointmentDateTime = vars.termin ?? vars.data ?? ""
  const serviceName = vars.usluga ?? ""
  const defaultSmsPl = `Wizyta została przełożona: ${serviceName}, ${appointmentDateTime}.`
  const defaultSmsEn = `Your appointment has been rescheduled: ${serviceName}, ${appointmentDateTime}.`
  const defaultSms = language === "en" ? defaultSmsEn : defaultSmsPl

  const emailSubject =
    language === "en" ? "Appointment rescheduled" : "Wizyta została przełożona"

  const intro =
    language === "en"
      ? "Your appointment has been rescheduled."
      : "Wizyta została przełożona."

  const detailRows =
    language === "en"
      ? [
          { label: "Service", value: serviceName },
          { label: "New date and time", value: appointmentDateTime },
        ]
      : [
          { label: "Usługa", value: serviceName },
          { label: "Nowy termin", value: appointmentDateTime },
        ]

  const manageUrl = vars.link_zarzadzaj?.trim() ?? ""
  const cta = manageUrl
    ? language === "en"
      ? {
          href: manageUrl,
          label: "Manage appointment",
          hint: "You can view or cancel your visit from this link.",
        }
      : {
          href: manageUrl,
          label: "Zarządzaj wizytą",
          hint: "Możesz sprawdzić szczegóły lub anulować wizytę z tego linku.",
        }
    : null

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
        ? `Rescheduled — ${appointmentDateTime}.`
        : `Przełożono — ${appointmentDateTime}.`,
    title: emailSubject,
    intro,
    detailRows,
    cta,
  })

  return { sms: defaultSms, emailSubject, emailText, emailHtml }
}

type RescheduleLogAdmin = NonNullable<ReturnType<typeof getServiceRoleClient>>

async function persistRescheduledChannelLog(
  admin: RescheduleLogAdmin,
  booking: Tables<"bookings">,
  logType: BookingRescheduledLogType,
  channel: "sms" | "email",
  recipient: string,
  patch: NotificationLogUpdatePatch,
): Promise<boolean> {
  return persistTransactionalChannelLog(
    admin,
    booking,
    logType,
    channel,
    recipient,
    patch,
    "[booking-rescheduled.notify.log]",
  )
}

function mapChannelStatus(ok: boolean, code?: string): TablesInsert<"notification_logs">["status"] {
  if (ok) return "sent"
  if (code === "simulated_dev" || code === "not_configured") return "queued"
  return "failed"
}

export async function sendBookingRescheduledConfirmation(args: {
  booking: Tables<"bookings">
  business: Pick<
    Tables<"business_profiles">,
    "slug" | "phone" | "contact_phone" | "business_name" | "business_address"
  >
  language: RescheduleNotifyLanguage
  logType: BookingRescheduledLogType
  staffDisplayName?: string
}): Promise<{ notice: "sent" | "queued" }> {
  const { booking, business, language, logType } = args
  const admin = getServiceRoleClient()
  if (!admin) {
    console.error("[booking-rescheduled.notify.log] service_role_missing")
  }
  const appUrl = getPublicAppOrigin()
  const appointmentDateTime = formatAppointmentDateTime(
    String(booking.appointment_date),
    String(booking.appointment_time),
    language,
  )
  const slug = business.slug?.trim() ?? ""
  const linkRezerwacji = slug ? `${appUrl}/rezerwacje/${encodeURIComponent(slug)}` : appUrl
  const confirmPath = `${appUrl}/confirm/${encodeURIComponent(booking.confirmation_token)}`
  const vars: Record<string, string> = {
    imie: firstToken(booking.client_name),
    data: String(booking.appointment_date).slice(0, 10),
    godzina: formatTimeHmFromDb(String(booking.appointment_time)),
    termin: appointmentDateTime,
    usluga: booking.service_name,
    osoba: args.staffDisplayName ?? getStaffDisplayName({ name: booking.staff_name ?? "" }),
    link_zarzadzaj: confirmPath,
    ...buildBusinessTemplateVars(business, {
      link_rezerwacji: linkRezerwacji,
      link_potwierdzenia: confirmPath,
      link_anulowania: confirmPath,
    }),
  }

  const messages = buildBookingRescheduledMessages(language, vars)
  const nowIso = new Date().toISOString()
  const phone = booking.client_phone?.trim() ?? ""
  const email = booking.client_email?.trim() ?? ""

  let anySent = false

  if (phone) {
    const quotaDecision = admin
      ? await evaluateSmsQuotaForSend(admin, booking.business_id)
      : null
    if (quotaDecision && isSmsMonthlyLimitExhausted(quotaDecision.quota)) {
      if (admin) {
        await persistRescheduledChannelLog(admin, booking, logType, "sms", phone, {
          status: "skipped",
          subject: null,
          body: messages.sms,
          provider: null,
          provider_message_id: null,
          error_message: SMS_MONTHLY_LIMIT_REACHED,
          sent_at: null,
        })
      }
    } else {
    const smsRes = await sendPlainTransactionalSms({ to: phone, body: messages.sms })
    const smsStatus = mapChannelStatus(smsRes.ok, smsRes.ok ? undefined : smsRes.code)
    if (smsRes.ok) anySent = true
    if (admin) {
      await persistRescheduledChannelLog(admin, booking, logType, "sms", phone, {
        status: smsStatus,
        subject: null,
        body: messages.sms,
        provider: smsRes.ok ? smsRes.provider : null,
        provider_message_id: smsRes.ok ? smsRes.messageId ?? null : null,
        error_message: smsRes.ok ? null : `${smsRes.code}${smsRes.error ? `: ${smsRes.error}` : ""}`,
        sent_at: smsRes.ok ? nowIso : null,
      })
    }
    }
  }

  if (email) {
    const emailRes = await sendReminderEmail({
      to: email,
      subject: messages.emailSubject,
      textBody: messages.emailText,
      htmlBody: messages.emailHtml,
    })
    const emailStatus = mapChannelStatus(emailRes.ok, emailRes.ok ? undefined : emailRes.code)
    if (emailRes.ok) anySent = true
    if (admin) {
      await persistRescheduledChannelLog(admin, booking, logType, "email", email, {
        status: emailStatus,
        subject: messages.emailSubject,
        body: messages.emailText,
        provider: emailRes.ok ? emailRes.provider : null,
        provider_message_id: emailRes.ok ? emailRes.messageId ?? null : null,
        error_message: emailRes.ok ? null : `${emailRes.code}${emailRes.error ? `: ${emailRes.error}` : ""}`,
        sent_at: emailRes.ok ? nowIso : null,
      })
    }
  }

  return { notice: anySent ? "sent" : "queued" }
}
