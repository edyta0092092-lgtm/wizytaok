import { sendReminderEmail } from "@/lib/notifications/email"
import { buildBusinessTemplateVars } from "@/lib/notifications/business-template-vars"
import { plainTextEmailToHtml } from "@/lib/notifications/plain-text-email-html"
import {
  insertNotificationLog,
  upsertSentNotificationLog,
} from "@/lib/notifications/notification-log-insert"
import {
  applyTemplateVariables,
  getTemplateRuntime,
} from "@/lib/notifications/template-runtime"
import { sendPlainTransactionalSms } from "@/lib/notifications/transactional-sms"
import { getStaffDisplayName } from "@/lib/staff/staff-display"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Tables, TablesInsert } from "@/types/database"

export type ThankYouAfterVisitLanguage = "pl" | "en"

type BusinessRow = Pick<
  Tables<"business_profiles">,
  "id" | "slug" | "phone" | "contact_phone" | "business_name" | "business_address"
>

export const THANK_YOU_AFTER_VISIT_LOG_TYPE = "thank_you_after_visit" as const

const DEFAULTS = {
  pl: {
    sms: "Cześć {{imie}}, dziękujemy za skorzystanie z naszych usług. Jeśli potrzebujesz, zapraszamy ponownie: {{link_rezerwacji}}. Pozdrawiamy, {{nazwa_firmy}}",
    emailSubject: "{{nazwa_firmy}}: Dziękujemy za wizytę",
    emailBody: `Cześć {{imie}},

dziękujemy za skorzystanie z naszych usług. Jeśli potrzebujesz, zapraszamy ponownie:
{{link_rezerwacji}}

Pozdrawiamy,
{{nazwa_firmy}}`,
  },
  en: {
    sms: "Hi {{imie}}, thank you for visiting us. Book again anytime: {{link_rezerwacji}}. Best regards, {{nazwa_firmy}}",
    emailSubject: "{{nazwa_firmy}}: Thank you for your visit",
    emailBody: `Hi {{imie}},

thank you for visiting us. If you need another appointment:
{{link_rezerwacji}}

Best regards,
{{nazwa_firmy}}`,
  },
} as const

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

type LogAdmin = NonNullable<ReturnType<typeof getServiceRoleClient>>

async function persistThankYouChannelLog(
  admin: LogAdmin,
  booking: Tables<"bookings">,
  channel: "sms" | "email",
  recipient: string,
  patch: {
    status: TablesInsert<"notification_logs">["status"]
    subject?: string | null
    body?: string | null
    provider?: string | null
    provider_message_id?: string | null
    error_message?: string | null
    sent_at?: string | null
  },
): Promise<void> {
  const logRow = {
    business_id: booking.business_id,
    booking_id: booking.id,
    channel,
    type: THANK_YOU_AFTER_VISIT_LOG_TYPE,
    recipient,
    status: patch.status,
    subject: patch.subject ?? null,
    body: patch.body ?? null,
    provider: patch.provider ?? null,
    provider_message_id: patch.provider_message_id ?? null,
    error_message: patch.error_message ?? null,
    sent_at: patch.sent_at ?? null,
  }
  const result =
    patch.status === "sent"
      ? await upsertSentNotificationLog(admin, logRow, "[thank-you-after-visit.log]")
      : await insertNotificationLog(admin, logRow, "[thank-you-after-visit.log]")
  if (!result.ok) {
    console.error("[thank-you-after-visit.log] insert_failed", {
      booking_id: booking.id,
      channel,
      message: result.message,
      code: result.code,
    })
  }
}

async function alreadyThanked(
  admin: LogAdmin,
  bookingId: string,
): Promise<boolean> {
  const { count } = await admin
    .from("notification_logs")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("type", THANK_YOU_AFTER_VISIT_LOG_TYPE)
    .eq("status", "sent")
  return (count ?? 0) > 0
}

/** Usuwa niedokończone wpisy (np. skipped przez trigger statusu końcowego) przed ponowną wysyłką. */
async function clearStaleThankYouLogs(admin: LogAdmin, bookingId: string): Promise<void> {
  await admin
    .from("notification_logs")
    .delete()
    .eq("booking_id", bookingId)
    .eq("type", THANK_YOU_AFTER_VISIT_LOG_TYPE)
    .in("status", ["queued", "skipped", "pending"])
}

