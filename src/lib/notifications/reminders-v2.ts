import { sendReminderEmail } from "@/lib/notifications/email"
import { sendReminderSms } from "@/lib/notifications/sms"
import {
  applyTemplateVariables,
  getTemplateRuntime,
  type NotificationTemplateRuntime,
} from "@/lib/notifications/template-runtime"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import { getStaffDisplayName, getStaffFirstName } from "@/lib/staff/staff-display"
import { insertNotificationLog as persistNotificationLog } from "@/lib/notifications/notification-log-insert"
import type { TablesInsert, TablesUpdate } from "@/types/database"

type BusinessProfileJoin = {
  reminder_channel: string | null
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
  status: string
  first_reminder_due_at: string | null
  first_reminder_sent_at: string | null
  first_reminder_status: string | null
  second_reminder_due_at: string | null
  second_reminder_sent_at: string | null
  second_reminder_status: string | null
  business_profiles: BusinessProfileJoin
  staff_name: string | null
  staff_members?: { name: string | null } | null
}

type ReminderKind = "appointment_reminder_24h" | "appointment_reminder_short"
type ReminderTemplateType = "reminder_24h" | "reminder_before_visit"

function getPublicAppOrigin(): string {
  const explicit = process.env.APP_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`
  return "http://localhost:3000"
}

function reminderLocale(): "pl" | "en" {
  return process.env.REMINDER_LOCALE?.trim().toLowerCase() === "en" ? "en" : "pl"
}

function formatTimeHmFromDb(t: string): string {
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "09:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function buildMessage(
  kind: ReminderKind,
  lang: "pl" | "en",
  payload: { clientName: string; serviceName: string; dateLabel: string; timeHm: string; confirmUrl: string }
) {
  if (kind === "appointment_reminder_short") {
    if (lang === "en") {
      return {
        subject: "Appointment reminder",
        text: `Hi ${payload.clientName},\n\nthis is a reminder about your appointment today at ${payload.timeHm}.\n\nService: ${payload.serviceName}\nDate: ${payload.dateLabel} at ${payload.timeHm}\n\nSee you soon,\nYour business`,
        html: `<p>Hi ${escapeHtml(payload.clientName)},</p><p>This is a reminder about your appointment today at ${escapeHtml(payload.timeHm)}.</p><p>Service: <strong>${escapeHtml(payload.serviceName)}</strong><br/>Date: ${escapeHtml(payload.dateLabel)} at ${escapeHtml(payload.timeHm)}</p><p>See you soon,<br/>Your business</p>`,
        sms: `Hi ${payload.clientName}, this is a reminder about your appointment today at ${payload.timeHm} - ${payload.serviceName}. See you soon!`,
      }
    }
    return {
      subject: "Przypomnienie o wizycie",
      text: `Cześć ${payload.clientName},\n\nprzypominamy o Twojej wizycie dziś o ${payload.timeHm}.\n\nUsługa: ${payload.serviceName}\nTermin: ${payload.dateLabel} o ${payload.timeHm}\n\nDo zobaczenia,\nTwoja firma`,
      html: `<p>Cześć ${escapeHtml(payload.clientName)},</p><p>Przypominamy o Twojej wizycie dziś o ${escapeHtml(payload.timeHm)}.</p><p>Usługa: <strong>${escapeHtml(payload.serviceName)}</strong><br/>Termin: ${escapeHtml(payload.dateLabel)} o ${escapeHtml(payload.timeHm)}</p><p>Do zobaczenia,<br/>Twoja firma</p>`,
      sms: `Cześć ${payload.clientName}, przypominamy o wizycie dziś o ${payload.timeHm} - ${payload.serviceName}. Do zobaczenia!`,
    }
  }
  if (lang === "en") {
    return {
      subject: "Appointment reminder",
      text: `Hi ${payload.clientName}, this is a reminder for your appointment: ${payload.serviceName} on ${payload.dateLabel} at ${payload.timeHm}. If you cannot attend, cancel your appointment: ${payload.confirmUrl}`,
      html: `<p>Hi ${escapeHtml(payload.clientName)},</p><p>This is a reminder for your appointment: <strong>${escapeHtml(payload.serviceName)}</strong> on ${escapeHtml(payload.dateLabel)} at ${escapeHtml(payload.timeHm)}.</p><p><a href="${escapeHtml(payload.confirmUrl)}">Cancel your appointment if needed</a></p>`,
      sms: `Appointment reminder: ${payload.serviceName}, ${payload.dateLabel} at ${payload.timeHm}. Cancel if needed: ${payload.confirmUrl}`,
    }
  }
  return {
    subject: "Przypomnienie o wizycie",
    text: `Cześć ${payload.clientName}, przypominamy o wizycie: ${payload.serviceName} dnia ${payload.dateLabel} o ${payload.timeHm}. Jeśli nie możesz przyjść, anuluj wizytę: ${payload.confirmUrl}`,
    html: `<p>Cześć ${escapeHtml(payload.clientName)},</p><p>Przypominamy o wizycie: <strong>${escapeHtml(payload.serviceName)}</strong> dnia ${escapeHtml(payload.dateLabel)} o ${escapeHtml(payload.timeHm)}.</p><p><a href="${escapeHtml(payload.confirmUrl)}">Anuluj wizytę, jeśli nie możesz przyjść</a></p>`,
    sms: `Przypomnienie o wizycie: ${payload.serviceName}, ${payload.dateLabel} o ${payload.timeHm}. Jeśli nie możesz przyjść, anuluj wizytę: ${payload.confirmUrl}`,
  }
}

function reminderTemplateType(kind: ReminderKind): ReminderTemplateType {
  return kind === "appointment_reminder_24h" ? "reminder_24h" : "reminder_before_visit"
}

function appointmentStartMs(row: DueBookingRow): number {
  return new Date(`${String(row.appointment_date).slice(0, 10)}T${String(row.appointment_time).slice(0, 8)}`).getTime()
}

function defaultTimingMinutes(kind: ReminderKind): number {
  return kind === "appointment_reminder_24h" ? 1440 : 60
}

async function insertNotificationLog(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  row: {
    business_id: string
    booking_id: string
    channel: "sms" | "email"
    type: "appointment_reminder_24h" | "appointment_reminder_short"
    status: string
    recipient: string | null
    subject: string | null
    body: string | null
    provider: string | null
    provider_message_id: string | null
    error?: string | null
    error_message?: string | null
    sent_at: string | null
  }
) {
  void persistNotificationLog(admin, { ...row, type: row.type }, "[reminders-v2.notify.log]").then((result) => {
    if (!result.ok) {
      console.error("[reminders-v2.notify.log]", result.message)
    }
  })
}

async function updateBookingReminderStatus(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  row: DueBookingRow,
  kind: ReminderKind,
  status: "sent" | "failed" | "skipped" | "not_configured",
  nowIso: string,
  error: string | null,
  promoteToPending: boolean
) {
  let patch: TablesUpdate<"bookings">
  if (kind === "appointment_reminder_24h") {
    patch = {
      first_reminder_sent_at: nowIso,
      first_reminder_status: status,
      reminder_sent_at: nowIso,
      reminder_status: status,
      reminder_error: error,
      last_updated_by: "system",
      updated_at: nowIso,
    }
    if (promoteToPending && row.status === "booked") {
      patch.status = "pending"
      patch.last_change_type = "reminder_24h_sent"
      patch.last_status_change_source = "automatic_24h_reminder"
    }
  } else {
    patch = {
      second_reminder_sent_at: nowIso,
      second_reminder_status: status,
      second_reminder_error: error,
      last_updated_by: "system",
      updated_at: nowIso,
    }
  }
  await admin.from("bookings").update(patch).eq("id", row.id)
}

async function processSingleReminder(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  row: DueBookingRow,
  kind: ReminderKind
): Promise<"processed" | "failed" | "skipped"> {
  const nowIso = new Date().toISOString()
  const lang = reminderLocale()
  const origin = getPublicAppOrigin()
  const confirmUrl = `${origin}/confirm/${encodeURIComponent(row.confirmation_token)}?source=reminder`
  const timeHm = formatTimeHmFromDb(row.appointment_time)
  const dateLabel = String(row.appointment_date).slice(0, 10)
  const fallbackMessage = buildMessage(kind, lang, {
    clientName: row.client_name,
    serviceName: row.service_name,
    dateLabel,
    timeHm,
    confirmUrl,
  })
  const templateType = reminderTemplateType(kind)
  const runtime = await getTemplateRuntime(admin, row.business_id, templateType)
  const staffDisplayName = getStaffDisplayName({
    name: row.staff_members?.name ?? row.staff_name ?? "",
  })
  const staffFirstName = getStaffFirstName({
    name: row.staff_members?.name ?? row.staff_name ?? "",
  })
  const templateVars: Record<string, string> = {
    imie: row.client_name.split(/\s+/)[0] || row.client_name,
    data: dateLabel,
    godzina: timeHm,
    usluga: row.service_name,
    osoba: staffDisplayName,
    imie_osoby: staffFirstName,
    link_rezerwacji: "",
    link_potwierdzenia: confirmUrl,
    link_anulowania: confirmUrl,
    telefon_firmy: "",
    nazwa_firmy: "",
  }
  const message = {
    subject:
      runtime.emailSubject && runtime.emailSubject.trim().length > 0
        ? applyTemplateVariables(runtime.emailSubject, templateVars)
        : fallbackMessage.subject,
    text:
      runtime.emailBody && runtime.emailBody.trim().length > 0
        ? applyTemplateVariables(runtime.emailBody, templateVars)
        : fallbackMessage.text,
    html: fallbackMessage.html,
    sms:
      runtime.smsBody && runtime.smsBody.trim().length > 0
        ? applyTemplateVariables(runtime.smsBody, templateVars)
        : fallbackMessage.sms,
  }
  const type = kind === "appointment_reminder_24h" ? "appointment_reminder_24h" : "appointment_reminder_short"
  const hasEmail = Boolean(row.client_email?.trim())
  const hasPhone = Boolean(row.client_phone?.trim())

  if (!hasEmail && !hasPhone) {
    await insertNotificationLog(admin, {
      business_id: row.business_id,
      booking_id: row.id,
      channel: "email",
      type,
      status: "skipped",
      recipient: null,
      subject: message.subject,
      body: message.text,
      provider: null,
      provider_message_id: null,
      error: "Missing client contact details",
      sent_at: nowIso,
    })
    await updateBookingReminderStatus(admin, row, kind, "skipped", nowIso, "Missing client contact details", false)
    return "skipped"
  }

  const ch = row.business_profiles?.reminder_channel ?? "both"
  const wantEmail = (ch === "email" || ch === "both") && runtime.emailEnabled
  const wantSms = (ch === "sms" || ch === "both") && runtime.smsEnabled
  if (!wantEmail && !wantSms) {
    await updateBookingReminderStatus(admin, row, kind, "skipped", nowIso, "template_disabled", false)
    return "skipped"
  }
  const statuses: string[] = []
  const errors: string[] = []

  if (wantEmail && hasEmail) {
    const { data: existingEmail } = await admin
      .from("notification_logs")
      .select("id")
      .eq("booking_id", row.id)
      .eq("type", type)
      .eq("channel", "email")
      .limit(1)
      .maybeSingle()
    if (existingEmail?.id) {
      statuses.push("skipped")
    } else {
    const res = await sendReminderEmail({
      to: row.client_email!.trim(),
      subject: message.subject,
      textBody: message.text,
      htmlBody: message.html,
    })
    const status = res.ok ? "sent" : res.code === "not_configured" || res.code === "simulated_dev" ? res.code : "failed"
    statuses.push(status)
    if (!res.ok) errors.push(res.error ?? res.code)
    await insertNotificationLog(admin, {
      business_id: row.business_id,
      booking_id: row.id,
      channel: "email",
      type,
      status,
      recipient: row.client_email!.trim(),
      subject: message.subject,
      body: message.text,
      provider: res.ok ? res.provider : null,
      provider_message_id: res.ok ? res.messageId ?? null : null,
      error: res.ok ? null : res.error ?? res.code,
      sent_at: nowIso,
    })
    }
  }

  if (wantSms && hasPhone) {
    const { data: existingSms } = await admin
      .from("notification_logs")
      .select("id")
      .eq("booking_id", row.id)
      .eq("type", type)
      .eq("channel", "sms")
      .limit(1)
      .maybeSingle()
    if (existingSms?.id) {
      statuses.push("skipped")
    } else {
    const res = await sendReminderSms({ to: row.client_phone!.trim(), body: message.sms })
    const status = res.ok ? "sent" : res.code === "not_configured" || res.code === "simulated_dev" ? res.code : "failed"
    statuses.push(status)
    if (!res.ok) errors.push(res.error ?? res.code)
    await insertNotificationLog(admin, {
      business_id: row.business_id,
      booking_id: row.id,
      channel: "sms",
      type,
      status,
      recipient: row.client_phone!.trim(),
      subject: null,
      body: message.sms,
      provider: res.ok ? res.provider : null,
      provider_message_id: res.ok ? res.messageId ?? null : null,
      error: res.ok ? null : res.error ?? res.code,
      sent_at: nowIso,
    })
    }
  }

  if (statuses.includes("sent")) {
    await updateBookingReminderStatus(admin, row, kind, "sent", nowIso, null, false)
    return "processed"
  }
  if (statuses.some((s) => s === "failed")) {
    await updateBookingReminderStatus(admin, row, kind, "failed", nowIso, errors.join("; ") || "send_failed", false)
    return "failed"
  }
  await updateBookingReminderStatus(admin, row, kind, "not_configured", nowIso, errors.join("; ") || "not_configured", false)
  return "skipped"
}

export async function processDueBookingReminders(): Promise<{
  ok: boolean
  firstReminderProcessed: number
  secondReminderProcessed: number
  failed: number
  skipped: number
  error?: string
}> {
  const admin = getServiceRoleClient()
  if (!admin) {
    return { ok: false, firstReminderProcessed: 0, secondReminderProcessed: 0, failed: 0, skipped: 0, error: "service_role_or_url_missing" }
  }

  const nowMs = Date.now()
  const { data, error } = await admin
    .from("bookings")
    .select(
      "id,business_id,confirmation_token,client_name,client_phone,client_email,service_name,appointment_date,appointment_time,status,staff_name,first_reminder_due_at,first_reminder_sent_at,first_reminder_status,second_reminder_due_at,second_reminder_sent_at,second_reminder_status,business_profiles(reminder_channel),staff_members(name)"
    )
    .in("status", ["booked", "pending", "confirmed"])

  if (error) {
    return { ok: false, firstReminderProcessed: 0, secondReminderProcessed: 0, failed: 0, skipped: 0, error: error.message }
  }

  const rows = (Array.isArray(data) ? data : []) as unknown as DueBookingRow[]
  let firstReminderProcessed = 0
  let secondReminderProcessed = 0
  let failed = 0
  let skipped = 0
  const runtimeCache = new Map<string, { first: NotificationTemplateRuntime; second: NotificationTemplateRuntime }>()

  for (const row of rows) {
    const startMs = appointmentStartMs(row)
    if (!(startMs > nowMs)) {
      skipped += 1
      continue
    }

    let businessRuntime = runtimeCache.get(row.business_id)
    if (!businessRuntime) {
      businessRuntime = {
        first: await getTemplateRuntime(admin, row.business_id, "reminder_24h"),
        second: await getTemplateRuntime(admin, row.business_id, "reminder_before_visit"),
      }
      runtimeCache.set(row.business_id, businessRuntime)
    }
    const firstTiming = businessRuntime.first.timingMinutesBefore ?? defaultTimingMinutes("appointment_reminder_24h")
    const secondTiming = businessRuntime.second.timingMinutesBefore ?? defaultTimingMinutes("appointment_reminder_short")
    const firstDue = startMs - firstTiming * 60_000 <= nowMs
    const secondDue = startMs - secondTiming * 60_000 <= nowMs

    if (firstDue && row.first_reminder_sent_at == null && (row.first_reminder_status == null || row.first_reminder_status === "pending")) {
      const result = await processSingleReminder(admin, row, "appointment_reminder_24h")
      if (result === "processed") firstReminderProcessed += 1
      else if (result === "failed") failed += 1
      else skipped += 1
    }
    if (secondDue && row.second_reminder_sent_at == null && row.second_reminder_status === "pending") {
      const result = await processSingleReminder(admin, row, "appointment_reminder_short")
      if (result === "processed") secondReminderProcessed += 1
      else if (result === "failed") failed += 1
      else skipped += 1
    }
  }

  return { ok: true, firstReminderProcessed, secondReminderProcessed, failed, skipped }
}

export async function processScheduledReminders() {
  return processDueBookingReminders()
}
