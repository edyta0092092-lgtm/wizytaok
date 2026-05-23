import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { TablesInsert, TablesUpdate } from "@/types/database"

import { sendReminderEmail } from "@/lib/notifications/email"
import { sendReminderSms } from "@/lib/notifications/sms"

type BusinessProfileJoin = {
  reminder_channel: string | null
  slug: string | null
} | null

type DueBookingRow = {
  id: string
  business_id: string
  confirmation_token: string
  client_name: string
  client_phone: string | null
  client_email: string | null
  service_name: string
  appointment_date: string
  appointment_time: string
  reminder_due_at: string | null
  reminder_status: string | null
  business_profiles: BusinessProfileJoin
}

function getPublicAppOrigin(): string {
  const explicit = process.env.APP_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    const v = vercel.replace(/^https?:\/\//, "")
    return `https://${v}`
  }
  return "http://localhost:3000"
}

function normalizeTimeForDate(t: string): string {
  const s = String(t).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return "00:00:00"
  const h = Math.min(23, Math.max(0, Number(m[1])))
  const min = Math.min(59, Math.max(0, Number(m[2])))
  const sec = m[3] != null ? Math.min(59, Math.max(0, Number(m[3]))) : 0
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

function appointmentStartsAtMs(row: DueBookingRow): number {
  const d = String(row.appointment_date).slice(0, 10)
  const t = normalizeTimeForDate(row.appointment_time)
  const dt = new Date(`${d}T${t}`)
  return dt.getTime()
}

function reminderLocale(): "pl" | "en" {
  return process.env.REMINDER_LOCALE?.trim().toLowerCase() === "en" ? "en" : "pl"
}

function formatDateLabel(isoDate: string, lang: "pl" | "en"): string {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

function formatTimeHmFromDb(t: string): string {
  const s = String(t).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "09:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
}

function buildReminderBodies(input: {
  lang: "pl" | "en"
  clientName: string
  serviceName: string
  dateLabel: string
  timeHm: string
  confirmUrl: string
}): { subject: string; text: string; html: string } {
  if (input.lang === "en") {
    const subject = "Appointment reminder"
    const text = `Hi ${input.clientName}, this is a reminder for your appointment: ${input.serviceName} on ${input.dateLabel} at ${input.timeHm}. Confirm, reschedule or cancel here: ${input.confirmUrl}`
    const html = `<p>Hi ${escapeHtml(input.clientName)},</p><p>This is a reminder for your appointment: <strong>${escapeHtml(
      input.serviceName
    )}</strong> on ${escapeHtml(input.dateLabel)} at ${escapeHtml(input.timeHm)}.</p><p><a href="${escapeHtml(
      input.confirmUrl
    )}">Confirm, reschedule or cancel</a></p>`
    return { subject, text, html }
  }
  const subject = "Przypomnienie o wizycie"
  const text = `Cześć ${input.clientName}, przypominamy o wizycie: ${input.serviceName} dnia ${input.dateLabel} o ${input.timeHm}. Zarządzaj wizytą lub anuluj ją tutaj: ${input.confirmUrl}`
  const html = `<p>Cześć ${escapeHtml(input.clientName)},</p><p>Przypominamy o wizycie: <strong>${escapeHtml(
    input.serviceName
  )}</strong> dnia ${escapeHtml(input.dateLabel)} o ${escapeHtml(input.timeHm)}.</p><p><a href="${escapeHtml(
    input.confirmUrl
  )}">Anuluj wizytę, jeśli nie możesz przyjść</a></p>`
  return { subject, text, html }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function smsBody(lang: "pl" | "en", service: string, dateLabel: string, timeHm: string, url: string): string {
  if (lang === "en") {
    return `Reminder: ${service} ${dateLabel} at ${timeHm}. Confirm, reschedule or cancel: ${url}`
  }
  return `Przypomnienie o wizycie: ${service}, ${dateLabel} o ${timeHm}. Zarządzaj wizytą lub anuluj ją tutaj: ${url}`
}

async function insertNotificationLog(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  row: {
    business_id: string
    booking_id: string
    channel: "sms" | "email"
    status: string
    recipient: string | null
    subject: string | null
    body: string | null
    provider: string | null
    provider_message_id: string | null
    error: string | null
    sent_at: string | null
  }
): Promise<void> {
  const ins: TablesInsert<"notification_logs"> = {
    business_id: row.business_id,
    booking_id: row.booking_id,
    channel: row.channel,
    type: "reminder_24h",
    recipient: row.recipient,
    status: row.status,
    subject: row.subject,
    body: row.body,
    provider: row.provider,
    provider_message_id: row.provider_message_id,
    error: row.error,
    sent_at: row.sent_at,
  }
  await admin.from("notification_logs").insert(ins)
}

async function processOneBooking(admin: NonNullable<ReturnType<typeof getServiceRoleClient>>, row: DueBookingRow) {
  const nowIso = new Date().toISOString()
  const lang = reminderLocale()
  const origin = getPublicAppOrigin()
  const confirmPath = `/confirm/${encodeURIComponent(row.confirmation_token)}`
  const confirmUrl = `${origin}${confirmPath}`

  const dateStr = String(row.appointment_date).slice(0, 10)
  const timeHm = formatTimeHmFromDb(row.appointment_time)
  const dateLabel = formatDateLabel(dateStr, lang)
  const { subject, text, html } = buildReminderBodies({
    lang,
    clientName: row.client_name,
    serviceName: row.service_name,
    dateLabel,
    timeHm,
    confirmUrl,
  })
  const smsText = smsBody(lang, row.service_name, dateLabel, timeHm, confirmUrl)

  const emailTrim = row.client_email?.trim() ?? ""
  const phoneTrim = row.client_phone?.trim() ?? ""
  const hasEmail = Boolean(emailTrim)
  const hasPhone = Boolean(phoneTrim)

  if (!hasEmail && !hasPhone) {
    await insertNotificationLog(admin, {
      business_id: row.business_id,
      booking_id: row.id,
      channel: "email",
      status: "skipped",
      recipient: null,
      subject,
      body: text,
      provider: null,
      provider_message_id: null,
      error: "Missing client contact details",
      sent_at: nowIso,
    })
    const noContact: TablesUpdate<"bookings"> = {
      reminder_sent_at: nowIso,
      reminder_status: "skipped",
      reminder_error: "Missing client contact details",
      last_updated_by: "system",
      last_change_type: null,
      last_status_change_source: null,
      updated_at: nowIso,
    }
    await admin.from("bookings").update(noContact).eq("id", row.id)
    return
  }

  const ch = row.business_profiles?.reminder_channel ?? "both"
  const wantEmail = ch === "email" || ch === "both"
  const wantSms = ch === "sms" || ch === "both"

  type ChannelResult = {
    channel: "email" | "sms"
    logStatus: string
    error: string | null
  }

  const results: ChannelResult[] = []

  if (wantEmail) {
    if (!hasEmail) {
      await insertNotificationLog(admin, {
        business_id: row.business_id,
        booking_id: row.id,
        channel: "email",
        status: "skipped",
        recipient: null,
        subject,
        body: text,
        provider: null,
        provider_message_id: null,
        error: "Email skipped: missing client email",
        sent_at: nowIso,
      })
      results.push({
        channel: "email",
        logStatus: "skipped",
        error: "skipped",
      })
    } else {
      const r = await sendReminderEmail({ to: emailTrim, subject, textBody: text, htmlBody: html })
      if (r.ok) {
        await insertNotificationLog(admin, {
          business_id: row.business_id,
          booking_id: row.id,
          channel: "email",
          status: "sent",
          recipient: emailTrim,
          subject,
          body: text,
          provider: r.provider,
          provider_message_id: r.messageId ?? null,
          error: null,
          sent_at: nowIso,
        })
        results.push({
          channel: "email",
          logStatus: "sent",
          error: null,
        })
      } else {
        const logStatus = r.code === "simulated_dev" ? "simulated_dev" : r.code === "not_configured" ? "not_configured" : "failed"
        await insertNotificationLog(admin, {
          business_id: row.business_id,
          booking_id: row.id,
          channel: "email",
          status: logStatus,
          recipient: emailTrim,
          subject,
          body: text,
          provider: null,
          provider_message_id: null,
          error: r.error ?? r.code,
          sent_at: nowIso,
        })
        results.push({
          channel: "email",
          logStatus,
          error: r.error ?? r.code,
        })
      }
    }
  }

  if (wantSms) {
    if (!hasPhone) {
      await insertNotificationLog(admin, {
        business_id: row.business_id,
        booking_id: row.id,
        channel: "sms",
        status: "skipped",
        recipient: null,
        subject: null,
        body: smsText,
        provider: null,
        provider_message_id: null,
        error: "SMS skipped: missing client phone",
        sent_at: nowIso,
      })
      results.push({
        channel: "sms",
        logStatus: "skipped",
        error: "skipped",
      })
    } else {
      const r = await sendReminderSms({ to: phoneTrim, body: smsText })
      if (r.ok) {
        await insertNotificationLog(admin, {
          business_id: row.business_id,
          booking_id: row.id,
          channel: "sms",
          status: "sent",
          recipient: phoneTrim,
          subject: null,
          body: smsText,
          provider: r.provider,
          provider_message_id: r.messageId ?? null,
          error: null,
          sent_at: nowIso,
        })
        results.push({
          channel: "sms",
          logStatus: "sent",
          error: null,
        })
      } else {
        const logStatus = r.code === "simulated_dev" ? "simulated_dev" : r.code === "not_configured" ? "not_configured" : "failed"
        await insertNotificationLog(admin, {
          business_id: row.business_id,
          booking_id: row.id,
          channel: "sms",
          status: logStatus,
          recipient: phoneTrim,
          subject: null,
          body: smsText,
          provider: null,
          provider_message_id: null,
          error: r.error ?? r.code,
          sent_at: nowIso,
        })
        results.push({
          channel: "sms",
          logStatus,
          error: r.error ?? r.code,
        })
      }
    }
  }

  if (results.length === 0) {
    const empty: TablesUpdate<"bookings"> = {
      reminder_sent_at: nowIso,
      reminder_status: "skipped",
      reminder_error: "No reminder channels selected",
      last_updated_by: "system",
      updated_at: nowIso,
    }
    await admin.from("bookings").update(empty).eq("id", row.id)
    return
  }

  const statuses = results.map((x) => x.logStatus)
  if (statuses.includes("sent")) {
    const ok: TablesUpdate<"bookings"> = {
      status: "pending",
      reminder_sent_at: nowIso,
      reminder_status: "sent",
      reminder_error: null,
      last_updated_by: "system",
      last_change_type: "reminder_24h_sent",
      last_status_change_source: "automatic_24h_reminder",
      updated_at: nowIso,
    }
    await admin.from("bookings").update(ok).eq("id", row.id)
    return
  }

  if (statuses.every((s) => s === "skipped")) {
    const skipped: TablesUpdate<"bookings"> = {
      reminder_sent_at: nowIso,
      reminder_status: "skipped",
      reminder_error: "Missing channel or contact for selected reminder mode",
      last_updated_by: "system",
      updated_at: nowIso,
    }
    await admin.from("bookings").update(skipped).eq("id", row.id)
    return
  }

  const soft = new Set(["skipped", "not_configured", "simulated_dev"])
  const onlySoft = statuses.every((s) => soft.has(s))
  const anyFailed = statuses.includes("failed")
  if (!anyFailed && onlySoft) {
    const nc: TablesUpdate<"bookings"> = {
      reminder_sent_at: nowIso,
      reminder_status: "not_configured",
      reminder_error: "SMS/email providers not configured or simulated in dev",
      last_updated_by: "system",
      updated_at: nowIso,
    }
    await admin.from("bookings").update(nc).eq("id", row.id)
    return
  }

  const errBits = results
    .map((x) => (x.error ? `${x.channel}:${x.error}` : null))
    .filter(Boolean)
    .join("; ")
  const fail: TablesUpdate<"bookings"> = {
    reminder_sent_at: nowIso,
    reminder_status: "failed",
    reminder_error: errBits || "send_failed",
    last_updated_by: "system",
    updated_at: nowIso,
  }
  await admin.from("bookings").update(fail).eq("id", row.id)
}

/**
 * Przetwarza wszystkie należne przypomnienia (cron, service role).
 * Podłącz pod GET/POST /api/cron/reminders z nagłówkiem Authorization: Bearer CRON_SECRET.
 */
export async function processDueBookingReminders(): Promise<{
  ok: boolean
  processed: number
  scanned: number
  error?: string
}> {
  const admin = getServiceRoleClient()
  if (!admin) {
    return { ok: false, processed: 0, scanned: 0, error: "service_role_or_url_missing" }
  }

  const now = new Date()
  const nowIso = now.toISOString()

  const { data, error } = await admin
    .from("bookings")
    .select(
      `
      id,
      business_id,
      confirmation_token,
      client_name,
      client_phone,
      client_email,
      service_name,
      appointment_date,
      appointment_time,
      reminder_due_at,
      reminder_status,
      business_profiles ( reminder_channel, slug )
    `
    )
    .eq("status", "booked")
    .not("reminder_due_at", "is", null)
    .lte("reminder_due_at", nowIso)
    .is("reminder_sent_at", null)
    .or("reminder_status.eq.pending,reminder_status.is.null")

  if (error) {
    return { ok: false, processed: 0, scanned: 0, error: error.message }
  }

  const rows = (Array.isArray(data) ? data : []) as unknown as DueBookingRow[]
  const due = rows.filter((r) => appointmentStartsAtMs(r) > now.getTime())

  let processed = 0
  for (const row of due) {
    await processOneBooking(admin, row)
    processed += 1
  }

  return { ok: true, processed, scanned: due.length }
}
