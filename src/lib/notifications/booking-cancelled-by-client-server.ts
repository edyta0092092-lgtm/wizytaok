import { sendReminderEmail } from "@/lib/notifications/email"
import { sendReminderSms } from "@/lib/notifications/sms"
import { applyTemplateVariables, getTemplateRuntime } from "@/lib/notifications/template-runtime"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import { getStaffDisplayName, getStaffFirstName } from "@/lib/staff/staff-display"
import type { Tables, TablesInsert } from "@/types/database"

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

async function insertLog(row: TablesInsert<"notification_logs">) {
  const admin = getServiceRoleClient()
  if (!admin) return
  await admin.from("notification_logs").insert(row)
}

export async function notifyBookingCancelledByClient(args: {
  booking: Tables<"bookings">
  business: Pick<Tables<"business_profiles">, "slug" | "phone" | "business_name">
  language: "pl" | "en"
}) {
  const admin = getServiceRoleClient()
  if (!admin) return { notice: "queued" as const }
  const booking = args.booking
  const template = await getTemplateRuntime(admin, booking.business_id, "booking_cancelled_by_client")
  const appUrl = getPublicAppOrigin()
  const slug = args.business.slug?.trim() || ""
  const linkBooking = slug ? `${appUrl}/book/${encodeURIComponent(slug)}` : appUrl
  const confirmUrl = `${appUrl}/confirm/${encodeURIComponent(booking.confirmation_token)}`
  const staffId =
    typeof (booking as { staff_id?: string | null }).staff_id === "string"
      ? ((booking as { staff_id?: string | null }).staff_id ?? "").trim()
      : ""
  let staffNameRel: string | null = null
  if (staffId) {
    const { data: staff } = await admin.from("staff_members").select("name").eq("id", staffId).maybeSingle()
    staffNameRel = staff?.name?.trim() || null
  }
  const staffDisplayName = getStaffDisplayName({ name: staffNameRel ?? booking.staff_name ?? "" })
  const staffFirstName = getStaffFirstName({ name: staffNameRel ?? booking.staff_name ?? "" })
  const vars = {
    imie: firstToken(booking.client_name),
    data: String(booking.appointment_date).slice(0, 10),
    godzina: formatTimeHmFromDb(String(booking.appointment_time)),
    usluga: booking.service_name,
    osoba: staffDisplayName,
    imie_osoby: staffFirstName,
    link_rezerwacji: linkBooking,
    link_potwierdzenia: confirmUrl,
    link_anulowania: confirmUrl,
    telefon_firmy: args.business.phone?.trim() || "",
    nazwa_firmy: args.business.business_name?.trim() || "",
  }

  const smsFallback =
    "Twoja wizyta została anulowana. Możesz dokonać nowej rezerwacji tutaj: {{link_rezerwacji}}. Kontakt: {{telefon_firmy}}"
  const emailSubjectFallback = "Potwierdzenie anulowania wizyty"
  const emailBodyFallback = `Cześć {{imie}},

potwierdzamy anulowanie Twojej wizyty:

Usługa: {{usluga}}
Data: {{data}}
Godzina: {{godzina}}

Jeśli chcesz, możesz dokonać nowej rezerwacji:
{{link_rezerwacji}}

Kontakt:
{{telefon_firmy}}

Pozdrawiamy,
{{nazwa_firmy}}`

  const smsBody = applyTemplateVariables(template.smsBody || smsFallback, vars)
  const emailSubject = applyTemplateVariables(template.emailSubject || emailSubjectFallback, vars)
  const emailBody = applyTemplateVariables(template.emailBody || emailBodyFallback, vars)

  let anySent = false
  const nowIso = new Date().toISOString()
  if (template.smsEnabled && booking.client_phone?.trim()) {
    const sms = await sendReminderSms({ to: booking.client_phone.trim(), body: smsBody })
    const status = sms.ok ? "sent" : sms.code === "simulated_dev" || sms.code === "not_configured" ? "queued" : "failed"
    if (sms.ok) anySent = true
    await insertLog({
      business_id: booking.business_id,
      booking_id: booking.id,
      channel: "sms",
      type: "booking_cancelled_by_client",
      recipient: booking.client_phone.trim(),
      status,
      subject: null,
      body: smsBody,
      provider: sms.ok ? sms.provider : null,
      provider_message_id: sms.ok ? sms.messageId ?? null : null,
      error: sms.ok ? null : sms.error ?? sms.code,
      sent_at: sms.ok ? nowIso : null,
    })
  }
  if (template.emailEnabled && booking.client_email?.trim()) {
    const email = await sendReminderEmail({
      to: booking.client_email.trim(),
      subject: emailSubject,
      textBody: emailBody,
    })
    const status =
      email.ok ? "sent" : email.code === "simulated_dev" || email.code === "not_configured" ? "queued" : "failed"
    if (email.ok) anySent = true
    await insertLog({
      business_id: booking.business_id,
      booking_id: booking.id,
      channel: "email",
      type: "booking_cancelled_by_client",
      recipient: booking.client_email.trim(),
      status,
      subject: emailSubject,
      body: emailBody,
      provider: email.ok ? email.provider : null,
      provider_message_id: email.ok ? email.messageId ?? null : null,
      error: email.ok ? null : email.error ?? email.code,
      sent_at: email.ok ? nowIso : null,
    })
  }
  return { notice: anySent ? ("sent" as const) : ("queued" as const) }
}
