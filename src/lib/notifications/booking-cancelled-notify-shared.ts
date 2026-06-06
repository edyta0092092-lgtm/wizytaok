import { sendReminderEmail } from "@/lib/notifications/email"
import {
  buildTransactionalEmailHtml,
  buildTransactionalEmailText,
} from "@/lib/notifications/transactional-email-layout"
import { buildBusinessTemplateVars } from "@/lib/notifications/business-template-vars"
import { plainTextEmailToHtml } from "@/lib/notifications/plain-text-email-html"
import { applyTemplateVariables } from "@/lib/notifications/template-runtime"
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

export type CancelNotifyLanguage = "pl" | "en"
export type BookingCancelledLogType = "booking_cancelled_by_client" | "booking_cancelled_by_company"

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

export type BookingCancelledMessageOverrides = {
  smsBody?: string | null
  emailSubject?: string | null
  emailBodyPlain?: string | null
}

export function buildBookingCancelledMessages(
  language: CancelNotifyLanguage,
  vars: Record<string, string>,
  overrides?: BookingCancelledMessageOverrides,
): {
  sms: string
  emailSubject: string
  emailText: string
  emailHtml: string
} {
  const appointmentDateTime = vars.termin ?? vars.data ?? ""
  const serviceName = vars.usluga ?? ""
  const defaultSmsPl = `Wizyta odwołana: ${serviceName}, ${appointmentDateTime}.`
  const defaultSmsEn = `Appointment cancelled: ${serviceName}, ${appointmentDateTime}.`
  const defaultSms = language === "en" ? defaultSmsEn : defaultSmsPl

  const emailSubject =
    overrides?.emailSubject?.trim()
      ? applyTemplateVariables(overrides.emailSubject, vars)
      : language === "en"
        ? "Appointment cancelled"
        : "Wizyta odwołana"

  const intro =
    overrides?.emailBodyPlain?.trim()
      ? applyTemplateVariables(overrides.emailBodyPlain, vars).split("\n")[0]?.trim() ||
        (language === "en" ? "Your appointment has been cancelled." : "Twoja wizyta została odwołana.")
      : language === "en"
        ? "Your appointment has been cancelled."
        : "Twoja wizyta została odwołana."

  const detailRows =
    language === "en"
      ? [
          { label: "Service", value: serviceName },
          { label: "Date and time", value: appointmentDateTime },
        ]
      : [
          { label: "Usługa", value: serviceName },
          { label: "Termin", value: appointmentDateTime },
        ]

  const rebookUrl = vars.link_rezerwacji?.trim() ?? ""
  const cta = rebookUrl
    ? language === "en"
      ? {
          href: rebookUrl,
          label: "Book again",
          hint: "You can schedule a new appointment at any time.",
        }
      : {
          href: rebookUrl,
          label: "Umów ponownie",
          hint: "W każdej chwili możesz umówić nową wizytę.",
        }
    : null

  const sms = overrides?.smsBody?.trim()
    ? applyTemplateVariables(overrides.smsBody, vars)
    : defaultSms

  const emailTextFallback = buildTransactionalEmailText({
    lang: language,
    intro,
    detailRows,
    cta,
  })

  const emailHtmlFallback = buildTransactionalEmailHtml({
    lang: language,
    subject: emailSubject,
    preheader:
      language === "en"
        ? `Appointment cancelled — ${appointmentDateTime}.`
        : `Wizyta odwołana — ${appointmentDateTime}.`,
    title: emailSubject,
    intro,
    detailRows,
    cta,
  })

  const customEmailBody = overrides?.emailBodyPlain?.trim()
    ? applyTemplateVariables(overrides.emailBodyPlain, vars).trim()
    : ""
  const emailText = customEmailBody || emailTextFallback
  const emailHtml = customEmailBody ? plainTextEmailToHtml(customEmailBody) : emailHtmlFallback

  return { sms, emailSubject, emailText, emailHtml }
}

type CancelLogAdmin = NonNullable<ReturnType<typeof getServiceRoleClient>>

async function persistCancelledChannelLog(
  admin: CancelLogAdmin,
  booking: Tables<"bookings">,
  logType: BookingCancelledLogType,
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
    "[booking-cancelled.notify.log]",
  )
}

