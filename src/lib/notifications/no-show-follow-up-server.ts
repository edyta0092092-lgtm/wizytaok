import { sendReminderEmail } from "@/lib/notifications/email"
import { buildBusinessTemplateVars } from "@/lib/notifications/business-template-vars"
import { plainTextEmailToHtml } from "@/lib/notifications/plain-text-email-html"
import type { NotificationLogUpdatePatch } from "@/lib/notifications/notification-log-update"
import { persistTransactionalChannelLog } from "@/lib/notifications/transactional-channel-log"
import {
  applyTemplateVariables,
  getTemplateRuntime,
} from "@/lib/notifications/template-runtime"
import { sendPlainTransactionalSms } from "@/lib/notifications/transactional-sms"
import { getStaffDisplayName } from "@/lib/staff/staff-display"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Tables, TablesInsert } from "@/types/database"

export type NoShowFollowUpLanguage = "pl" | "en"

type BusinessRow = Pick<
  Tables<"business_profiles">,
  "id" | "slug" | "phone" | "contact_phone" | "business_name" | "business_address"
>

export const NO_SHOW_FOLLOW_UP_LOG_TYPE = "no_show_follow_up" as const

/** Domyślna treść follow-upu, gdy kanał jest włączony, ale treść w szablonie jest pusta. */
const DEFAULTS = {
  pl: {
    sms: "Cześć {{imie}}, nie odnotowaliśmy Twojej wizyty {{data}} o {{godzina}}. Umów nowy termin: {{link_rezerwacji}}",
    emailSubject: "Nowy termin po nieobecności",
    emailBody: `Cześć {{imie}},

nie odnotowaliśmy Twojej wizyty:
- Data: {{data}}
- Godzina: {{godzina}}
- Usługa: {{usluga}}

Jeśli chcesz, możesz od razu umówić nowy termin:
{{link_rezerwacji}}

Pozdrawiamy,
{{nazwa_firmy}}`,
  },
  en: {
    sms: "Hi {{imie}}, we missed you at your appointment on {{data}} at {{godzina}}. Book a new one: {{link_rezerwacji}}",
    emailSubject: "Book a new appointment",
    emailBody: `Hi {{imie}},

we missed you at your appointment:
- Date: {{data}}
- Time: {{godzina}}
- Service: {{usluga}}

If you'd like, you can book a new appointment right away:
{{link_rezerwacji}}

Best regards,
{{nazwa_firmy}}`,
  },
} as const

