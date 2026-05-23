import { sendReminderEmail } from "@/lib/notifications/email"
import { sendReminderSms } from "@/lib/notifications/sms"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { TablesInsert } from "@/types/database"

type BookingPayload = {
  id: string
  business_id: string
  confirmation_token: string
  business_slug: string
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

function formatTimeHmFromDb(t: string): string {
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "09:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
}

function buildMessages(
  booking: BookingPayload,
  language: "pl" | "en",
  confirmUrl: string
): { sms: string; emailSubject: string; emailText: string; emailHtml: string } {
  const timeHm = formatTimeHmFromDb(booking.appointment_time)
  const dateLabel = String(booking.appointment_date).slice(0, 10)
  const name = booking.client_name
  const service = booking.service_name
  if (language === "en") {
    return {
      sms: `Thank you ${name}. Your appointment on ${dateLabel} at ${timeHm} is confirmed. Manage your appointment or cancel here: ${confirmUrl}`,
      emailSubject: "Appointment confirmed",
      emailText: `Thank you ${name},\n\nYour appointment is confirmed.\n\nService: ${service}\nTime: ${dateLabel} at ${timeHm}\n\nManage your appointment:\n${confirmUrl}\n\nUse this link to view appointment details or cancel your visit.`,
      emailHtml: `<p>Thank you ${name},</p><p>Your appointment is confirmed.</p><p>Service: <strong>${service}</strong><br/>Time: ${dateLabel} at ${timeHm}</p><p><a href="${confirmUrl}">Manage your appointment</a></p><p>Use this link to view appointment details or cancel your visit.</p>`,
    }
  }
  return {
    sms: `Dziękujemy ${name}. Twoja wizyta ${dateLabel} o ${timeHm} jest potwierdzona. Zarządzaj wizytą lub anuluj ją tutaj: ${confirmUrl}`,
    emailSubject: "Wizyta potwierdzona",
    emailText: `Dziękujemy ${name},\n\nTwoja wizyta jest potwierdzona.\n\nUsługa: ${service}\nTermin: ${dateLabel} o ${timeHm}\n\nZarządzaj wizytą:\n${confirmUrl}\n\nPod tym linkiem możesz sprawdzić szczegóły wizyty lub anulować wizytę.`,
    emailHtml: `<p>Dziękujemy ${name},</p><p>Twoja wizyta jest potwierdzona.</p><p>Usługa: <strong>${service}</strong><br/>Termin: ${dateLabel} o ${timeHm}</p><p><a href="${confirmUrl}">Zarządzaj wizytą</a></p><p>Pod tym linkiem możesz sprawdzić szczegóły wizyty lub anulować wizytę.</p>`,
  }
}

async function insertNotificationLog(
  booking: BookingPayload,
  row: Omit<TablesInsert<"notification_logs">, "business_id" | "booking_id" | "type">
) {
  const admin = getServiceRoleClient()
  if (!admin) return
  const payload: TablesInsert<"notification_logs"> = {
    business_id: booking.business_id,
    booking_id: booking.id,
    type: "booking_confirmed",
    ...row,
  }
  const { error } = await admin.from("notification_logs").insert(payload)
  // Ignore duplicates from re-click (unique booking_id+type+channel).
  if (error && error.code !== "23505") {
    throw new Error(error.message)
  }
}

export async function confirmBookingAndNotify(
  token: string,
  language: "pl" | "en"
): Promise<{ ok: boolean; error?: string; sms: string; email: string }> {
  const admin = getServiceRoleClient()
  if (!admin) return { ok: false, error: "service_role_missing", sms: "failed", email: "failed" }

  const trimmed = token.trim()
  if (!trimmed) return { ok: false, error: "token_required", sms: "failed", email: "failed" }

  const { data: updateData, error: updateErr } = await admin.rpc("update_booking_by_confirmation_token", {
    p_token: trimmed,
    p_action: "confirm",
    p_payload: {},
  })
  let confirmOk = !updateErr
  const updateObj = (updateData ?? null) as { ok?: boolean; error?: string } | null
  if (!updateObj?.ok) confirmOk = false

  if (!confirmOk) {
    // Compatibility fallback: if RPC fails (e.g. legacy token type mismatch),
    // resolve booking by token and update row directly with service-role client.
    const { data: bookingForUpdateRaw, error: bookingForUpdateErr } = await admin.rpc(
      "get_booking_by_confirmation_token",
      { p_token: trimmed }
    )
    if (bookingForUpdateErr || !bookingForUpdateRaw || typeof bookingForUpdateRaw !== "object") {
      return {
        ok: false,
        error: updateErr?.message ?? updateObj?.error ?? bookingForUpdateErr?.message ?? "confirm_failed",
        sms: "failed",
        email: "failed",
      }
    }
    const row = bookingForUpdateRaw as Record<string, unknown>
    const bookingId = String(row.id ?? "").trim()
    if (!bookingId) {
      return {
        ok: false,
        error: updateErr?.message ?? updateObj?.error ?? "confirm_failed",
        sms: "failed",
        email: "failed",
      }
    }
    const nowIso = new Date().toISOString()
    const { error: directUpdateErr } = await admin
      .from("bookings")
      .update({
        status: "confirmed",
        last_updated_by: "customer",
        last_status_change_source: "confirm",
        last_change_type: null,
        updated_at: nowIso,
      })
      .eq("id", bookingId)
    if (directUpdateErr) {
      return {
        ok: false,
        error: directUpdateErr.message,
        sms: "failed",
        email: "failed",
      }
    }
  }

  const { data: bookingRaw, error: bookingErr } = await admin.rpc("get_booking_by_confirmation_token", {
    p_token: trimmed,
  })
  if (bookingErr) return { ok: false, error: bookingErr.message, sms: "failed", email: "failed" }
  if (!bookingRaw || typeof bookingRaw !== "object") {
    return { ok: false, error: "booking_not_found", sms: "failed", email: "failed" }
  }
  const o = bookingRaw as Record<string, unknown>
  const booking: BookingPayload = {
    id: String(o.id ?? ""),
    business_id: String(o.business_id ?? ""),
    confirmation_token: String(o.confirmation_token ?? ""),
    business_slug: String(o.business_slug ?? ""),
    service_name: String(o.service_name ?? ""),
    appointment_date: String(o.appointment_date ?? ""),
    appointment_time: String(o.appointment_time ?? ""),
    client_name: String(o.client_name ?? ""),
    client_phone: typeof o.client_phone === "string" ? o.client_phone : null,
    client_email: typeof o.client_email === "string" ? o.client_email : null,
  }

  const confirmUrl = `${getPublicAppOrigin()}/confirm/${encodeURIComponent(booking.confirmation_token || booking.id)}`
  const messages = buildMessages(booking, language, confirmUrl)
  const nowIso = new Date().toISOString()

  let smsStatus = "skipped"
  let emailStatus = "skipped"

  if (booking.client_phone?.trim()) {
    const sms = await sendReminderSms({ to: booking.client_phone.trim(), body: messages.sms })
    smsStatus = sms.ok ? "sent" : sms.code
    await insertNotificationLog(booking, {
      channel: "sms",
      status: smsStatus,
      recipient: booking.client_phone.trim(),
      subject: null,
      body: messages.sms,
      provider: sms.ok ? sms.provider : null,
      provider_message_id: sms.ok ? sms.messageId ?? null : null,
      error_message: sms.ok ? null : sms.error ?? sms.code,
      sent_at: nowIso,
    })
  }

  if (booking.client_email?.trim()) {
    const email = await sendReminderEmail({
      to: booking.client_email.trim(),
      subject: messages.emailSubject,
      textBody: messages.emailText,
      htmlBody: messages.emailHtml,
    })
    emailStatus = email.ok ? "sent" : email.code
    await insertNotificationLog(booking, {
      channel: "email",
      status: emailStatus,
      recipient: booking.client_email.trim(),
      subject: messages.emailSubject,
      body: messages.emailText,
      provider: email.ok ? email.provider : null,
      provider_message_id: email.ok ? email.messageId ?? null : null,
      error_message: email.ok ? null : email.error ?? email.code,
      sent_at: nowIso,
    })
  }

  return { ok: true, sms: smsStatus, email: emailStatus }
}
