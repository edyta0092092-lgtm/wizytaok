import { sendReminderEmail } from "@/lib/notifications/email"
import { buildBusinessTemplateVars } from "@/lib/notifications/business-template-vars"
import { plainTextEmailToHtml } from "@/lib/notifications/plain-text-email-html"
import {
  applyTemplateVariables,
  getTemplateRuntime,
} from "@/lib/notifications/template-runtime"
import { sendPlainTransactionalSms } from "@/lib/notifications/transactional-sms"
import { getStaffDisplayName } from "@/lib/staff/staff-display"
import { insertNotificationLog } from "@/lib/notifications/notification-log-insert"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Tables, TablesInsert } from "@/types/database"

export type NoShowFollowUpLanguage = "pl" | "en"

type BusinessRow = Pick<
  Tables<"business_profiles">,
  "id" | "slug" | "phone" | "contact_phone" | "business_name" | "business_address"
>

const LOG_TYPE = "no_show_follow_up"

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

/**
 * Sprawdza, czy follow-up po nieobecności był już wysłany dla tej wizyty —
 * zabezpiecza przed ponowną wysyłką przy kolejnym oznaczeniu „nieobecność”.
 */
async function alreadyNotified(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  bookingId: string
): Promise<boolean> {
  const { count } = await admin
    .from("notification_logs")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("type", LOG_TYPE)
    .in("status", ["sent", "queued"])
  return (count ?? 0) > 0
}

/**
 * Po oznaczeniu wizyty jako „nieobecność klienta” — SMS / e-mail follow-up.
 *
 * Wysyłka wyłącznie, gdy firma ma zapisany i WŁĄCZONY szablon dla danego
 * kanału (`no_show_follow_up`). Brak szablonu = brak wysyłki (kanały domyślnie
 * wyłączone), zgodnie z UI edytora szablonów.
 */
export async function notifyNoShowFollowUp(args: {
  booking: Tables<"bookings">
  business: BusinessRow
  language: NoShowFollowUpLanguage
}): Promise<{ notice: "sent" | "queued" | "skipped" }> {
  const admin = getServiceRoleClient()
  if (!admin) return { notice: "skipped" }
  const { booking, business, language } = args

  const runtime = await getTemplateRuntime(admin, business.id, LOG_TYPE)
  // Domyślnie WYŁĄCZONE: wysyłamy tylko, gdy istnieje aktywny szablon kanału.
  const sendSms = runtime.smsExists ? runtime.smsEnabled : false
  const sendEmail = runtime.emailExists ? runtime.emailEnabled : false
  if (!sendSms && !sendEmail) return { notice: "skipped" }

  if (await alreadyNotified(admin, booking.id)) return { notice: "skipped" }

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
  const smsTemplate = runtime.smsBody?.trim() || defaults.sms
  const emailSubjectTemplate = runtime.emailSubject?.trim() || defaults.emailSubject
  const emailBodyTemplate = runtime.emailBody?.trim() || defaults.emailBody

  const smsText = applyTemplateVariables(smsTemplate, vars)
  const emailSubject = applyTemplateVariables(emailSubjectTemplate, vars)
  const emailText = applyTemplateVariables(emailBodyTemplate, vars)
  const emailHtml = plainTextEmailToHtml(emailText)

  const nowIso = new Date().toISOString()
  let anySent = false

  const phone = booking.client_phone?.trim() ?? ""
  if (sendSms && phone) {
    const smsRes = await sendPlainTransactionalSms({ to: phone, body: smsText })
    if (smsRes.ok) anySent = true
    await insertNotificationLog(
      admin,
      {
        business_id: booking.business_id,
        booking_id: booking.id,
        channel: "sms",
        type: LOG_TYPE,
        recipient: phone,
        status: mapChannelStatus(smsRes.ok, smsRes.ok ? undefined : smsRes.code),
        subject: null,
        body: smsText,
        provider: smsRes.ok ? smsRes.provider : null,
        provider_message_id: smsRes.ok ? smsRes.messageId ?? null : null,
        error: smsRes.ok ? null : `${smsRes.code}${smsRes.error ? `: ${smsRes.error}` : ""}`,
        sent_at: smsRes.ok ? nowIso : null,
      },
      "[no-show-follow-up.log]"
    )
  }

  const email = booking.client_email?.trim() ?? ""
  if (sendEmail && email) {
    const emailRes = await sendReminderEmail({
      to: email,
      subject: emailSubject,
      textBody: emailText,
      htmlBody: emailHtml,
    })
    if (emailRes.ok) anySent = true
    await insertNotificationLog(
      admin,
      {
        business_id: booking.business_id,
        booking_id: booking.id,
        channel: "email",
        type: LOG_TYPE,
        recipient: email,
        status: mapChannelStatus(emailRes.ok, emailRes.ok ? undefined : emailRes.code),
        subject: emailSubject,
        body: emailText,
        provider: emailRes.ok ? emailRes.provider : null,
        provider_message_id: emailRes.ok ? emailRes.messageId ?? null : null,
        error: emailRes.ok ? null : `${emailRes.code}${emailRes.error ? `: ${emailRes.error}` : ""}`,
        sent_at: emailRes.ok ? nowIso : null,
      },
      "[no-show-follow-up.log]"
    )
  }

  return { notice: anySent ? "sent" : "queued" }
}
