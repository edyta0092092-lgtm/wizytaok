import { sendReminderEmail } from "@/lib/notifications/email"
import { sendReminderSms } from "@/lib/notifications/sms"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import { getStaffDisplayName, getStaffFirstName } from "@/lib/staff/staff-display"
import type { Tables, TablesInsert } from "@/types/database"

export type CancelNotifyLanguage = "pl" | "en"

type BusinessRow = Pick<Tables<"business_profiles">, "id" | "slug" | "phone" | "business_name">

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

function firstToken(name: string): string {
  const s = name.trim()
  if (!s) return ""
  return s.split(/\s+/)[0] ?? s
}

function formatDateLabel(ymd: string, lang: CancelNotifyLanguage): string {
  const raw = String(ymd).slice(0, 10)
  const [y, mo, d] = raw.split("-").map((x) => Number(x))
  if (!y || !mo || !d) return raw
  const dt = new Date(y, mo - 1, d)
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt)
}

function substituteTemplate(body: string, vars: Record<string, string>): string {
  let out = body
  for (const [key, val] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(val)
  }
  return out
}

function stripPhoneClauseWhenEmpty(sms: string, hasPhone: boolean, lang: CancelNotifyLanguage): string {
  if (hasPhone) return sms
  if (lang === "pl") {
    return sms
      .replace(/\s+lub skontaktuj\s+się\s+z\s+nami:[^\n.]*/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  }
  return sms
    .replace(/\s+or contact us at:[^\n.]*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function defaultCancellationCopy(
  lang: CancelNotifyLanguage,
): {
  sms: string
  emailSubject: string
  emailBody: string
} {
  if (lang === "en") {
    return {
      sms: "We're sorry — we cannot keep your appointment or the staff you selected will be unavailable. The visit was cancelled. Book again: {{link_rezerwacji}} or contact us: {{telefon_firmy}}",
      emailSubject: "Your appointment was cancelled",
      emailBody: `Hi {{imie}},

We're sorry — we cannot keep your appointment or the staff you selected will be unavailable.

The appointment has been cancelled in our system.

Please make a new booking here:
{{link_rezerwacji}}

You can also reach us by phone:
{{telefon_firmy}}

Regards,
{{nazwa_firmy}}`,
    }
  }
  return {
    sms: "Przepraszamy! Niestety nie możemy zrealizować Twojej wizyty lub osoba, którą wybrałeś do wykonania usługi, będzie niedostępna. Wizyta została anulowana. Dokonaj nowej rezerwacji: {{link_rezerwacji}} lub skontaktuj się z nami: {{telefon_firmy}}",
    emailSubject: "Twoja wizyta została anulowana",
    emailBody: `Cześć {{imie}},

przepraszamy, niestety nie możemy zrealizować Twojej wizyty lub osoba, którą wybrałeś do wykonania usługi, będzie niedostępna.

Wizyta w systemie została anulowana.

Prosimy o dokonanie nowej rezerwacji w systemie:
{{link_rezerwacji}}

Możesz też skontaktować się z nami telefonicznie:
{{telefon_firmy}}

Pozdrawiamy,
{{nazwa_firmy}}`,
  }
}

async function insertLog(
  row: Omit<TablesInsert<"notification_logs">, "business_id" | "booking_id"> & {
    business_id: string
    booking_id: string
  },
) {
  const admin = getServiceRoleClient()
  if (!admin) return
  await admin.from("notification_logs").insert(row)
}

/**
 * Po anulowaniu wizyty — szablony z DB lub domyślna treść; SMS/e-mail + wpisy notification_logs (service role).
 */
export async function notifyBookingCancelledByCompany(args: {
  booking: Tables<"bookings">
  business: BusinessRow
  language: CancelNotifyLanguage
  /** Gdy brak integracji dostawcy wiadomości trafiają jako queued. */
  messagesEffectivelySent: boolean
}): Promise<{ notice: "queued" | "sent" }> {
  const admin = getServiceRoleClient()
  const { booking, business, language } = args
  const appUrl = getPublicAppOrigin()
  const slug = typeof business.slug === "string" && business.slug.trim().length > 0 ? business.slug.trim() : ""
  const linkRezerwacji = slug ? `${appUrl}/rezerwacje/${encodeURIComponent(slug)}` : appUrl
  const phoneRaw = typeof business.phone === "string" ? business.phone.trim() : ""
  const phoneForTemplate = phoneRaw.length > 0 ? phoneRaw : ""
  const nazwa =
    typeof business.business_name === "string" && business.business_name.trim().length > 0
      ? business.business_name.trim()
      : ""
  const hasPhone = phoneForTemplate.length > 0

  const imie = firstToken(booking.client_name)
  const godzina = formatTimeHmFromDb(String(booking.appointment_time))
  const data = formatDateLabel(String(booking.appointment_date), language)
  const staffId =
    typeof (booking as { staff_id?: string | null }).staff_id === "string"
      ? ((booking as { staff_id?: string | null }).staff_id ?? "").trim()
      : ""
  let staffNameRel: string | null = null
  if (admin && staffId) {
    const { data: staff } = await admin.from("staff_members").select("name").eq("id", staffId).maybeSingle()
    staffNameRel = staff?.name?.trim() || null
  }
  const osoba = getStaffDisplayName({ name: staffNameRel ?? booking.staff_name ?? "" })
  const imieOsoby = getStaffFirstName({ name: staffNameRel ?? booking.staff_name ?? "" })

  const baseVars: Record<string, string> = {
    imie,
    link_rezerwacji: linkRezerwacji,
    telefon_firmy: phoneForTemplate,
    nazwa_firmy: nazwa,
    usluga: booking.service_name,
    data,
    godzina,
    osoba,
    imie_osoby: imieOsoby,
  }

  let smsTpl: string
  let emailSubjectTpl: string
  let emailBodyTpl: string

  if (admin) {
    const { data: rows } = await admin
      .from("message_templates")
      .select("*")
      .eq("business_id", business.id)
      .eq("type", "booking_cancelled_by_company")
      .eq("status", "active")

    const smsRow = (rows ?? []).find((r) => r.channel === "sms")
    const emailRow = (rows ?? []).find((r) => r.channel === "email")
    const defaults = defaultCancellationCopy(language)
    smsTpl = smsRow?.content?.trim() ? smsRow.content : defaults.sms
    if (emailRow?.title?.trim() && emailRow.content?.trim()) {
      emailSubjectTpl = emailRow.title.trim()
      emailBodyTpl = emailRow.content.trim()
    } else {
      emailSubjectTpl = defaults.emailSubject
      emailBodyTpl = defaults.emailBody
    }
  } else {
    const defaults = defaultCancellationCopy(language)
    smsTpl = defaults.sms
    emailSubjectTpl = defaults.emailSubject
    emailBodyTpl = defaults.emailBody
  }

  const smsBodyRaw = substituteTemplate(smsTpl, baseVars)
  const smsBody = stripPhoneClauseWhenEmpty(smsBodyRaw, hasPhone, language)
  const emailSubject = substituteTemplate(emailSubjectTpl, baseVars)
  let emailBody = substituteTemplate(emailBodyTpl, baseVars)
  if (!hasPhone) {
    if (language === "pl") {
      emailBody = emailBody.replace(
        /\n\nMożesz też skontaktować się z nami telefonicznie:[^\n]*(?:\n[^\n]+)*/,
        "\n\nSkontaktuj się bezpośrednio z firmą.",
      )
    } else {
      emailBody = emailBody.replace(
        /\n\nYou can also reach us by phone:[^\n]*(?:\n[^\n]+)*/,
        "\n\nPlease contact the business directly.",
      )
    }
    emailBody = emailBody.replace(/\n{3,}/g, "\n\n").trim()
  }

  const clientPhone = String(booking.client_phone ?? "").trim()
  const clientEmail = booking.client_email?.trim() ?? ""

  let anyRealSend = false

  if (clientPhone) {
    if (args.messagesEffectivelySent) {
      const smsRes = await sendReminderSms({ to: clientPhone, body: smsBody })
      const st: TablesInsert<"notification_logs">["status"] =
        smsRes.ok ? "sent" : smsRes.code === "not_configured" || smsRes.code === "simulated_dev" ? "queued" : "failed"
      if (smsRes.ok) anyRealSend = true
      await insertLog({
        business_id: booking.business_id,
        booking_id: booking.id,
        channel: "sms",
        type: "booking_cancelled_by_company",
        recipient: clientPhone,
        status: st,
        subject: null,
        body: smsBody,
        provider: smsRes.ok ? smsRes.provider : null,
        provider_message_id: smsRes.ok ? smsRes.messageId : null,
        error: smsRes.ok ? null : smsRes.error ?? smsRes.code ?? "send_failed",
        sent_at: smsRes.ok ? new Date().toISOString() : null,
      })
    } else {
      await insertLog({
        business_id: booking.business_id,
        booking_id: booking.id,
        channel: "sms",
        type: "booking_cancelled_by_company",
        recipient: clientPhone,
        status: "queued",
        subject: null,
        body: smsBody,
        provider: null,
        provider_message_id: null,
        error: null,
        sent_at: null,
      })
    }
  }

  if (clientEmail) {
    if (args.messagesEffectivelySent) {
      const em = await sendReminderEmail({
        to: clientEmail,
        subject: emailSubject,
        textBody: emailBody,
      })
      const st: TablesInsert<"notification_logs">["status"] =
        em.ok ? "sent" : em.code === "not_configured" || em.code === "simulated_dev" ? "queued" : "failed"
      if (em.ok) anyRealSend = true
      await insertLog({
        business_id: booking.business_id,
        booking_id: booking.id,
        channel: "email",
        type: "booking_cancelled_by_company",
        recipient: clientEmail,
        status: st,
        subject: emailSubject,
        body: emailBody,
        provider: em.ok ? em.provider : null,
        provider_message_id: em.ok ? em.messageId : null,
        error: em.ok ? null : em.error ?? em.code ?? "send_failed",
        sent_at: em.ok ? new Date().toISOString() : null,
      })
    } else {
      await insertLog({
        business_id: booking.business_id,
        booking_id: booking.id,
        channel: "email",
        type: "booking_cancelled_by_company",
        recipient: clientEmail,
        status: "queued",
        subject: emailSubject,
        body: emailBody,
        provider: null,
        provider_message_id: null,
        error: null,
        sent_at: null,
      })
    }
  }

  const notice: "queued" | "sent" =
    args.messagesEffectivelySent && anyRealSend ? "sent" : "queued"
  return { notice }
}

export function inferMessagesEffectivelySent(): boolean {
  const twilio =
    Boolean(process.env.TWILIO_ACCOUNT_SID?.trim()) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN?.trim()) &&
    Boolean(process.env.TWILIO_FROM_NUMBER?.trim())
  const email = Boolean(process.env.RESEND_API_KEY?.trim()) && Boolean(process.env.RESEND_FROM?.trim())
  return twilio || email
}