export type NoShowFollowUpMessageContent = {
  sendSms: boolean
  sendEmail: boolean
  smsText: string
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

function firstToken(name: string | null | undefined): string {
  const s = String(name ?? "").trim()
  if (!s) return ""
  return s.split(/\s+/)[0] ?? s
}

function mapChannelStatus(ok: boolean, code?: string): TablesInsert<"notification_logs">["status"] {
  if (ok) return "sent"
  if (code === "simulated_dev" || code === "not_configured") return "queued"
  return "failed"
}

type FollowUpLogAdmin = NonNullable<ReturnType<typeof getServiceRoleClient>>

async function loadStaffName(admin: FollowUpLogAdmin, booking: Tables<"bookings">): Promise<string | null> {
  const staffId =
    typeof (booking as { staff_id?: string | null }).staff_id === "string"
      ? ((booking as { staff_id?: string | null }).staff_id ?? "").trim()
      : ""
  if (!staffId) return null
  const { data: staff } = await admin
    .from("staff_members")
    .select("name")
    .eq("id", staffId)
    .maybeSingle()
  return staff?.name?.trim() || null
}

async function buildTemplateVars(
  admin: FollowUpLogAdmin,
  booking: Tables<"bookings">,
  business: BusinessRow,
): Promise<Record<string, string>> {
  const staffNameRel = await loadStaffName(admin, booking)
  const appUrl = getPublicAppOrigin()
  const slug = business.slug?.trim() ?? ""
  const linkRezerwacji = slug ? `${appUrl}/rezerwacje/${encodeURIComponent(slug)}` : appUrl
  const confirmPath = `${appUrl}/confirm/${encodeURIComponent(booking.confirmation_token)}`
  return {
    imie: firstToken(booking.client_name),
    data: String(booking.appointment_date).slice(0, 10),
    godzina: formatTimeHmFromDb(String(booking.appointment_time)),
    usluga: booking.service_name,
    osoba: getStaffDisplayName({ name: staffNameRel ?? booking.staff_name ?? "" }),
    ...buildBusinessTemplateVars(business, {
      link_rezerwacji: linkRezerwacji,
      link_potwierdzenia: confirmPath,
      link_anulowania: confirmPath,
    }),
  }
}

export async function buildNoShowFollowUpContent(
  admin: FollowUpLogAdmin,
  booking: Tables<"bookings">,
  business: BusinessRow,
  language: NoShowFollowUpLanguage,
): Promise<NoShowFollowUpMessageContent> {
  const runtime = await getTemplateRuntime(admin, business.id, NO_SHOW_FOLLOW_UP_LOG_TYPE)
  const sendSms = runtime.smsExists ? runtime.smsEnabled : false
  const sendEmail = runtime.emailExists ? runtime.emailEnabled : false
  const vars = await buildTemplateVars(admin, booking, business)
  const defaults = DEFAULTS[language] ?? DEFAULTS.pl
  const smsTemplate = runtime.smsBody?.trim() || defaults.sms
  const emailSubjectTemplate = runtime.emailSubject?.trim() || defaults.emailSubject
  const emailBodyTemplate = runtime.emailBody?.trim() || defaults.emailBody
  const smsText = applyTemplateVariables(smsTemplate, vars)
  const emailSubject = applyTemplateVariables(emailSubjectTemplate, vars)
  const emailText = applyTemplateVariables(emailBodyTemplate, vars)
  return {
    sendSms,
    sendEmail,
    smsText,
    emailSubject,
    emailText,
    emailHtml: plainTextEmailToHtml(emailText),
  }
}

async function persistFollowUpChannelLog(
  admin: FollowUpLogAdmin,
  booking: Tables<"bookings">,
  channel: "sms" | "email",
  recipient: string,
  patch: NotificationLogUpdatePatch,
): Promise<boolean> {
  return persistTransactionalChannelLog(
    admin,
    booking,
    NO_SHOW_FOLLOW_UP_LOG_TYPE,
    channel,
    recipient,
    patch,
    "[no-show-follow-up.log]",
  )
}

export async function hasNoShowFollowUpHistoryLog(
  admin: FollowUpLogAdmin,
  bookingId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("notification_logs")
    .select("status, body, recipient")
    .eq("booking_id", bookingId)
    .eq("type", NO_SHOW_FOLLOW_UP_LOG_TYPE)

  return (data ?? []).some((row) => {
    const st = String(row.status ?? "").trim().toLowerCase()
    const hasContent = Boolean(row.body?.trim()) || Boolean(row.recipient?.trim())
    if (!hasContent) return false
    return st === "sent" || st === "skipped" || st === "queued"
  })
}

/**
 * Uzupełnia wpisy w notification_logs bez ponownej wysyłki SMS/e-mail.
 */
export async function ensureNoShowFollowUpLogsInHistory(args: {
  booking: Tables<"bookings">
  business: BusinessRow
  language: NoShowFollowUpLanguage
}): Promise<boolean> {
  const admin = getServiceRoleClient()
  if (!admin) return false

  const { booking, business, language } = args
  if (await hasNoShowFollowUpHistoryLog(admin, booking.id)) return true

  const content = await buildNoShowFollowUpContent(admin, booking, business, language)
  const nowIso = new Date().toISOString()
  let anyOk = false

  const phone = booking.client_phone?.trim() ?? ""
  if (content.sendSms && phone) {
    const ok = await persistFollowUpChannelLog(admin, booking, "sms", phone, {
      status: "sent",
      subject: null,
      body: content.smsText,
      provider: null,
      provider_message_id: null,
      error_message: null,
      sent_at: nowIso,
    })
    if (ok) anyOk = true
  }

  const email = booking.client_email?.trim() ?? ""
  if (content.sendEmail && email) {
    const ok = await persistFollowUpChannelLog(admin, booking, "email", email, {
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

async function alreadyNotified(admin: FollowUpLogAdmin, bookingId: string): Promise<boolean> {
  return hasNoShowFollowUpHistoryLog(admin, bookingId)
}

/**
 * Po oznaczeniu wizyty jako „nieobecność klienta” — SMS / e-mail follow-up.
 */
export async function notifyNoShowFollowUp(args: {
  booking: Tables<"bookings">
  business: BusinessRow
  language: NoShowFollowUpLanguage
}): Promise<{ notice: "sent" | "queued" | "skipped" }> {
  const admin = getServiceRoleClient()
  if (!admin) {
    console.error("[no-show-follow-up] service_role_missing")
    return { notice: "skipped" }
  }

  const { booking, business, language } = args
  const content = await buildNoShowFollowUpContent(admin, booking, business, language)
  if (!content.sendSms && !content.sendEmail) return { notice: "skipped" }

  if (await alreadyNotified(admin, booking.id)) return { notice: "skipped" }

  const nowIso = new Date().toISOString()
  let anySent = false
  let logsOk = true

  const phone = booking.client_phone?.trim() ?? ""
  if (content.sendSms && phone) {
    const smsRes = await sendPlainTransactionalSms({ to: phone, body: content.smsText })
    const status = mapChannelStatus(smsRes.ok, smsRes.ok ? undefined : smsRes.code)
    if (smsRes.ok) anySent = true
    const logged = await persistFollowUpChannelLog(admin, booking, "sms", phone, {
      status,
      subject: null,
      body: content.smsText,
      provider: smsRes.ok ? smsRes.provider : null,
      provider_message_id: smsRes.ok ? smsRes.messageId ?? null : null,
      error_message: smsRes.ok ? null : `${smsRes.code}${smsRes.error ? `: ${smsRes.error}` : ""}`,
      sent_at: smsRes.ok ? nowIso : null,
    })
    if (smsRes.ok && !logged) logsOk = false
  }

  const email = booking.client_email?.trim() ?? ""
  if (content.sendEmail && email) {
    const emailRes = await sendReminderEmail({
      to: email,
      subject: content.emailSubject,
      textBody: content.emailText,
      htmlBody: content.emailHtml,
    })
    const status = mapChannelStatus(emailRes.ok, emailRes.ok ? undefined : emailRes.code)
    if (emailRes.ok) anySent = true
    const logged = await persistFollowUpChannelLog(admin, booking, "email", email, {
      status,
      subject: content.emailSubject,
      body: content.emailText,
      provider: emailRes.ok ? emailRes.provider : null,
      provider_message_id: emailRes.ok ? emailRes.messageId ?? null : null,
      error_message: emailRes.ok ? null : `${emailRes.code}${emailRes.error ? `: ${emailRes.error}` : ""}`,
      sent_at: emailRes.ok ? nowIso : null,
    })
    if (emailRes.ok && !logged) logsOk = false
  }

  if (anySent && !logsOk) {
    console.error("[no-show-follow-up] sent_but_log_persist_failed", { bookingId: booking.id })
    await ensureNoShowFollowUpLogsInHistory(args)
  }

  return { notice: anySent ? "sent" : "queued" }
}