function mapChannelStatus(ok: boolean, code?: string): TablesInsert<"notification_logs">["status"] {
  if (ok) return "sent"
  if (code === "simulated_dev" || code === "not_configured") return "queued"
  return "failed"
}

/**
 * Wysyła SMS i e-mail z potwierdzeniem „Wizyta odwołana” — zawsze gdy klient ma telefon/e-mail.
 */
export async function sendBookingCancelledConfirmation(args: {
  booking: Tables<"bookings">
  business: Pick<
    Tables<"business_profiles">,
    "slug" | "phone" | "contact_phone" | "business_name" | "business_address"
  >
  language: CancelNotifyLanguage
  logType: BookingCancelledLogType
  staffDisplayName?: string
  messageOverrides?: BookingCancelledMessageOverrides
  sendSms?: boolean
  sendEmail?: boolean
}): Promise<{ notice: "sent" | "queued" }> {
  const { booking, business, language, logType } = args
  const admin = getServiceRoleClient()
  if (!admin) {
    console.error("[booking-cancelled.notify.log] service_role_missing — SMS/e-mail bez wpisu w historii")
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
    osoba: args.staffDisplayName ?? getStaffDisplayName({ name: booking.staff_name ?? "" }),
    ...buildBusinessTemplateVars(business, {
      link_rezerwacji: linkRezerwacji,
      link_potwierdzenia: confirmPath,
      link_anulowania: confirmPath,
    }),
  }

  const messages = buildBookingCancelledMessages(language, vars, args.messageOverrides)
  const nowIso = new Date().toISOString()
  let anySent = false
  let logsOk = true

  const shouldSendSms = args.sendSms ?? true
  const shouldSendEmail = args.sendEmail ?? true

  const phone = booking.client_phone?.trim() ?? ""
  if (shouldSendSms && phone) {
    const quotaAdmin = admin ?? getServiceRoleClient()
    const quotaDecision = quotaAdmin
      ? await evaluateSmsQuotaForSend(quotaAdmin, booking.business_id)
      : null
    if (quotaDecision && isSmsMonthlyLimitExhausted(quotaDecision.quota)) {
      if (admin) {
        await persistCancelledChannelLog(admin, booking, logType, "sms", phone, {
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
    const status = mapChannelStatus(smsRes.ok, smsRes.ok ? undefined : smsRes.code)
    if (smsRes.ok) anySent = true
    if (admin) {
      const logged = await persistCancelledChannelLog(admin, booking, logType, "sms", phone, {
        status,
        subject: null,
        body: messages.sms,
        provider: smsRes.ok ? smsRes.provider : null,
        provider_message_id: smsRes.ok ? smsRes.messageId ?? null : null,
        error_message: smsRes.ok ? null : `${smsRes.code}${smsRes.error ? `: ${smsRes.error}` : ""}`,
        sent_at: smsRes.ok ? nowIso : null,
      })
      if (smsRes.ok && !logged) logsOk = false
    } else if (smsRes.ok) {
      logsOk = false
    }
    }
  }

  const email = booking.client_email?.trim() ?? ""
  if (shouldSendEmail && email) {
    const emailRes = await sendReminderEmail({
      to: email,
      subject: messages.emailSubject,
      textBody: messages.emailText,
      htmlBody: messages.emailHtml,
    })
    const status = mapChannelStatus(emailRes.ok, emailRes.ok ? undefined : emailRes.code)
    if (emailRes.ok) anySent = true
    if (admin) {
      const logged = await persistCancelledChannelLog(admin, booking, logType, "email", email, {
        status,
        subject: messages.emailSubject,
        body: messages.emailText,
        provider: emailRes.ok ? emailRes.provider : null,
        provider_message_id: emailRes.ok ? emailRes.messageId ?? null : null,
        error_message: emailRes.ok ? null : `${emailRes.code}${emailRes.error ? `: ${emailRes.error}` : ""}`,
        sent_at: emailRes.ok ? nowIso : null,
      })
      if (emailRes.ok && !logged) logsOk = false
    } else if (emailRes.ok) {
      logsOk = false
    }
  }

  if (anySent && !logsOk) {
    console.error("[booking-cancelled.notify.log] sent_but_log_persist_failed", {
      bookingId: booking.id,
      logType,
    })
  }

  return { notice: anySent ? "sent" : "queued" }
}