/**
 * Po oznaczeniu wizyty jako zrealizowana — SMS/e-mail z podziękowaniem
 * (szablon z sekcji „Szablony wiadomości”, typ thank_you_after_visit).
 */
export async function notifyThankYouAfterVisit(args: {
  booking: Tables<"bookings">
  business: BusinessRow
  language: ThankYouAfterVisitLanguage
}): Promise<{ notice: "sent" | "queued" | "skipped" }> {
  const admin = getServiceRoleClient()
  if (!admin) {
    console.error("[thank-you-after-visit] service_role_missing")
    return { notice: "skipped" }
  }

  const { booking, business, language } = args
  const runtime = await getTemplateRuntime(admin, business.id, THANK_YOU_AFTER_VISIT_LOG_TYPE)
  const sendSms = runtime.smsExists ? runtime.smsEnabled : true
  const sendEmail = runtime.emailExists ? runtime.emailEnabled : true
  if (!sendSms && !sendEmail) return { notice: "skipped" }

  if (await alreadyThanked(admin, booking.id)) return { notice: "skipped" }
  await clearStaleThankYouLogs(admin, booking.id)

  const staffId =
    typeof (booking as { staff_id?: string | null }).staff_id === "string"
      ? ((booking as { staff_id?: string | null }).staff_id ?? "").trim()
      : ""
  let staffNameRel: string | null = null
  if (staffId) {
    const { data: staff } = await admin
      .from("staff_members")
      .select("name")
      .eq("id", staffId)
      .maybeSingle()
    staffNameRel = staff?.name?.trim() || null
  }

  const appUrl = getPublicAppOrigin()
  const slug = business.slug?.trim() ?? ""
  const linkRezerwacji = slug ? `${appUrl}/rezerwacje/${encodeURIComponent(slug)}` : appUrl
  const confirmPath = `${appUrl}/confirm/${encodeURIComponent(booking.confirmation_token)}`
  const vars: Record<string, string> = {
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

  const defaults = DEFAULTS[language] ?? DEFAULTS.pl
  const smsText = applyTemplateVariables(runtime.smsBody?.trim() || defaults.sms, vars)
  const emailSubject = applyTemplateVariables(runtime.emailSubject?.trim() || defaults.emailSubject, vars)
  const emailText = applyTemplateVariables(runtime.emailBody?.trim() || defaults.emailBody, vars)
  const emailHtml = plainTextEmailToHtml(emailText)

  const nowIso = new Date().toISOString()
  let anySent = false

  const phone = booking.client_phone?.trim() ?? ""
  if (sendSms && phone) {
    const smsRes = await sendPlainTransactionalSms({ to: phone, body: smsText })
    const status = mapChannelStatus(smsRes.ok, smsRes.ok ? undefined : smsRes.code)
    if (smsRes.ok) anySent = true
    await persistThankYouChannelLog(admin, booking, "sms", phone, {
      status,
      subject: null,
      body: smsText,
      provider: smsRes.ok ? smsRes.provider : null,
      provider_message_id: smsRes.ok ? smsRes.messageId ?? null : null,
      error_message: smsRes.ok ? null : `${smsRes.code}${smsRes.error ? `: ${smsRes.error}` : ""}`,
      sent_at: smsRes.ok ? nowIso : null,
    })
  }

  const email = booking.client_email?.trim() ?? ""
  if (sendEmail && email) {
    const emailRes = await sendReminderEmail({
      to: email,
      subject: emailSubject,
      textBody: emailText,
      htmlBody: emailHtml,
    })
    const status = mapChannelStatus(emailRes.ok, emailRes.ok ? undefined : emailRes.code)
    if (emailRes.ok) anySent = true
    await persistThankYouChannelLog(admin, booking, "email", email, {
      status,
      subject: emailSubject,
      body: emailText,
      provider: emailRes.ok ? emailRes.provider : null,
      provider_message_id: emailRes.ok ? emailRes.messageId ?? null : null,
      error_message: emailRes.ok ? null : `${emailRes.code}${emailRes.error ? `: ${emailRes.error}` : ""}`,
      sent_at: emailRes.ok ? nowIso : null,
    })
  }

  return { notice: anySent ? "sent" : "queued" }
}
